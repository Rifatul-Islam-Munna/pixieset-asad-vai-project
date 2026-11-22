import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import { BookingEvent, BookingEventDocument } from '../bookings/entities/booking-event.entity';
import { StudioCalendarFeed, StudioCalendarFeedDocument } from './studio-calendar-feed.entity';

function escapeCalendar(value: unknown): string {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,').replace(/;/g, '\\;').slice(0, 1500);
}
function calendarUtc(value: Date): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}
function fold(line: string): string {
  const characters = [...line];
  const result: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of characters) {
    const size = Buffer.byteLength(char, 'utf8');
    if (bytes + size > 73 && current.length) {
      result.push(current);
      current = ' ' + char;
      bytes = size + 1;
    } else {
      current += char;
      bytes += size;
    }
  }
  result.push(current);
  return result.join('\r\n');
}

@Injectable()
export class StudioCalendarService {
  constructor(
    @InjectModel(StudioCalendarFeed.name) private readonly feeds: Model<StudioCalendarFeedDocument>,
    @InjectModel(BookingEvent.name) private readonly events: Model<BookingEventDocument>,
    private readonly config: ConfigService,
  ) {}

  private frontend(path: string): string {
    const base = this.config.get<string>('FRONTEND_URL') ||
      (this.config.get<string>('NODE_ENV') === 'production' ? 'https://gallerista.app' : 'http://localhost:3000');
    const url = new URL(path, base);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('FRONTEND_URL must be a valid HTTPS or development URL');
    return url.toString();
  }

  private url(token: string): string {
    return this.frontend('/api/studio/calendar/' + token + '.ics');
  }

  async getOrCreate(userId: string) {
    let feed = await this.feeds.findOne({ userId }).lean();
    if (!feed) {
      try {
        feed = await this.feeds.create({ userId, token: randomBytes(32).toString('hex') });
      } catch (error) {
        feed = await this.feeds.findOne({ userId }).lean();
        if (!feed) throw error;
      }
    }
    if (feed.disabled) return { url: '', enabled: false, kind: 'read-only-subscription' };
    return { url: this.url(feed.token), enabled: true, kind: 'read-only-subscription' };
  }

  async rotate(userId: string) {
    const token = randomBytes(32).toString('hex');
    await this.feeds.findOneAndUpdate({ userId }, { $set: { token, disabled: false } }, { upsert: true, returnDocument: 'after' });
    return { url: this.url(token), enabled: true, kind: 'read-only-subscription' };
  }

  async enable(userId: string) {
    return this.rotate(userId);
  }

  async revoke(userId: string) {
    // Revoke the old token permanently, even when the settings dialog is reopened.
    await this.feeds.updateOne(
      { userId },
      { $set: { disabled: true, token: randomBytes(32).toString('hex') } },
    );
    return { enabled: false };
  }

  async render(token: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new NotFoundException('Calendar not found');
    const feed = await this.feeds.findOne({ token, disabled: { $ne: true } }).lean();
    if (!feed) throw new NotFoundException('Calendar not found');
    const now = new Date();
    const from = new Date(now.getTime() - 365 * 86400000);
    const through = new Date(now.getTime() + 730 * 86400000);
    const events = await this.events.find({
      userId: feed.userId,
      status: { $ne: 'cancelled' },
      startAt: { $lt: through },
      endAt: { $gt: from },
    }).sort({ startAt: 1 }).limit(5000).lean();
    const lines: string[] = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gallerista//Studio Manager//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Gallerista Studio Sessions',
    ];
    for (const event of events) {
      lines.push(
        'BEGIN:VEVENT', 'UID:' + String(event._id) + '@gallerista-studio',
        'DTSTAMP:' + calendarUtc(event.startAt),
        'DTSTART:' + calendarUtc(event.startAt),
        'DTEND:' + calendarUtc(event.endAt),
        'SUMMARY:' + escapeCalendar(event.title),
        'DESCRIPTION:' + escapeCalendar(event.notes),
        'LOCATION:' + escapeCalendar(event.location),
        'STATUS:CONFIRMED', 'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }
}

import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { MailService } from 'src/mail/mail.service';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { BookingCoworker, BookingCoworkerDocument } from './entities/booking-coworker.entity';
import { BookingEvent, BookingEventDocument } from './entities/booking-event.entity';
import { BookingService, BookingServiceDocument } from './entities/booking-service.entity';
import { BookingBusinessHour, BookingSetting, BookingSettingDocument } from './entities/booking-setting.entity';
import { BookingShareLink, BookingShareLinkDocument } from './entities/booking-share-link.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(BookingSetting.name) private readonly settingModel: Model<BookingSettingDocument>,
    @InjectModel(BookingService.name) private readonly serviceModel: Model<BookingServiceDocument>,
    @InjectModel(BookingCoworker.name) private readonly coworkerModel: Model<BookingCoworkerDocument>,
    @InjectModel(BookingEvent.name) private readonly eventModel: Model<BookingEventDocument>,
    @InjectModel(BookingShareLink.name) private readonly shareLinkModel: Model<BookingShareLinkDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async overview(userId: string, from?: string, to?: string) {
    const settings = await this.ensureSettings(userId);
    const owner = await this.userModel.findById(userId).select('_id username name businessName email avatar').lean();
    if (!owner) throw new NotFoundException('Account not found');
    const start = this.safeDate(from) ?? new Date(Date.now() - 45 * 86400000);
    const end = this.safeDate(to) ?? new Date(Date.now() + 370 * 86400000);
    const [services, coworkers, events, shareLinks] = await Promise.all([
      this.serviceModel.find({ userId }).sort({ active: -1, createdAt: 1 }).lean(),
      this.coworkerModel.find({ userId }).sort({ active: -1, name: 1 }).lean(),
      this.eventModel.find({ userId, startAt: { $lt: end }, endAt: { $gt: start } }).sort({ startAt: 1 }).lean(),
      this.shareLinkModel.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
    ]);
    const publicIdentifier = owner.username || owner._id.toString();
    return {
      settings,
      services,
      coworkers,
      events,
      shareLinks: shareLinks.map((item) => ({ ...item, url: this.shareLinkUrl(publicIdentifier, item.token) })),
      publicIdentifier,
      owner: { name: owner.businessName || owner.name, username: owner.username, avatar: owner.avatar },
    };
  }

  async updateSettings(userId: string, body: Record<string, unknown>) {
    const current = await this.ensureSettings(userId);
    const patch: Record<string, unknown> = {};
    if (body.enabled !== undefined) patch.enabled = this.bool(body.enabled);
    if (body.autoConfirm !== undefined) patch.autoConfirm = this.bool(body.autoConfirm);
    if (body.timezone !== undefined) patch.timezone = this.safeTimeZone(body.timezone);
    if (body.minNoticeHours !== undefined) patch.minNoticeHours = this.clampNumber(body.minNoticeHours, 0, 720, current.minNoticeHours);
    if (body.maxAdvanceDays !== undefined) patch.maxAdvanceDays = this.clampNumber(body.maxAdvanceDays, 1, 730, current.maxAdvanceDays);
    if (body.slotIntervalMinutes !== undefined) patch.slotIntervalMinutes = this.clampNumber(body.slotIntervalMinutes, 5, 240, current.slotIntervalMinutes);
    if (body.confirmationMessage !== undefined) patch.confirmationMessage = this.text(body.confirmationMessage, 600) || 'Thanks! Your booking request has been received.';
    if (Array.isArray(body.businessHours)) patch.businessHours = this.businessHours(body.businessHours);
    return this.settingModel.findOneAndUpdate({ userId }, { $set: patch }, { new: true, upsert: true }).lean();
  }

  async createShareLink(userId: string, body: Record<string, unknown>) {
    const owner = await this.userModel
      .findById(userId)
      .select('_id username name businessName email')
      .lean();
    if (!owner) throw new NotFoundException('Account not found');

    const recipientName = this.text(body.recipientName, 120);
    const rawRecipientEmail = this.text(body.recipientEmail, 180);
    const recipientEmail = rawRecipientEmail ? this.email(rawRecipientEmail) : '';
    if (rawRecipientEmail && !recipientEmail)
      throw new BadRequestException('Enter a valid recipient email');

    const serviceId = this.text(body.serviceId, 80);
    let serviceName = '';
    if (serviceId) {
      this.objectId(serviceId, 'Booking type');
      const service = await this.serviceModel
        .findOne({ _id: serviceId, userId, active: true })
        .select('_id name')
        .lean();
      if (!service) throw new NotFoundException('Booking type not found');
      serviceName = service.name;
    }

    const expiresAt = this.safeDate(body.expiresAt) ?? new Date(Date.now() + 7 * 86400000);
    if (expiresAt.getTime() <= Date.now() + 60000)
      throw new BadRequestException('Expiry must be at least one minute in the future');
    if (expiresAt.getTime() > Date.now() + 366 * 86400000)
      throw new BadRequestException('Booking links can expire up to one year from now');

    const token = randomBytes(24).toString('hex');
    const link = await this.shareLinkModel.create({
      userId,
      token,
      recipientName,
      recipientEmail,
      serviceId,
      serviceName,
      expiresAt,
      bookingEventId: '',
    });
    const identifier = owner.username || owner._id.toString();
    const url = this.shareLinkUrl(identifier, token);
    let emailSent = false;
    if (this.bool(body.sendEmail) && recipientEmail) {
      const business = owner.businessName || owner.name || 'Studio';
      const expiryText = expiresAt.toLocaleString();
      const result = await this.mailService.send({
        to: recipientEmail,
        replyTo: this.email(owner.email) || undefined,
        subject: `${business}: booking invitation`,
        text: `${recipientName ? `Hi ${recipientName},\n\n` : ''}${business} invited you to book${serviceName ? ` ${serviceName}` : ' a session'}.\n\nBook here: ${url}\n\nThis private link expires ${expiryText} and can be used for one booking.`,
      });
      emailSent = Boolean(result.sent);
    }
    return { ...link.toObject(), url, emailSent };
  }

  async deleteShareLink(userId: string, id: string) {
    this.objectId(id, 'Booking link');
    const item = await this.shareLinkModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!item) throw new NotFoundException('Booking link not found');
    return { deleted: true, id };
  }

  async createService(userId: string, body: Record<string, unknown>) {
    const data = this.servicePayload(body);
    if (!data.name) throw new BadRequestException('Booking type name is required');
    return (await this.serviceModel.create({ userId, ...data })).toObject();
  }

  async updateService(userId: string, id: string, body: Record<string, unknown>) {
    this.objectId(id, 'Booking type');
    const data = this.servicePayload(body, true);
    const item = await this.serviceModel.findOneAndUpdate({ _id: id, userId }, { $set: data }, { new: true }).lean();
    if (!item) throw new NotFoundException('Booking type not found');
    return item;
  }

  async deleteService(userId: string, id: string) {
    this.objectId(id, 'Booking type');
    const item = await this.serviceModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!item) throw new NotFoundException('Booking type not found');
    return { deleted: true, id };
  }

  async createCoworker(userId: string, body: Record<string, unknown>) {
    const data = this.coworkerPayload(body);
    if (!data.name) throw new BadRequestException('Co-worker name is required');
    return (await this.coworkerModel.create({ userId, ...data })).toObject();
  }

  async updateCoworker(userId: string, id: string, body: Record<string, unknown>) {
    this.objectId(id, 'Co-worker');
    const data = this.coworkerPayload(body, true);
    const item = await this.coworkerModel.findOneAndUpdate({ _id: id, userId }, { $set: data }, { new: true }).lean();
    if (!item) throw new NotFoundException('Co-worker not found');
    return item;
  }

  async deleteCoworker(userId: string, id: string) {
    this.objectId(id, 'Co-worker');
    const item = await this.coworkerModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!item) throw new NotFoundException('Co-worker not found');
    await Promise.all([
      this.serviceModel.updateMany({ userId }, { $pull: { coworkerIds: id } }),
      this.eventModel.updateMany({ userId }, { $pull: { coworkerIds: id } }),
    ]);
    return { deleted: true, id };
  }

  async createEvent(userId: string, body: Record<string, unknown>) {
    const data = this.eventPayload(body);
    if (!data.title) throw new BadRequestException('Event title is required');
    if (!data.startAt || !data.endAt || data.endAt <= data.startAt) throw new BadRequestException('A valid event start and end time are required');
    return (await this.eventModel.create({ userId, ...data, source: 'dashboard' })).toObject();
  }

  async updateEvent(userId: string, id: string, body: Record<string, unknown>) {
    this.objectId(id, 'Event');
    const existing = await this.eventModel.findOne({ _id: id, userId }).lean();
    if (!existing) throw new NotFoundException('Event not found');
    const data = this.eventPayload(body, true);
    const startAt = (data.startAt as Date | undefined) ?? existing.startAt;
    const endAt = (data.endAt as Date | undefined) ?? existing.endAt;
    if (endAt <= startAt) throw new BadRequestException('Event end time must be after the start time');
    return this.eventModel.findOneAndUpdate({ _id: id, userId }, { $set: data }, { new: true }).lean();
  }

  async deleteEvent(userId: string, id: string) {
    this.objectId(id, 'Event');
    const item = await this.eventModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!item) throw new NotFoundException('Event not found');
    return { deleted: true, id };
  }

  async publicDetails(identifier: string, inviteToken?: string) {
    const owner = await this.resolveOwner(identifier);
    const userId = owner._id.toString();
    const settings = await this.ensureSettings(userId);
    if (!settings.enabled) throw new NotFoundException('Online booking is not available');
    const invite = inviteToken ? await this.resolveShareLink(userId, inviteToken) : null;
    const serviceQuery: Record<string, unknown> = { userId, active: true };
    if (invite?.serviceId) serviceQuery._id = invite.serviceId;
    const services = await this.serviceModel
      .find(serviceQuery)
      .select('_id name description durationMinutes price currency location')
      .sort({ createdAt: 1 })
      .lean();
    return {
      owner: {
        name: owner.businessName || owner.name,
        avatar: owner.avatar,
        website: owner.website,
      },
      settings: {
        timezone: settings.timezone,
        minNoticeHours: settings.minNoticeHours,
        maxAdvanceDays: settings.maxAdvanceDays,
        confirmationMessage: settings.confirmationMessage,
      },
      services,
      invite: invite ? {
        recipientName: invite.recipientName,
        recipientEmail: invite.recipientEmail,
        serviceId: invite.serviceId,
        serviceName: invite.serviceName,
        expiresAt: invite.expiresAt,
      } : undefined,
    };
  }

  async publicAvailability(identifier: string, serviceId?: string, date?: string, inviteToken?: string) {
    const owner = await this.resolveOwner(identifier);
    const userId = owner._id.toString();
    const settings = await this.ensureSettings(userId);
    if (!settings.enabled) throw new NotFoundException('Online booking is not available');
    const invite = inviteToken ? await this.resolveShareLink(userId, inviteToken) : null;
    if (!serviceId || !Types.ObjectId.isValid(serviceId)) throw new BadRequestException('Booking type is required');
    if (invite?.serviceId && invite.serviceId !== serviceId)
      throw new BadRequestException('This private link is for a different booking type');
    const service = await this.serviceModel.findOne({ _id: serviceId, userId, active: true }).lean();
    if (!service) throw new NotFoundException('Booking type not found');
    const targetDate = this.dateText(date);
    const slots = await this.availableSlots(userId, settings, service, targetDate);
    return {
      date: targetDate,
      timezone: settings.timezone,
      slots: slots.map((slot) => ({ startAt: slot.startAt.toISOString(), endAt: slot.endAt.toISOString() })),
    };
  }

  async createPublicBooking(identifier: string, body: Record<string, unknown>) {
    const owner = await this.resolveOwner(identifier);
    const userId = owner._id.toString();
    const settings = await this.ensureSettings(userId);
    if (!settings.enabled) throw new NotFoundException('Online booking is not available');
    const inviteToken = this.text(body.inviteToken, 100);
    const invite = inviteToken ? await this.resolveShareLink(userId, inviteToken) : null;
    const serviceId = this.text(body.serviceId, 80);
    if (!Types.ObjectId.isValid(serviceId)) throw new BadRequestException('Booking type is required');
    if (invite?.serviceId && invite.serviceId !== serviceId)
      throw new BadRequestException('This private link is for a different booking type');
    const service = await this.serviceModel.findOne({ _id: serviceId, userId, active: true }).lean();
    if (!service) throw new NotFoundException('Booking type not found');
    const clientName = this.text(body.clientName, 120);
    const clientEmail = this.email(body.clientEmail);
    if (!clientName) throw new BadRequestException('Your name is required');
    if (!clientEmail) throw new BadRequestException('A valid email is required');
    if (invite?.recipientEmail && invite.recipientEmail !== clientEmail)
      throw new BadRequestException('Use the email address this private booking link was sent to');
    const requestedStart = this.safeDate(body.startAt);
    const date = this.dateText(body.date);
    if (!requestedStart) throw new BadRequestException('Please choose an available time');
    const slots = await this.availableSlots(userId, settings, service, date);
    const selected = slots.find((slot) => Math.abs(slot.startAt.getTime() - requestedStart.getTime()) < 1000);
    if (!selected) throw new BadRequestException('That time is no longer available. Please choose another time.');
    const status = settings.autoConfirm ? 'confirmed' : 'pending';
    let claimedInviteId = '';
    if (invite) {
      const claimed = await this.shareLinkModel.findOneAndUpdate(
        { _id: invite._id, userId, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
        { $set: { usedAt: new Date() } },
        { new: true },
      ).lean();
      if (!claimed) throw new GoneException('This private booking link has expired or was already used');
      claimedInviteId = String(claimed._id);
    }

    let event: BookingEventDocument;
    try {
      event = await this.eventModel.create({
        userId,
        title: `${service.name} - ${clientName}`,
        kind: 'booking',
        status,
        startAt: selected.startAt,
        endAt: selected.endAt,
        location: service.location || '',
        notes: this.text(body.notes, 2000),
        clientName,
        clientEmail,
        clientPhone: this.text(body.clientPhone, 60),
        serviceId: service._id.toString(),
        serviceName: service.name,
        coworkerIds: selected.resourceId ? [selected.resourceId] : [],
        source: 'public',
      });
    } catch (error) {
      if (claimedInviteId)
        await this.shareLinkModel.updateOne({ _id: claimedInviteId, bookingEventId: '' }, { $unset: { usedAt: 1 } }).catch(() => undefined);
      throw error;
    }
    if (claimedInviteId)
      await this.shareLinkModel.updateOne({ _id: claimedInviteId }, { $set: { bookingEventId: String(event._id) } });
    void this.sendBookingEmails(owner, event.toObject(), settings.timezone).catch(() => undefined);
    return {
      event: event.toObject(),
      status,
      confirmationMessage: settings.confirmationMessage,
    };
  }

  private async availableSlots(userId: string, settings: any, service: any, date: string) {
    const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const hours = (settings.businessHours as BookingBusinessHour[]).find((item) => Number(item.day) === day);
    if (!hours?.enabled) return [];
    const open = timeToMinutes(hours.start);
    const close = timeToMinutes(hours.end);
    const duration = Math.max(15, Number(service.durationMinutes || 60));
    const interval = Math.max(5, Number(settings.slotIntervalMinutes || 30));
    if (open < 0 || close <= open || close - open < duration) return [];

    const candidateIds = Array.isArray(service.coworkerIds) ? service.coworkerIds.filter((id: string) => Types.ObjectId.isValid(id)) : [];
    const coworkerQuery: Record<string, unknown> = { userId, active: true };
    if (candidateIds.length) coworkerQuery._id = { $in: candidateIds };
    const coworkers = await this.coworkerModel.find(coworkerQuery).select('_id').lean();
    const resources = coworkers.map((item) => item._id.toString());

    const firstStart = wallTimeToUtc(date, minutesToTime(open), settings.timezone);
    const lastEnd = wallTimeToUtc(date, minutesToTime(close), settings.timezone);
    const events = await this.eventModel.find({
      userId,
      status: { $ne: 'cancelled' },
      startAt: { $lt: new Date(lastEnd.getTime() + 86400000) },
      endAt: { $gt: new Date(firstStart.getTime() - 86400000) },
    }).select('startAt endAt coworkerIds').lean();

    const minStart = Date.now() + Math.max(0, Number(settings.minNoticeHours || 0)) * 3600000;
    const maxStart = Date.now() + Math.max(1, Number(settings.maxAdvanceDays || 90)) * 86400000;
    const slots: Array<{ startAt: Date; endAt: Date; resourceId: string | null }> = [];
    for (let cursor = open; cursor + duration <= close; cursor += interval) {
      const startAt = wallTimeToUtc(date, minutesToTime(cursor), settings.timezone);
      const endAt = new Date(startAt.getTime() + duration * 60000);
      if (startAt.getTime() < minStart || startAt.getTime() > maxStart) continue;
      const overlaps = events.filter((event) => event.startAt < endAt && event.endAt > startAt);
      if (!resources.length) {
        if (!overlaps.length) slots.push({ startAt, endAt, resourceId: null });
        continue;
      }
      if (overlaps.some((event) => !event.coworkerIds?.length)) continue;
      const busy = new Set(overlaps.flatMap((event) => event.coworkerIds ?? []));
      const available = resources.find((id) => !busy.has(id));
      if (available) slots.push({ startAt, endAt, resourceId: available });
    }
    return slots;
  }

  private async sendBookingEmails(owner: any, event: any, timezone: string) {
    const start = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full', timeStyle: 'short', timeZone: timezone,
    }).format(new Date(event.startAt));
    const ownerEmail = this.email(owner.email);
    const clientEmail = this.email(event.clientEmail);
    const business = owner.businessName || owner.name || 'Studio';
    const subject = `${event.status === 'confirmed' ? 'Booking confirmed' : 'New booking request'} - ${event.serviceName}`;
    const text = [
      `${event.serviceName}`,
      `Client: ${event.clientName}`,
      `Email: ${clientEmail}`,
      event.clientPhone ? `Phone: ${event.clientPhone}` : '',
      `When: ${start} (${timezone})`,
      event.location ? `Location: ${event.location}` : '',
      event.notes ? `Notes: ${event.notes}` : '',
    ].filter(Boolean).join('\n');
    const sends: Promise<unknown>[] = [];
    if (ownerEmail) sends.push(this.mailService.send({ to: ownerEmail, replyTo: clientEmail, subject: `New booking - ${event.serviceName} - ${event.clientName}`, text }));
    if (clientEmail) sends.push(this.mailService.send({ to: clientEmail, replyTo: ownerEmail || undefined, subject: `${business}: ${subject}`, text: `${business}\n\n${text}\n\n${event.status === 'confirmed' ? 'Your booking is confirmed.' : 'Your request is pending confirmation.'}` }));
    await Promise.all(sends);
  }

  private async ensureSettings(userId: string) {
    let settings = await this.settingModel.findOne({ userId }).lean();
    if (!settings) {
      settings = (await this.settingModel.create({ userId })).toObject();
    }
    return settings;
  }

  private async resolveOwner(identifier: string) {
    const value = String(identifier || '').trim().toLowerCase();
    const query = Types.ObjectId.isValid(value)
      ? { $or: [{ _id: value }, { username: value }] }
      : { username: value };
    const owner = await this.userModel
      .findOne(query as any)
      .select('_id username name businessName email avatar website')
      .lean();
    if (!owner) throw new NotFoundException('Booking page not found');
    return owner;
  }

  private async resolveShareLink(userId: string, token: string) {
    const cleanToken = this.text(token, 100);
    if (!/^[a-f0-9]{48}$/i.test(cleanToken)) throw new NotFoundException('Booking link not found');
    const link = await this.shareLinkModel.findOne({ userId, token: cleanToken }).lean();
    if (!link) throw new NotFoundException('Booking link not found');
    if (new Date(link.expiresAt).getTime() <= Date.now())
      throw new GoneException('This private booking link has expired');
    if (link.usedAt || link.bookingEventId)
      throw new GoneException('This private booking link was already used');
    return link;
  }

  private shareLinkUrl(identifier: string, token: string) {
    const base = String(
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('PUBLIC_APP_URL') ||
      'http://localhost:3000',
    ).replace(/\/$/, '');
    return `${base}/book/${encodeURIComponent(identifier)}?invite=${encodeURIComponent(token)}`;
  }

  private servicePayload(body: Record<string, unknown>, partial = false) {
    const data: Record<string, unknown> = {};
    const set = (key: string, value: unknown) => { if (!partial || body[key] !== undefined) data[key] = value; };
    set('name', this.text(body.name, 120));
    set('description', this.text(body.description, 1600));
    set('durationMinutes', this.clampNumber(body.durationMinutes, 15, 1440, 60));
    set('price', this.clampNumber(body.price, 0, 100000000, 0, false));
    set('currency', this.text(body.currency, 6).toUpperCase() || 'USD');
    set('location', this.text(body.location, 240));
    set('active', body.active === undefined ? true : this.bool(body.active));
    set('coworkerIds', this.ids(body.coworkerIds));
    return data;
  }

  private coworkerPayload(body: Record<string, unknown>, partial = false) {
    const data: Record<string, unknown> = {};
    const set = (key: string, value: unknown) => { if (!partial || body[key] !== undefined) data[key] = value; };
    set('name', this.text(body.name, 120));
    set('email', this.email(body.email));
    set('phone', this.text(body.phone, 60));
    set('role', this.text(body.role, 100) || 'Photographer');
    set('notes', this.text(body.notes, 1200));
    set('active', body.active === undefined ? true : this.bool(body.active));
    return data;
  }

  private eventPayload(body: Record<string, unknown>, partial = false) {
    const data: Record<string, any> = {};
    const set = (key: string, value: unknown) => { if (!partial || body[key] !== undefined) data[key] = value; };
    set('title', this.text(body.title, 180));
    set('kind', ['booking', 'event'].includes(String(body.kind)) ? String(body.kind) : 'event');
    set('status', ['pending', 'confirmed', 'completed', 'cancelled'].includes(String(body.status)) ? String(body.status) : 'confirmed');
    set('startAt', this.safeDate(body.startAt));
    set('endAt', this.safeDate(body.endAt));
    set('allDay', this.bool(body.allDay));
    set('location', this.text(body.location, 240));
    set('notes', this.text(body.notes, 2000));
    set('clientName', this.text(body.clientName, 120));
    set('clientEmail', this.email(body.clientEmail));
    set('clientPhone', this.text(body.clientPhone, 60));
    set('serviceId', this.text(body.serviceId, 80));
    set('serviceName', this.text(body.serviceName, 120));
    set('coworkerIds', this.ids(body.coworkerIds));
    return data;
  }

  private businessHours(value: unknown[]) {
    const map = new Map<number, BookingBusinessHour>();
    for (const entry of value) {
      const row = (entry ?? {}) as Record<string, unknown>;
      const day = Math.max(0, Math.min(6, Math.floor(Number(row.day))));
      map.set(day, {
        day,
        enabled: this.bool(row.enabled),
        start: this.time(row.start, '09:00'),
        end: this.time(row.end, '17:00'),
      });
    }
    return Array.from({ length: 7 }, (_, day) => map.get(day) ?? { day, enabled: day > 0 && day < 6, start: '09:00', end: '17:00' });
  }

  private text(value: unknown, max: number) {
    return String(value ?? '').trim().slice(0, max);
  }

  private email(value: unknown) {
    const email = this.text(value, 180).toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  }

  private bool(value: unknown) {
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value ?? '').trim().toLowerCase());
  }

  private clampNumber(value: unknown, min: number, max: number, fallback: number, integer = true) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const result = Math.max(min, Math.min(max, parsed));
    return integer ? Math.round(result) : Math.round(result * 100) / 100;
  }

  private ids(value: unknown) {
    return [...new Set((Array.isArray(value) ? value : []).map(String).filter((id) => Types.ObjectId.isValid(id)))];
  }

  private safeDate(value: unknown) {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private dateText(value: unknown) {
    const text = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException('A valid booking date is required');
    const date = new Date(`${text}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('A valid booking date is required');
    return text;
  }

  private time(value: unknown, fallback: string) {
    const text = String(value ?? '').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
  }

  private safeTimeZone(value: unknown) {
    const timezone = this.text(value, 80) || 'UTC';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      return 'UTC';
    }
  }

  private objectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException(`${label} is invalid`);
  }
}

function timeToMinutes(value: string) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(value: number) {
  const hour = Math.floor(value / 60).toString().padStart(2, '0');
  const minute = (value % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

function wallTimeToUtc(dateText: string, timeText: string, timeZone: string) {
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
    const delta = desired - represented;
    if (!delta) break;
    guess += delta;
  }
  return new Date(guess);
}

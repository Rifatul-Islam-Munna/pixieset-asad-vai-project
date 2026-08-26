import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { CollectionEmailRegistration, CollectionEmailRegistrationDocument } from 'src/collections/entities/collection-email-registration.entity';
import { MailService } from 'src/mail/mail.service';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { MarketingEmailSchedule, MarketingEmailScheduleDocument } from './entities/marketing-email-schedule.entity';

@Injectable()
export class MarketingScheduleService implements OnModuleInit {
  private readonly logger = new Logger(MarketingScheduleService.name);
  private processing = false;

  constructor(
    @InjectModel(MarketingEmailSchedule.name) private readonly scheduleModel: Model<MarketingEmailScheduleDocument>,
    @InjectModel(CollectionEmailRegistration.name) private readonly contactModel: Model<CollectionEmailRegistrationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    setTimeout(() => void this.processDueSchedules(), 1500);
  }

  async list(userId: string) {
    return this.scheduleModel.find({ userId }).sort({ createdAt: -1 }).limit(250).lean();
  }

  async create(userId: string, body: Record<string, unknown>) {
    const recipientMode = body.recipientMode === 'category' ? 'category' : 'contacts';
    const recipientCategory = this.text(body.recipientCategory, 180);
    const requestedEmails = this.emailList(body.recipientEmails);
    const recipients = await this.resolveRecipients(userId, recipientMode, requestedEmails, recipientCategory);
    if (!recipients.length) throw new BadRequestException('Choose at least one subscribed marketing contact');

    const timeZone = this.validTimeZone(this.text(body.timeZone, 120) || 'UTC');
    const scheduledLocal = this.text(body.scheduledLocal, 40);
    const scheduledAt = zonedLocalToUtc(scheduledLocal, timeZone);
    if (!scheduledAt || scheduledAt.getTime() <= Date.now() + 5000) {
      throw new BadRequestException('Schedule time must be in the future');
    }

    const subject = this.text(body.subject, 220);
    const message = this.text(body.message, 12000);
    const previewText = this.text(body.previewText, 500);
    if (!subject) throw new BadRequestException('Template subject is required');
    if (!message && !previewText) throw new BadRequestException('Template message is required');

    const templateName = this.text(body.templateName, 180) || 'Email campaign';
    const doc = await this.scheduleModel.create({
      userId,
      name: this.text(body.name, 160) || `${templateName} - ${scheduledLocal}`,
      status: 'scheduled',
      recipientMode,
      recipientEmails: recipients,
      recipientCategory: recipientMode === 'category' ? recipientCategory : undefined,
      templateId: this.text(body.templateId, 180) || 'custom',
      templateName,
      subject,
      previewText,
      message,
      footerText: this.text(body.footerText, 3000),
      eyebrowText: this.text(body.eyebrowText, 160),
      buttonText: this.text(body.buttonText, 160),
      buttonLink: this.text(body.buttonLink, 1500),
      buttonColor: this.safeColor(body.buttonColor),
      image: this.text(body.image, 1500),
      showImage: body.showImage !== false,
      collectionId: this.text(body.collectionId, 120) || undefined,
      collectionName: this.text(body.collectionName, 220) || undefined,
      scheduledAt,
      scheduledLocal,
      timeZone,
      recipientsCount: recipients.length,
      lastError: '',
    });
    return doc.toObject();
  }

  async cancel(userId: string, id: string) {
    const doc = await this.scheduleModel.findOneAndUpdate(
      { _id: id, userId, status: { $in: ['scheduled', 'failed'] } },
      { $set: { status: 'cancelled', lastError: '' } },
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundException('Scheduled campaign not found or cannot be cancelled');
    return doc;
  }

  @Interval(15000)
  async processDueSchedules() {
    if (this.processing) return;
    this.processing = true;
    try {
      const due = await this.scheduleModel.find({ status: 'scheduled', scheduledAt: { $lte: new Date() } }).select('_id').sort({ scheduledAt: 1 }).limit(20).lean();
      for (const item of due) {
        const claimed = await this.scheduleModel.findOneAndUpdate(
          { _id: item._id, status: 'scheduled' },
          { $set: { status: 'sending', lastError: '' } },
          { new: true },
        );
        if (!claimed) continue;
        await this.deliver(claimed).catch((error) => this.markFailed(claimed._id.toString(), error));
      }
    } finally {
      this.processing = false;
    }
  }

  private async deliver(schedule: MarketingEmailScheduleDocument) {
    const subscribed = await this.contactModel.find({
      ownerId: schedule.userId,
      marketingOptIn: true,
      email: { $in: schedule.recipientEmails },
    }).select('email').lean();
    const recipients = [...new Set(subscribed.map((item) => item.email.toLowerCase()))];
    if (!recipients.length) throw new Error('All selected contacts unsubscribed before the scheduled send');

    const user = await this.userModel.findById(schedule.userId).select('monthlyEmailLimit monthlyEmailsUsed monthlyUsageKey').lean();
    if (!user) throw new Error('Campaign owner no longer exists');
    const monthKey = new Date().toISOString().slice(0, 7);
    const used = user.monthlyUsageKey === monthKey ? Number(user.monthlyEmailsUsed ?? 0) : 0;
    const limit = Number(user.monthlyEmailLimit ?? 0);
    if (limit > 0 && used + recipients.length > limit) {
      throw new Error(`Monthly email limit exceeded (${used}/${limit} already used)`);
    }

    const text = buildCampaignText(schedule);
    const html = buildCampaignHtml(schedule);
    const result = await this.mailService.send({ to: [], bcc: recipients, subject: schedule.subject, text, html });
    if (!result.sent) throw new Error(result.reason === 'SMTP_NOT_CONFIGURED' ? 'SMTP is not configured' : 'SMTP delivery failed');

    await Promise.all([
      this.scheduleModel.updateOne({ _id: schedule._id }, { $set: { status: 'sent', sentAt: new Date(), recipientsCount: recipients.length, lastError: '' } }),
      this.userModel.updateOne({ _id: schedule.userId }, { $set: { monthlyUsageKey: monthKey, monthlyEmailsUsed: used + recipients.length } }),
    ]);
  }

  private async markFailed(id: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Scheduled campaign ${id} failed: ${message}`);
    await this.scheduleModel.updateOne({ _id: id }, { $set: { status: 'failed', lastError: message.slice(0, 2000) } });
  }

  private async resolveRecipients(userId: string, mode: 'contacts' | 'category', emails: string[], category: string) {
    if (mode === 'category') {
      if (!category) throw new BadRequestException('Choose a contact category');
      const rows = await this.contactModel.find({
        ownerId: userId,
        marketingOptIn: true,
        $or: [{ collectionName: category }, { lastSource: category }, { sources: category }],
      }).select('email').lean();
      return [...new Set(rows.map((row) => row.email.toLowerCase()))];
    }
    if (!emails.length) return [];
    const rows = await this.contactModel.find({ ownerId: userId, marketingOptIn: true, email: { $in: emails } }).select('email').lean();
    return [...new Set(rows.map((row) => row.email.toLowerCase()))];
  }

  private emailList(value: unknown) {
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    return [...new Set(raw.map((item) => String(item ?? '').trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
  }

  private text(value: unknown, max: number) { return String(value ?? '').trim().slice(0, max); }
  private safeColor(value: unknown) { const color = this.text(value, 30); return /^#[0-9a-f]{6}$/i.test(color) ? color : '#444444'; }
  private validTimeZone(value: string) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date()); return value; }
    catch { throw new BadRequestException('Invalid timezone'); }
  }
}

function zonedLocalToUtc(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new BadRequestException('Choose a valid local date and time');
  const [, y, m, d, hh, mm] = match;
  const target = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0);
  let guess = target;
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += target - represented;
  }
  const date = new Date(guess);
  const finalParts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const finalLocal = `${finalParts.year}-${finalParts.month}-${finalParts.day}T${finalParts.hour}:${finalParts.minute}`;
  if (finalLocal !== value) throw new BadRequestException('That local time does not exist in the selected timezone');
  return date;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function buildCampaignText(schedule: MarketingEmailScheduleDocument) {
  return [schedule.eyebrowText, schedule.message, schedule.buttonText && schedule.buttonLink ? `${schedule.buttonText}: ${schedule.buttonLink}` : '', schedule.footerText].filter(Boolean).join('\n\n');
}

function buildCampaignHtml(schedule: MarketingEmailScheduleDocument) {
  const button = schedule.buttonText && schedule.buttonLink
    ? `<p style="margin:28px 0"><a href="${escapeHtml(schedule.buttonLink)}" style="display:inline-block;background:${escapeHtml(schedule.buttonColor || '#444444')};color:#fff;padding:13px 22px;text-decoration:none;font-weight:700">${escapeHtml(schedule.buttonText)}</a></p>`
    : '';
  const image = schedule.showImage && schedule.image
    ? `<img src="${escapeHtml(schedule.image)}" alt="" style="display:block;width:100%;max-height:420px;object-fit:cover;margin:22px 0" />`
    : '';
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:32px;color:#202326;line-height:1.7">${schedule.previewText ? `<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(schedule.previewText)}</span>` : ''}${schedule.eyebrowText ? `<p style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#777">${escapeHtml(schedule.eyebrowText)}</p>` : ''}${image}<div style="white-space:pre-line">${escapeHtml(schedule.message)}</div>${button}${schedule.footerText ? `<div style="margin-top:34px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#777;white-space:pre-line">${escapeHtml(schedule.footerText)}</div>` : ''}</div>`;
}

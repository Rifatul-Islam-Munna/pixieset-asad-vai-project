import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { CollectionEmailRegistration, CollectionEmailRegistrationDocument } from 'src/collections/entities/collection-email-registration.entity';
import { MailService } from 'src/mail/mail.service';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { MarketingEmailAutomation, MarketingEmailAutomationDocument } from './entities/marketing-email-automation.entity';
import { MarketingEmailSchedule, MarketingEmailScheduleDocument } from './entities/marketing-email-schedule.entity';

export type MarketingAutomationTrigger = 'new-subscriber' | 'gallery-published' | 'client-download' | 'client-favorite';

export type LifecycleAutomationEvent = {
  userId: string;
  trigger: Exclude<MarketingAutomationTrigger, 'new-subscriber'>;
  recipientEmails: string[];
  collectionId: string;
  collectionName: string;
  buttonLink?: string;
  eventId?: string;
};

@Injectable()
export class MarketingScheduleService implements OnModuleInit {
  private readonly logger = new Logger(MarketingScheduleService.name);
  private processing = false;

  constructor(
    @InjectModel(MarketingEmailSchedule.name) private readonly scheduleModel: Model<MarketingEmailScheduleDocument>,
    @InjectModel(MarketingEmailAutomation.name) private readonly automationModel: Model<MarketingEmailAutomationDocument>,
    @InjectModel(CollectionEmailRegistration.name) private readonly contactModel: Model<CollectionEmailRegistrationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    setTimeout(() => void this.processDueSchedules(), 1500);
  }

  async list(userId: string) {
    return this.scheduleModel
      .find({ userId, automationId: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(250)
      .lean();
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

  async listAutomations(userId: string) {
    const rows = await this.automationModel.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
    const ids = rows.map((row) => row._id.toString());
    const stats = ids.length
      ? await this.scheduleModel.aggregate([
          { $match: { userId, automationId: { $in: ids } } },
          { $group: { _id: { automationId: '$automationId', status: '$status' }, count: { $sum: 1 } } },
        ])
      : [];
    const byAutomation = new Map<string, Record<string, number>>();
    for (const item of stats) {
      const automationId = String(item?._id?.automationId ?? '');
      const status = String(item?._id?.status ?? '');
      const current = byAutomation.get(automationId) ?? {};
      current[status] = Number(item.count ?? 0);
      byAutomation.set(automationId, current);
    }
    return rows.map((row) => ({ ...row, stats: byAutomation.get(row._id.toString()) ?? {} }));
  }

  async createAutomation(userId: string, body: Record<string, unknown>) {
    const content = this.automationContent(body);
    const trigger = this.automationTrigger(body.trigger);
    const now = new Date();
    const cursorUpdatedAt = trigger === 'new-subscriber' && body.includeExistingContacts === true ? new Date(0) : now;
    const doc = await this.automationModel.create({
      userId,
      name: this.text(body.name, 160) || `${content.templateName} automation`,
      enabled: body.enabled !== false,
      trigger,
      recipientCategory: this.text(body.recipientCategory, 180) || undefined,
      delayMinutes: this.delayMinutes(body.delayMinutes),
      ...content,
      cursorUpdatedAt,
      cursorContactId: '',
    });
    return doc.toObject();
  }

  async updateAutomation(userId: string, id: string, body: Record<string, unknown>) {
    const automation = await this.automationModel.findOne({ _id: id, userId });
    if (!automation) throw new NotFoundException('Marketing automation not found');
    if (body.name !== undefined) automation.name = this.text(body.name, 160) || automation.name;
    if (body.enabled !== undefined) automation.enabled = body.enabled === true;
    if (body.trigger !== undefined) automation.trigger = this.automationTrigger(body.trigger);
    if (body.recipientCategory !== undefined) automation.recipientCategory = this.text(body.recipientCategory, 180) || undefined;
    if (body.delayMinutes !== undefined) automation.delayMinutes = this.delayMinutes(body.delayMinutes);
    const hasContent = ['templateId', 'templateName', 'subject', 'message', 'previewText', 'footerText', 'eyebrowText', 'buttonText', 'buttonLink', 'buttonColor', 'image', 'showImage', 'collectionId', 'collectionName'].some((key) => body[key] !== undefined);
    if (hasContent) Object.assign(automation, this.automationContent({ ...automation.toObject(), ...body }));
    await automation.save();
    if (body.enabled === false) {
      await this.scheduleModel.updateMany(
        { userId, automationId: id, status: 'scheduled' },
        { $set: { status: 'cancelled', lastError: 'Automation paused before send' } },
      );
    }
    return automation.toObject();
  }

  async removeAutomation(userId: string, id: string) {
    const removed = await this.automationModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!removed) throw new NotFoundException('Marketing automation not found');
    await this.scheduleModel.updateMany(
      { userId, automationId: id, status: 'scheduled' },
      { $set: { status: 'cancelled', lastError: 'Automation deleted before send' } },
    );
    return { deleted: true };
  }

  async queueLifecycleEvent(event: LifecycleAutomationEvent) {
    const recipients = this.emailList(event.recipientEmails);
    if (!recipients.length) return { queued: 0 };
    const automations = await this.automationModel.find({
      userId: event.userId,
      enabled: true,
      trigger: event.trigger,
      $or: [
        { collectionId: { $exists: false } },
        { collectionId: null },
        { collectionId: '' },
        { collectionId: event.collectionId },
      ],
    }).lean();
    if (!automations.length) return { queued: 0 };

    const now = Date.now();
    const operations = automations.flatMap((automation) => recipients.map((recipientEmail) => {
      const eventSuffix = event.eventId ? `:${event.eventId}` : '';
      const automationEventKey = `${automation._id}:${event.trigger}:${event.collectionId}:${recipientEmail}${eventSuffix}`.toLowerCase();
      const delayMinutes = event.trigger === 'client-download' ? 0 : this.delayMinutes(automation.delayMinutes);
      const scheduledAt = new Date(now + delayMinutes * 60_000 + 2000);
      return {
        updateOne: {
          filter: { automationEventKey },
          update: { $setOnInsert: this.lifecycleSchedule(automation, event, recipientEmail, scheduledAt, automationEventKey) },
          upsert: true,
        },
      };
    }));
    const result = await this.scheduleModel.bulkWrite(operations, { ordered: false });
    return { queued: Number(result.upsertedCount ?? 0) };
  }

  async cancel(userId: string, id: string) {
    const doc = await this.scheduleModel.findOneAndUpdate(
      { _id: id, userId, status: { $in: ['scheduled', 'failed'] } },
      { $set: { status: 'cancelled', lastError: '' } },
      { returnDocument: 'after' },
    ).lean();
    if (!doc) throw new NotFoundException('Scheduled campaign not found or cannot be cancelled');
    return doc;
  }

  @Interval(15000)
  async processDueSchedules() {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.enqueueAutomationSchedules();
      const due = await this.scheduleModel.find({ status: 'scheduled', scheduledAt: { $lte: new Date() } }).select('_id').sort({ scheduledAt: 1 }).limit(20).lean();
      for (const item of due) {
        const claimed = await this.scheduleModel.findOneAndUpdate(
          { _id: item._id, status: 'scheduled' },
          { $set: { status: 'sending', lastError: '' } },
          { returnDocument: 'after' },
        );
        if (!claimed) continue;
        await this.deliver(claimed).catch((error) => this.markFailed(claimed._id.toString(), error));
      }
    } finally {
      this.processing = false;
    }
  }

  private async enqueueAutomationSchedules() {
    const automations = await this.automationModel
      .find({ enabled: true, trigger: 'new-subscriber' })
      .sort({ cursorUpdatedAt: 1 })
      .limit(100)
      .lean();
    for (const automation of automations) {
      try {
        await this.enqueueAutomationContacts(automation);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Marketing automation ${automation._id} scan failed: ${message}`);
      }
    }
  }

  private async enqueueAutomationContacts(automation: any) {
    const cursorAt = new Date(automation.cursorUpdatedAt ?? automation.createdAt ?? 0);
    const cursorId = Types.ObjectId.isValid(String(automation.cursorContactId ?? ''))
      ? new Types.ObjectId(String(automation.cursorContactId))
      : null;
    const afterField = (field: 'marketingOptedInAt' | 'createdAt') =>
      cursorId
        ? { $or: [{ [field]: { $gt: cursorAt } }, { [field]: cursorAt, _id: { $gt: cursorId } }] }
        : { [field]: { $gt: cursorAt } };
    const filters: Record<string, unknown>[] = [{
      $or: [
        { $and: [{ marketingOptedInAt: { $exists: true } }, afterField('marketingOptedInAt')] },
        { $and: [{ marketingOptedInAt: { $exists: false } }, afterField('createdAt')] },
      ],
    }];
    if (automation.recipientCategory) {
      filters.push({
        $or: [
          { collectionName: automation.recipientCategory },
          { lastSource: automation.recipientCategory },
          { sources: automation.recipientCategory },
        ],
      });
    }
    const contacts = await this.contactModel
      .find({ ownerId: automation.userId, marketingOptIn: true, $and: filters })
      .sort({ marketingOptedInAt: 1, createdAt: 1, _id: 1 })
      .limit(250)
      .lean();
    if (!contacts.length) return;

    const uniqueContacts = [...new Map(
      contacts
        .map((contact) => [String(contact.email ?? '').trim().toLowerCase(), contact] as const)
        .filter(([email]) => isValidEmail(email)),
    ).values()];
    const delayMs = this.delayMinutes(automation.delayMinutes) * 60_000;
    const operations = uniqueContacts.map((contact) => {
      const contactTime = new Date(contact.marketingOptedInAt ?? contact.createdAt ?? Date.now()).getTime();
      const scheduledAt = new Date(Math.max(Date.now() + 2000, contactTime + delayMs));
      const recipientEmail = String(contact.email ?? '').trim().toLowerCase();
      return {
        updateOne: {
          filter: { automationId: String(automation._id), automationRecipientEmail: recipientEmail },
          update: { $setOnInsert: this.automationSchedule(automation, contact, scheduledAt) },
          upsert: true,
        },
      };
    });
    await this.scheduleModel.bulkWrite(operations, { ordered: false });
    const last = contacts[contacts.length - 1];
    const lastOptInAt = new Date(last.marketingOptedInAt ?? last.createdAt ?? Date.now());
    await this.automationModel.updateOne(
      { _id: automation._id, enabled: true },
      { $set: { cursorUpdatedAt: lastOptInAt, cursorContactId: String(last._id) } },
    );
  }

  private async deliver(schedule: MarketingEmailScheduleDocument) {
    let recipients: string[];
    if (schedule.subscriptionRequired !== false) {
      const subscribed = await this.contactModel.find({
        ownerId: schedule.userId,
        marketingOptIn: true,
        email: { $in: schedule.recipientEmails },
      }).select('email').lean();
      recipients = [...new Set(subscribed.map((item) => item.email.toLowerCase()))];
    } else {
      recipients = this.emailList(schedule.recipientEmails);
    }
    if (!recipients.length) {
      if (schedule.automationId) {
        await this.scheduleModel.updateOne(
          { _id: schedule._id },
          { $set: { status: 'cancelled', lastError: schedule.subscriptionRequired !== false ? 'Contact unsubscribed before automated send' : 'Lifecycle email has no valid recipient' } },
        );
        return;
      }
      throw new Error('No valid recipients remain before the scheduled send');
    }

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

  private automationContent(body: Record<string, unknown>) {
    const subject = this.text(body.subject, 220);
    const message = this.text(body.message, 12000);
    const previewText = this.text(body.previewText, 500);
    if (!subject) throw new BadRequestException('Automation email subject is required');
    if (!message && !previewText) throw new BadRequestException('Automation email message is required');
    return {
      templateId: this.text(body.templateId, 180) || 'custom',
      templateName: this.text(body.templateName, 180) || 'Automated email',
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
    };
  }

  private automationSchedule(automation: any, contact: any, scheduledAt: Date) {
    return {
      userId: String(automation.userId),
      name: `${this.text(automation.name, 120)} - ${String(contact.email).toLowerCase()}`.slice(0, 160),
      status: 'scheduled' as const,
      recipientMode: 'contacts' as const,
      recipientEmails: [String(contact.email).toLowerCase()],
      recipientCategory: automation.recipientCategory || undefined,
      automationId: String(automation._id),
      automationContactId: String(contact._id),
      automationRecipientEmail: String(contact.email ?? '').trim().toLowerCase(),
      subscriptionRequired: true,
      templateId: automation.templateId,
      templateName: automation.templateName,
      subject: automation.subject,
      previewText: automation.previewText || '',
      message: automation.message || '',
      footerText: automation.footerText || '',
      eyebrowText: automation.eyebrowText || '',
      buttonText: automation.buttonText || '',
      buttonLink: automation.buttonLink || '',
      buttonColor: automation.buttonColor || '#444444',
      image: automation.image || '',
      showImage: automation.showImage !== false,
      collectionId: automation.collectionId || undefined,
      collectionName: automation.collectionName || undefined,
      scheduledAt,
      scheduledLocal: scheduledAt.toISOString().slice(0, 16),
      timeZone: 'UTC',
      recipientsCount: 1,
      lastError: '',
    };
  }

  private lifecycleSchedule(automation: any, event: LifecycleAutomationEvent, recipientEmail: string, scheduledAt: Date, automationEventKey: string) {
    const render = (value: unknown, max: number) => this.renderLifecycleText(this.text(value, max), event, recipientEmail);
    const automationLink = this.text(automation.buttonLink, 1500);
    const buttonLink = event.trigger === 'client-download'
      ? this.text(event.buttonLink, 1500)
      : !automationLink || automationLink === 'Collection URL'
        ? this.text(event.buttonLink, 1500)
        : automationLink;
    const buttonText = render(automation.buttonText, 160) || (event.trigger === 'client-download' ? 'Download photos' : '');
    return {
      userId: String(event.userId),
      name: `${this.text(automation.name, 120)} - ${recipientEmail}`.slice(0, 160),
      status: 'scheduled' as const,
      recipientMode: 'contacts' as const,
      recipientEmails: [recipientEmail],
      automationId: String(automation._id),
      automationEventKey,
      subscriptionRequired: false,
      templateId: automation.templateId,
      templateName: automation.templateName,
      subject: render(automation.subject, 220),
      previewText: render(automation.previewText, 500),
      message: render(automation.message, 12000),
      footerText: render(automation.footerText, 3000),
      eyebrowText: render(automation.eyebrowText, 160),
      buttonText,
      buttonLink,
      buttonColor: automation.buttonColor || '#444444',
      image: automation.image || '',
      showImage: automation.showImage !== false,
      collectionId: event.collectionId,
      collectionName: event.collectionName,
      scheduledAt,
      scheduledLocal: scheduledAt.toISOString().slice(0, 16),
      timeZone: 'UTC',
      recipientsCount: 1,
      lastError: '',
    };
  }

  private renderLifecycleText(value: string, event: LifecycleAutomationEvent, recipientEmail: string) {
    const eventLabel: Record<LifecycleAutomationEvent['trigger'], string> = {
      'gallery-published': 'Gallery published',
      'client-download': 'Download ready',
      'client-favorite': 'Favorite added',
    };
    return value
      .replace(/{{\s*galleryName\s*}}/gi, event.collectionName)
      .replace(/{{\s*clientEmail\s*}}/gi, recipientEmail)
      .replace(/{{\s*event\s*}}/gi, eventLabel[event.trigger]);
  }

  private delayMinutes(value: unknown) {
    const parsed = Math.floor(Number(value ?? 0));
    return Number.isFinite(parsed) ? Math.min(525600, Math.max(0, parsed)) : 0;
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

  private automationTrigger(value: unknown): MarketingAutomationTrigger {
    const trigger = this.text(value, 40) as MarketingAutomationTrigger;
    return ['new-subscriber', 'gallery-published', 'client-download', 'client-favorite'].includes(trigger)
      ? trigger
      : 'new-subscriber';
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  return `<div dir="auto" style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:32px;color:#202326;line-height:1.7">${schedule.previewText ? `<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(schedule.previewText)}</span>` : ''}${schedule.eyebrowText ? `<p style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#777">${escapeHtml(schedule.eyebrowText)}</p>` : ''}${image}<div style="white-space:pre-line">${escapeHtml(schedule.message)}</div>${button}${schedule.footerText ? `<div style="margin-top:34px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#777;white-space:pre-line">${escapeHtml(schedule.footerText)}</div>` : ''}</div>`;
}

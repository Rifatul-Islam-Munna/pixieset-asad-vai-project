import { BadRequestException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { StudioRecord, StudioRecordDocument } from '../studio/studio-record.entity';
import { Homepage, HomepageDocument } from 'src/homepage/entities/homepage.entity';
import { StudioSubscriptionService } from '../studio/studio-subscription.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  constructor(
    @InjectModel(BookingSetting.name) private readonly settingModel: Model<BookingSettingDocument>,
    @InjectModel(BookingService.name) private readonly serviceModel: Model<BookingServiceDocument>,
    @InjectModel(BookingCoworker.name) private readonly coworkerModel: Model<BookingCoworkerDocument>,
    @InjectModel(BookingEvent.name) private readonly eventModel: Model<BookingEventDocument>,
    @InjectModel(BookingShareLink.name) private readonly shareLinkModel: Model<BookingShareLinkDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @InjectModel(StudioRecord.name) private readonly studioRecordModel: Model<StudioRecordDocument>,
    @InjectModel(Homepage.name) private readonly homepageModel: Model<HomepageDocument>,
    private readonly subscriptions?:StudioSubscriptionService,
  ) {}

  async overview(userId: string, from?: string, to?: string) {
    const settings = await this.ensureSettings(userId);
    const owner = await this.userModel.findById(userId).select('_id username name businessName email avatar website businessAddress phoneNumber').lean();
    if (!owner) throw new NotFoundException('Account not found');
    const start = this.safeDate(from) ?? new Date(Date.now() - 45 * 86400000);
    const end = this.safeDate(to) ?? new Date(Date.now() + 370 * 86400000);
    const [services, coworkers, events, shareLinks, homepage] = await Promise.all([
      this.serviceModel.find({ userId }).sort({ active: -1, createdAt: 1 }).lean(),
      this.coworkerModel.find({ userId }).sort({ active: -1, name: 1 }).lean(),
      this.eventModel.find({ userId, startAt: { $lt: end }, endAt: { $gt: start } }).sort({ startAt: 1 }).lean(),
      this.shareLinkModel.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
      this.homepageModel.findOne({ userId }).select('brandName logoUrl website email phone address socialLinks').lean(),
    ]);
    const publicIdentifier = owner.username || owner._id.toString();
    return {
      settings,
      services,
      coworkers,
      events,
      shareLinks: shareLinks.map((item) => ({ ...item, url: this.shareLinkUrl(publicIdentifier, item.token) })),
      publicIdentifier,
      owner: {
        name: homepage?.brandName || owner.businessName || owner.name,
        username: owner.username,
        avatar: homepage?.logoUrl || owner.avatar,
        website: homepage?.website || owner.website || '',
        email: homepage?.email || owner.email || '',
        phoneNumber: homepage?.phone || owner.phoneNumber || '',
        businessAddress: homepage?.address || owner.businessAddress || '',
        socialLinks: homepage?.socialLinks || {},
      },
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
    if (body.welcomeMessage !== undefined) patch.welcomeMessage = this.text(body.welcomeMessage, 500) || 'Welcome to my booking site. Please follow the instructions to book a session.';
    for (const field of ['showSocialLinks', 'showWebsite', 'showContactEmail', 'showPhoneNumber', 'showBusinessAddress']) {
      if (body[field] !== undefined) patch[field] = this.bool(body[field]);
    }
    if (Array.isArray(body.businessHours)) patch.businessHours = this.businessHours(body.businessHours);
    return this.settingModel.findOneAndUpdate({ userId }, { $set: patch }, { returnDocument: 'after', upsert: true }).lean();
  }

  private async sendStudioEmail(userId: string, payload: { to: string; subject: string; text: string; replyTo?: string }, meta: { sourceKind: string; sourceId?: string; sourceTitle?: string }) {
    const attemptedAt = new Date().toISOString();
    const log = await this.studioRecordModel.create({
      userId, kind: 'messages', title: payload.subject, status: 'sending', type: 'outbound',
      email: payload.to, description: payload.text,
      details: { channel: 'smtp', sourceKind: meta.sourceKind, sourceId: meta.sourceId || '',
        sourceTitle: meta.sourceTitle || '', attemptedAt, smtpStatus: 'sending' },
    });
    let reservation:string|undefined;
    try {
      reservation=await this.subscriptions?.reserveEmail(userId);
      const result = await this.mailService.send(payload);
      if (!result.sent && reservation) { await this.subscriptions?.releaseEmail(userId,reservation); reservation=undefined; }
      log.status = result.sent ? 'sent' : 'failed';
      log.details = { ...log.details, smtpStatus: result.sent ? 'accepted' : 'failed',
        acceptedBySmtp: Boolean(result.sent), messageId: result.messageId || '',
        ...(result.sent ? { sentAt: new Date().toISOString() } : { error: result.reason || 'SMTP_SEND_FAILED', failedAt: new Date().toISOString() }) };
      await log.save().catch((error) => this.logger.error('Could not update Studio email log ' + String(log._id) + ': ' + (error instanceof Error ? error.message : String(error))));
      return result;
    } catch (error) {
      if (reservation) await this.subscriptions?.releaseEmail(userId,reservation);
      const reason = error instanceof Error ? error.message : 'SMTP_SEND_FAILED';
      log.status = 'failed';
      log.details = { ...log.details, smtpStatus: 'failed', error: reason, failedAt: new Date().toISOString() };
      await log.save().catch(() => undefined);
      this.logger.error('Studio email failed for ' + payload.to + ': ' + reason);
      return { sent: false, reason: error instanceof BadRequestException ? reason : 'SMTP_SEND_FAILED', messageId: '' };
    }
  }

  async createShareLink(userId: string, body: Record<string, unknown>) {
    const owner = await this.userModel
      .findById(userId)
      .select('_id username name businessName email')
      .lean();
    if (!owner) throw new NotFoundException('Account not found');

    let recipientName = this.text(body.recipientName, 120);
    const rawRecipientEmail = this.text(body.recipientEmail, 180);
    let recipientEmail = rawRecipientEmail ? this.email(rawRecipientEmail) : '';
    if (rawRecipientEmail && !recipientEmail)
      throw new BadRequestException('Enter a valid recipient email');
    const contactId = this.text(body.contactId, 80);
    if (contactId) {
      this.objectId(contactId, 'Client contact');
      const contact = await this.studioRecordModel
        .findOne({ _id: contactId, userId, kind: 'contacts' })
        .select('_id title email')
        .lean();
      if (!contact) throw new NotFoundException('Client contact not found');
      recipientName = this.text(contact.title, 120) || recipientName;
      // Prefer the saved contact email. If the contact has none, allow the owner to supply one for this invitation.
      recipientEmail = this.email(contact.email) || recipientEmail;
      if (!recipientEmail) throw new BadRequestException('Add an email address to this contact before creating an invitation');
    }
    const shouldSendEmail = this.bool(body.sendEmail);
    if (shouldSendEmail && !recipientEmail)
      throw new BadRequestException('Enter the client email address before sending the invitation');

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
      contactId,
      serviceId,
      serviceName,
      expiresAt,
      bookingEventId: '',
    });
    const identifier = owner.username || owner._id.toString();
    const url = this.shareLinkUrl(identifier, token, body.frontendOrigin);
    let emailSent = false;
    let emailError = '';
    if (shouldSendEmail && recipientEmail) {
      const business = owner.businessName || owner.name || 'Studio';
      const expiryText = expiresAt.toLocaleString();
      const result = await this.sendStudioEmail(userId, {
        to: recipientEmail,
        replyTo: this.email(owner.email) || undefined,
        subject: `${business}: booking invitation`,
        text: `${recipientName ? `Hi ${recipientName},\n\n` : ''}${business} invited you to book${serviceName ? ` ${serviceName}` : ' a session'}.\n\nBook here: ${url}\n\nThis private link expires ${expiryText} and can be used for one booking.`,
      }, { sourceKind: 'booking-invitation', sourceId: String(link._id), sourceTitle: serviceName || 'Private booking invitation' });
      emailSent = Boolean(result.sent);
      emailError = result.sent ? '' : result.reason || 'SMTP_SEND_FAILED';
    }
    return { ...link.toObject(), url, emailSent, emailError };
  }

  async sendShareLinkEmail(userId: string, id: string, requestedOrigin?: string) {
    this.objectId(id, 'Booking link');
    const link = await this.shareLinkModel.findOne({ _id: id, userId }).lean();
    if (!link) throw new NotFoundException('Booking invitation not found');
    if (!link.recipientEmail) throw new BadRequestException('This invitation has no client email address');
    if (link.bookingEventId) throw new BadRequestException('This invitation has already been used');
    if (new Date(link.expiresAt).getTime() <= Date.now()) throw new BadRequestException('This invitation has expired');
    const owner = await this.userModel.findById(userId).select('_id username name businessName email').lean();
    if (!owner) throw new NotFoundException('Account not found');
    const recipientEmail = this.email(link.recipientEmail);
    if (!recipientEmail) throw new BadRequestException('The saved client email address is invalid');
    const identifier = owner.username || owner._id.toString();
    const url = this.shareLinkUrl(identifier, link.token, requestedOrigin);
    const business = owner.businessName || owner.name || 'Studio';
    const expiryText = new Date(link.expiresAt).toLocaleString();
    const result = await this.sendStudioEmail(userId, {
      to: recipientEmail,
      replyTo: this.email(owner.email) || undefined,
      subject: `${business}: booking invitation`,
      text: (link.recipientName ? 'Hi ' + link.recipientName + ',' + String.fromCharCode(10) + String.fromCharCode(10) : '') +
        business + ' invited you to book ' + (link.serviceName || 'a session') + '.' +
        String.fromCharCode(10) + String.fromCharCode(10) + 'Book here: ' + url +
        String.fromCharCode(10) + String.fromCharCode(10) +
        'This private link expires ' + expiryText + ' and can be used for one booking.',
    }, { sourceKind: 'booking-invitation', sourceId: id, sourceTitle: link.serviceName || 'Private booking invitation' });
    return { emailSent: Boolean(result.sent), emailError: result.sent ? '' : result.reason || 'SMTP_SEND_FAILED', messageId: result.messageId || '', url };
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
    const createService = async()=>this.serviceModel.create({userId,...data});
    const created = this.subscriptions ? await this.subscriptions.withRecordQuota(userId,'products',createService) : await createService();
    return created.toObject();
  }

  async updateService(userId: string, id: string, body: Record<string, unknown>) {
    this.objectId(id, 'Booking type');
    const data = this.servicePayload(body, true);
    const item = await this.serviceModel.findOneAndUpdate({ _id: id, userId }, { $set: data }, { returnDocument: 'after' }).lean();
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
    const item = await this.coworkerModel.findOneAndUpdate({ _id: id, userId }, { $set: data }, { returnDocument: 'after' }).lean();
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
    if (body.projectId) {
      const projectId = String(body.projectId);
      this.objectId(projectId, 'Project');
      if (!(await this.studioRecordModel.exists({ userId, kind: 'projects', _id: projectId })))
        throw new BadRequestException('Selected project does not belong to this studio');
      data.projectId = projectId;
    }
    if (body.contactId) {
      const contactId = String(body.contactId);
      this.objectId(contactId, 'Contact');
      if (!(await this.studioRecordModel.exists({ userId, kind: 'contacts', _id: contactId })))
        throw new BadRequestException('Selected contact does not belong to this studio');
      data.contactId = contactId;
    }
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
    const updated = await this.eventModel.findOneAndUpdate(
      { _id: id, userId }, { $set: data }, { returnDocument: 'after' },
    ).lean();
    if (updated?.projectId && data.status !== undefined) {
      const next = data.status === 'confirmed' ? 'booked' :
        data.status === 'completed' ? 'completed' :
        data.status === 'cancelled' ? 'cancelled' : 'inquiry';
      await this.studioRecordModel.updateOne(
        { _id: updated.projectId, userId, kind: 'projects',
          'details.bookingEventId': id },
        { $set: { status: next } },
      ).catch((error) => this.logger.warn('Project stage sync failed: ' + String(error)));
      if (data.status === 'confirmed' && updated.contactId) {
        await this.studioRecordModel.updateOne(
          { _id: updated.contactId, userId, kind: 'contacts', status: 'lead' },
          { $set: { status: 'client' } },
        ).catch((error) => this.logger.warn('Contact status sync failed: ' + String(error)));
      }
    }
    return updated;
  }

  async deleteEvent(userId: string, id: string) {
    this.objectId(id, 'Event');
    const item = await this.eventModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!item) throw new NotFoundException('Event not found');
    if (item.projectId) await this.studioRecordModel.updateOne(
      { _id: item.projectId, userId, kind: 'projects', 'details.bookingEventId': id },
      { $set: { status: 'cancelled' } },
    ).catch((error) => this.logger.warn('Deleted-booking project sync failed: ' + String(error)));
    return { deleted: true, id };
  }

  async publicDetails(identifier: string, inviteToken?: string, requestedServiceId?: string) {
    const owner = await this.resolveOwner(identifier);
    const userId = owner._id.toString();
    const settings = await this.ensureSettings(userId);
    const invite = inviteToken ? await this.resolveShareLink(userId, inviteToken) : null;
    if (requestedServiceId && !Types.ObjectId.isValid(requestedServiceId))
      throw new BadRequestException('This session link is invalid');
    if (invite?.serviceId && requestedServiceId && String(invite.serviceId) !== String(requestedServiceId))
      throw new BadRequestException('This private link is for a different booking type');
    const serviceQuery: Record<string, unknown> = { userId, active: true, status: 'published' };
    if (invite?.serviceId) serviceQuery._id = invite.serviceId;
    else {
      serviceQuery.bookingVisibility = { $ne: 'private' };
      if (requestedServiceId) serviceQuery._id = requestedServiceId;
    }
    const services = await this.serviceModel
      .find(serviceQuery)
      .select('_id name description durationMinutes price currency location sessionStyle coverImageUrl bookingVisibility intakeFields paymentPolicy bookingRules confirmationMessage sessionColor timezone')
      .sort({ createdAt: 1 })
      .lean();
    if (requestedServiceId && !services.length)
      throw new NotFoundException('This session is not published or is no longer available');
    const homepage = await this.homepageModel.findOne({ userId }).select('brandName logoUrl website email phone address socialLinks').lean();
    return {
      owner: {
        name: homepage?.brandName || owner.businessName || owner.name,
        avatar: homepage?.logoUrl || owner.avatar,
        website: homepage?.website || owner.website,
        email: homepage?.email || owner.email,
        phoneNumber: homepage?.phone || owner.phoneNumber,
        businessAddress: homepage?.address || owner.businessAddress,
      },
      profile: { socialLinks: homepage?.socialLinks || {} },
      settings: {
        timezone: settings.timezone,
        minNoticeHours: settings.minNoticeHours,
        maxAdvanceDays: settings.maxAdvanceDays,
        confirmationMessage: settings.confirmationMessage,
        welcomeMessage: settings.welcomeMessage,
        showSocialLinks: settings.showSocialLinks,
        showWebsite: settings.showWebsite,
        showContactEmail: settings.showContactEmail,
        showPhoneNumber: settings.showPhoneNumber,
        showBusinessAddress: settings.showBusinessAddress,
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
    const invite = inviteToken ? await this.resolveShareLink(userId, inviteToken) : null;

    if (!serviceId || !Types.ObjectId.isValid(serviceId)) throw new BadRequestException('Booking type is required');
    if (invite?.serviceId && invite.serviceId !== serviceId)
      throw new BadRequestException('This private link is for a different booking type');
    const service = await this.serviceModel.findOne({ _id: serviceId, userId, active: true }).lean();
    if (!service) throw new NotFoundException('Booking type not found');
    if (service.bookingVisibility === 'private' &&
        (!invite?.serviceId || String(invite.serviceId) !== String(service._id)))
      throw new NotFoundException('This booking type requires a matching private invitation');
    const targetDate = this.dateText(date);
    const slots = await this.availableSlots(userId, settings, service, targetDate);
    return {
      date: targetDate,
      timezone: service.timezone || settings.timezone,
      slots: slots.map((slot) => ({ startAt: slot.startAt.toISOString(), endAt: slot.endAt.toISOString() })),
    };
  }

  async createPublicBooking(identifier: string, body: Record<string, unknown>) {
    const owner = await this.resolveOwner(identifier);
    const userId = owner._id.toString();
    const settings = await this.ensureSettings(userId);
    const inviteToken = this.text(body.inviteToken, 100);
    const invite = inviteToken ? await this.resolveShareLink(userId, inviteToken) : null;

    const serviceId = this.text(body.serviceId, 80);
    if (!Types.ObjectId.isValid(serviceId)) throw new BadRequestException('Booking type is required');
    if (invite?.serviceId && invite.serviceId !== serviceId)
      throw new BadRequestException('This private link is for a different booking type');
    const service = await this.serviceModel.findOne({ _id: serviceId, userId, active: true }).lean();
    if (!service) throw new NotFoundException('Booking type not found');
    if (service.bookingVisibility === 'private' &&
        (!invite?.serviceId || String(invite.serviceId) !== String(service._id)))
      throw new NotFoundException('This booking type requires a matching private invitation');
    const clientName = this.text(body.clientName, 120);
    const clientEmail = this.email(body.clientEmail);
    if (!clientName) throw new BadRequestException('Your name is required');
    if (!clientEmail) throw new BadRequestException('A valid email is required');
    const questions = Array.isArray(service.intakeFields) ? service.intakeFields.slice(0, 30) : [];
    const posted = body.intakeResponses && typeof body.intakeResponses === 'object' && !Array.isArray(body.intakeResponses)
      ? body.intakeResponses as Record<string, unknown> : {};
    const intakeResponses: Record<string, string> = {};
    for (const question of questions) {
      const key = this.text(question.name, 70);
      if (!/^[a-zA-Z0-9_-]{1,70}$/.test(key)) continue;
      const value = this.text(posted[key], 1000);
      if (question.required && !value) throw new BadRequestException('Required question: ' + this.text(question.label, 100));
      intakeResponses[key] = value;
    }
    if (invite?.recipientEmail && invite.recipientEmail !== clientEmail)
      throw new BadRequestException('Use the email address this private booking link was sent to');
    const requestedStart = this.safeDate(body.startAt);
    const date = this.dateText(body.date);
    if (!requestedStart) throw new BadRequestException('Please choose an available time');
    const slots = await this.availableSlots(userId, settings, service, date);
    const selected = slots.find((slot) => Math.abs(slot.startAt.getTime() - requestedStart.getTime()) < 1000);
    if (!selected) throw new BadRequestException('That time is no longer available. Please choose another time.');
    const status = (service.bookingRules?.autoConfirm ?? settings.autoConfirm) ? 'confirmed' : 'pending';
    let claimedInviteId = '';
    if (invite) {
      const claimed = await this.shareLinkModel.findOneAndUpdate(
        { _id: invite._id, userId, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
        { $set: { usedAt: new Date() } },
        { returnDocument: 'after' },
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
        intakeResponses,
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
    try {
      await this.linkPublicBookingToStudio(userId, event, service, clientName, clientEmail, status);
    } catch (error) {
      // A CRM outage must not turn an already accepted booking into a client-facing failure.
      this.logger.warn('Booking was saved, but Studio Manager contact/project sync failed: ' +
        (error instanceof Error ? error.message : 'unknown error'));
    }
    void this.sendBookingEmails(owner, event.toObject(), service.timezone || settings.timezone).catch((error) => {
      this.logger.error('Booking email workflow failed: ' + (error instanceof Error ? error.message : String(error)));
    });
    return {
      event: event.toObject(),
      status,
      confirmationMessage: service.confirmationMessage || settings.confirmationMessage,
    };
  }

  private async linkPublicBookingToStudio(
    userId: string, event: BookingEventDocument, service: BookingServiceDocument | any,
    clientName: string, clientEmail: string, status: string,
  ) {
    const getContact=async()=>{
      if (this.subscriptions && !(await this.studioRecordModel.exists({userId,kind:'contacts',email:clientEmail}))) await this.subscriptions.assertRecord(userId,'contacts');
      return this.studioRecordModel.findOneAndUpdate(
      { userId, kind: 'contacts', email: clientEmail },
      { $setOnInsert: {
        userId, kind: 'contacts', title: clientName,
        status: status === 'confirmed' ? 'client' : 'lead',
        type: 'booking', email: clientEmail, phone: event.clientPhone || '',
        details: { source: 'public-booking', firstBookingEventId: String(event._id) },
      } },
      { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' },
      ).lean();
    };
    const contact = this.subscriptions ? await this.subscriptions.withRecordLock(userId,getContact) : await getContact();
    if (!contact) throw new Error('Booking contact could not be found');
    if (status === 'confirmed' && contact.status === 'lead')
      await this.studioRecordModel.updateOne({ _id: contact._id, userId, kind: 'contacts', status: 'lead' },
        { $set: { status: 'client' } });
    let projectId = '';
    if (service.createProjectOnBooking !== false) {
      const createProject=async()=>this.studioRecordModel.create({
        userId, kind: 'projects', title: service.name + ' — ' + clientName,
        status: status === 'confirmed' ? 'booked' : (service.projectStage || 'inquiry'),
        type: service.projectType || 'portrait', contactId: String(contact._id), date: event.startAt,
        description: 'Created from an online studio booking.',
        details: { source: 'public-booking', bookingEventId: String(event._id), serviceId: String(service._id) },
      });
      const project = this.subscriptions ? await this.subscriptions.withRecordQuota(userId,'projects',createProject) : await createProject();
      projectId = String(project._id);
    }
    const eventLink: Record<string, string> = { contactId: String(contact._id) };
    if (projectId) eventLink.projectId = projectId;
    await this.eventModel.updateOne({ _id: event._id, userId }, { $set: eventLink });
  }

  private async availableSlots(userId: string, settings: any, service: any, date: string) {
    const timeZone = this.safeTimeZone(service.timezone || settings.timezone);
    const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const allSpecificDates = Array.isArray(service.sessionDates) ? service.sessionDates : [];
    const specificDates = allSpecificDates.filter((item: any) => item.date === date);
    // Specific dates make this a date-limited session. Otherwise use this session's own weekly hours.
    // Fall back to studio hours only for legacy sessions that have never stored their own schedule.
    const schedule: BookingBusinessHour[] = Array.isArray(service.availability) && service.availability.length
      ? service.availability : settings.businessHours;
    const hours = schedule.find((item) => Number(item.day) === day);
    const windows = allSpecificDates.length
      ? specificDates.map((item: any) => ({ open: timeToMinutes(item.start), close: timeToMinutes(item.end) }))
      : hours?.enabled ? [{ open: timeToMinutes(hours.start), close: timeToMinutes(hours.end) }] : [];
    const validWindows = windows.filter((window) => window.open >= 0 && window.close > window.open);
    if (!validWindows.length) return [];
    const duration = Math.max(15, Number(service.durationMinutes || 60));
    const interval = Math.max(5, Number(service.bookingRules?.slotIntervalMinutes ?? settings.slotIntervalMinutes ?? 30));
    if (!validWindows.some((window) => window.close - window.open >= duration)) return [];

    const candidateIds = Array.isArray(service.coworkerIds) ? service.coworkerIds.filter((id: string) => Types.ObjectId.isValid(id)) : [];
    const coworkerQuery: Record<string, unknown> = { userId, active: true };
    if (candidateIds.length) coworkerQuery._id = { $in: candidateIds };
    const coworkers = await this.coworkerModel.find(coworkerQuery).select('_id').lean();
    const resources = coworkers.map((item) => item._id.toString());

    const firstStart = wallTimeToUtc(date, minutesToTime(Math.min(...validWindows.map((window) => window.open))), timeZone);
    const lastEnd = wallTimeToUtc(date, minutesToTime(Math.max(...validWindows.map((window) => window.close))), timeZone);
    const events = await this.eventModel.find({
      userId,
      status: { $ne: 'cancelled' },
      startAt: { $lt: new Date(lastEnd.getTime() + 86400000) },
      endAt: { $gt: new Date(firstStart.getTime() - 86400000) },
    }).select('startAt endAt coworkerIds').lean();

    const minStart = Date.now() + Math.max(0, Number(service.bookingRules?.minNoticeHours ?? settings.minNoticeHours ?? 0)) * 3600000;
    const maxStart = Date.now() + Math.max(1, Number(service.bookingRules?.maxAdvanceDays ?? settings.maxAdvanceDays ?? 90)) * 86400000;
    const slots: Array<{ startAt: Date; endAt: Date; resourceId: string | null }> = [];
    const seenStarts = new Set<string>();
    for (const window of validWindows) {
      for (let cursor = window.open; cursor + duration <= window.close; cursor += interval) {
        const startAt = wallTimeToUtc(date, minutesToTime(cursor), timeZone);
        const endAt = new Date(startAt.getTime() + duration * 60000);
        const startKey = startAt.toISOString();
        if (seenStarts.has(startKey) || startAt.getTime() < minStart || startAt.getTime() > maxStart) continue;
        seenStarts.add(startKey);
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
    const eventId = String(event._id || event.id || '');
    if (ownerEmail) sends.push(this.sendStudioEmail(String(owner._id), {
      to: ownerEmail, replyTo: clientEmail,
      subject: `New booking - ${event.serviceName} - ${event.clientName}`, text,
    }, { sourceKind: 'booking-notification', sourceId: eventId, sourceTitle: event.serviceName || 'New booking' }));
    if (clientEmail) sends.push(this.sendStudioEmail(String(owner._id), {
      to: clientEmail, replyTo: ownerEmail || undefined,
      subject: `${business}: ${subject}`,
      text: `${business}\n\n${text}\n\n${event.status === 'confirmed' ? 'Your booking is confirmed.' : 'Your request is pending confirmation.'}`,
    }, { sourceKind: 'booking-confirmation', sourceId: eventId, sourceTitle: event.serviceName || 'Booking update' }));
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
      .select('_id username name businessName email avatar website phoneNumber businessAddress')
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

  private shareLinkUrl(identifier: string, token: string, requestedOrigin?: unknown) {
    const configuredBase = String(
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('PUBLIC_APP_URL') ||
      'https://gallerista.app',
    ).replace(/\/$/, '');
    const rootDomain = String(this.configService.get<string>('STUDIO_PUBLIC_ROOT_DOMAIN') || this.configService.get<string>('ROOT_DOMAIN') || '').trim().replace('https://', '').replace('http://', '').split('/')[0].split(':')[0].toLowerCase();
    const requested = this.safeFrontendOrigin(requestedOrigin, configuredBase);
    const requestedHost = requested ? new URL(requested).hostname.toLowerCase() : '';
    const localRequest = requestedHost === 'localhost' || requestedHost === '127.0.0.1';
    const tenantBase = rootDomain && rootDomain !== 'localhost' && rootDomain !== '127.0.0.1' ? 'https://' + identifier + '.' + rootDomain : '';
    const base = localRequest ? requested : tenantBase || requested || configuredBase;
    const path = '/book/' + encodeURIComponent(identifier);
    return base + path + '?invite=' + encodeURIComponent(token);
  }

  private safeFrontendOrigin(value: unknown, configuredBase: string) {
    try {
      const candidate = new URL(String(value || ''));
      if (!['http:', 'https:'].includes(candidate.protocol)) return '';
      const host = candidate.hostname.toLowerCase();
      if (candidate.protocol === 'http:' && host !== 'localhost' && host !== '127.0.0.1') return '';
      const allowedHosts = [
        'gallerista.app',
        new URL(configuredBase).hostname.toLowerCase(),
        String(this.configService.get<string>('STUDIO_PUBLIC_ROOT_DOMAIN') || this.configService.get<string>('ROOT_DOMAIN') || '').replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase(),
      ].filter(Boolean);
      if (!allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return '';
      return candidate.origin;
    } catch {
      return '';
    }
  }

  private servicePayload(body: Record<string, unknown>, partial = false) {
    const data: Record<string, unknown> = {};
    const set = (key: string, value: unknown) => { if (!partial || body[key] !== undefined) data[key] = value; };
    set('name', this.text(body.name, 120));
    set('status', body.status === undefined
      ? (body.active === false ? 'draft' : 'published')
      : (body.status === 'published' ? 'published' : 'draft'));
    set('description', this.text(body.description, 1600));
    set('sessionStyle', body.sessionStyle === 'mini' ? 'mini' : 'full');
    set('coverImageUrl', this.text(body.coverImageUrl, 500));
    set('bookingVisibility', body.bookingVisibility === 'private' ? 'private' : 'public');
    if (!partial || body.timezone !== undefined) set('timezone', this.safeTimeZone(body.timezone || 'UTC'));
    if (!partial || body.availability !== undefined) {
      set('availability', Array.isArray(body.availability) && body.availability.length
        ? this.businessHours(body.availability) : []);
    }
    if (!partial || body.sessionDates !== undefined) {
      const used = new Set<string>();
      const dates = Array.isArray(body.sessionDates) ? body.sessionDates.slice(0, 100) : [];
      const sanitized = dates.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const date = this.text(row.date, 10);
        const start = this.text(row.start, 5);
        const end = this.text(row.end, 5);
        const parsedDate = this.safeDate(date + 'T12:00:00.000Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parsedDate || parsedDate.toISOString().slice(0, 10) !== date ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start) {
          throw new BadRequestException('Each session date needs a valid date and end time after its start time');
        }
        const key = date + ':' + start;
        if (used.has(key)) throw new BadRequestException('Session dates cannot contain duplicate start times');
        used.add(key);
        return { date, start, end };
      });
      set('sessionDates', sanitized);
    }
    if (!partial || body.intakeFields !== undefined) {
      const fields = Array.isArray(body.intakeFields) ? body.intakeFields.slice(0, 30) : [];
      const used = new Set<string>();
      const sanitized = fields.map((item) => {
        const field = (item ?? {}) as Record<string, unknown>;
        const label = this.text(field.label, 140);
        const name = this.text(field.name, 70).replace(/[^a-zA-Z0-9_-]/g, '-');
        if (!label || !name || used.has(name)) throw new BadRequestException('Booking intake questions need unique labels and keys');
        used.add(name);
        return { name, label, type: ['text', 'textarea', 'select', 'date'].includes(String(field.type)) ? String(field.type) : 'text',
          required: this.bool(field.required), options: this.text(field.options, 500) };
      });
      set('intakeFields', sanitized);
    }
    set('paymentPolicy', body.paymentPolicy === 'manual' ? 'manual' : 'none');
    set('bookingRules', body.bookingRules && typeof body.bookingRules === 'object' && !Array.isArray(body.bookingRules)
      ? {
        minNoticeHours: this.clampNumber((body.bookingRules as Record<string, unknown>).minNoticeHours, 0, 720, 1),
        maxAdvanceDays: this.clampNumber((body.bookingRules as Record<string, unknown>).maxAdvanceDays, 1, 730, 180),
        slotIntervalMinutes: this.clampNumber((body.bookingRules as Record<string, unknown>).slotIntervalMinutes, 5, 240, 30),
        autoConfirm: this.bool((body.bookingRules as Record<string, unknown>).autoConfirm),
      } : {});
    set('confirmationMessage', this.text(body.confirmationMessage, 1000));
    set('durationMinutes', this.clampNumber(body.durationMinutes, 15, 1440, 60));
    set('price', this.clampNumber(body.price, 0, 100000000, 0, false));
    set('currency', this.text(body.currency, 6).toUpperCase() || 'USD');
    set('location', this.text(body.location, 240));
    const color = this.text(body.sessionColor, 7);
    set('sessionColor', /^#[0-9a-f]{6}$/i.test(color) ? color : '#16bfa5');
    set('createProjectOnBooking', body.createProjectOnBooking === undefined ? true : this.bool(body.createProjectOnBooking));
    set('projectStage', this.text(body.projectStage, 60).toLowerCase() || 'inquiry');
    set('projectType', this.text(body.projectType, 60).toLowerCase() || 'portrait');
    set('active', body.active === undefined ? body.status === 'draft' ? false : true : this.bool(body.active));
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
    set('status', ['pending', 'awaiting-client', 'confirmed', 'completed', 'cancelled'].includes(String(body.status)) ? String(body.status) : 'confirmed');
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

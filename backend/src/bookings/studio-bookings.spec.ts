import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

const serviceId = '123456789012345678901234';
const otherServiceId = '223456789012345678901234';
const ownerId = '323456789012345678901234';

function fixture() {
  const svc: any = Object.create(BookingsService.prototype);
  Object.assign(svc, {
    resolveOwner: jest.fn().mockResolvedValue({ _id: { toString: () => ownerId }, name: 'Studio' }),
    ensureSettings: jest.fn().mockResolvedValue({
      enabled: true, timezone: 'Asia/Dhaka', minNoticeHours: 0, maxAdvanceDays: 60,
      businessHours: [],
    }),
    resolveShareLink: jest.fn().mockResolvedValue(null),
    serviceModel: {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: serviceId, userId: ownerId, active: true, name: 'Private minis',
          durationMinutes: 30, bookingVisibility: 'private',
        }),
      }),
    },
  });
  return svc;
}

describe('Studio Manager booking service settings', () => {
  it('persists and validates per-session availability, booking rules and intake fields', () => {
    const svc = fixture();
    const data: any = svc.servicePayload({
      name: 'Holiday Minis', sessionStyle: 'mini',
      durationMinutes: 30, price: 150, currency: 'USD',
      bookingVisibility: 'private', timezone: 'Asia/Dhaka',
      bookingRules: { minNoticeHours: 48, maxAdvanceDays: 90, slotIntervalMinutes: 15, autoConfirm: true },
      availability: [{ day: 1, enabled: true, start: '10:00', end: '16:00' }],
      intakeFields: [{ name: 'pet', label: 'Bringing a pet?', type: 'select', required: true, options: 'Yes,No' }],
      paymentPolicy: 'manual',
      confirmationMessage: 'Thank you for your enquiry',
    }, false);
    expect(data.sessionStyle).toBe('mini');
    expect(data.bookingVisibility).toBe('private');
    expect(data.bookingRules.minNoticeHours).toBe(48);
    expect(data.bookingRules.maxAdvanceDays).toBe(90);
    expect(data.bookingRules.slotIntervalMinutes).toBe(15);
    expect(data.bookingRules.autoConfirm).toBe(true);
    expect(data.timezone).toBe('Asia/Dhaka');
    expect(data.intakeFields).toHaveLength(1);
    expect(data.intakeFields[0].required).toBe(true);
    expect(data.paymentPolicy).toBe('manual');
  });

  it('creates private drafts with date-specific slots and project defaults', () => {
    const svc = fixture();
    const data: any = svc.servicePayload({
      name: 'Spring Minis', status: 'draft', active: false,
      sessionDates: [{ date: '2027-04-12', start: '09:00', end: '13:00' }],
      sessionColor: '#e65b32', createProjectOnBooking: false,
      projectStage: 'inquiry', projectType: 'portrait',
    }, false);
    expect(data.status).toBe('draft');
    expect(data.active).toBe(false);
    expect(data.sessionDates).toEqual([{ date: '2027-04-12', start: '09:00', end: '13:00' }]);
    expect(data.sessionColor).toBe('#e65b32');
    expect(data.createProjectOnBooking).toBe(false);
  });

  it('does not fall back to weekly hours outside explicitly configured mini-session dates', async () => {
    const svc = fixture();
    svc.coworkerModel = { find: () => ({ select: () => ({ lean: async () => [] }) }) };
    svc.eventModel = { find: () => ({ select: () => ({ lean: async () => [] }) }) };
    const settings = { timezone: 'Asia/Dhaka', minNoticeHours: 0, maxAdvanceDays: 365, slotIntervalMinutes: 30, businessHours: [
      { day: 2, enabled: true, start: '09:00', end: '17:00' },
    ] };
    const service = {
      durationMinutes: 30, timezone: 'Asia/Dhaka', availability: [{ day: 2, enabled: true, start: '09:00', end: '17:00' }],
      sessionDates: [{ date: '2027-01-04', start: '10:00', end: '12:00' }], bookingRules: { minNoticeHours: 0, maxAdvanceDays: 365, slotIntervalMinutes: 30 },
    };
    const slots = await (svc as any).availableSlots(ownerId, settings, service, '2027-01-05');
    expect(slots).toHaveLength(0);
  });

  it('rejects invalid and duplicate session date windows', () => {
    const svc = fixture();
    expect(() => svc.servicePayload({ name: 'Minis', sessionDates: [{ date: 'not-a-date', start: '09:00', end: '12:00' }] }, false))
      .toThrow(BadRequestException);
    expect(() => svc.servicePayload({ name: 'Minis', sessionDates: [
      { date: '2027-04-12', start: '09:00', end: '12:00' },
      { date: '2027-04-12', start: '09:00', end: '13:00' },
    ] }, false)).toThrow(BadRequestException);
  });

  it('rejects duplicate intake question keys', () => {
    const svc = fixture();
    expect(() => svc.servicePayload({
      name: 'Portraits',
      intakeFields: [
        { name: 'client-name', label: 'Client name', type: 'text' },
        { name: 'client-name', label: 'Name again', type: 'text' },
      ],
    }, false)).toThrow(BadRequestException);
  });

  it('creates a private invitation linked to a contact owned by the current studio', async () => {
    const svc = fixture();
    const contactId = otherServiceId;
    const contact = { _id: contactId, title: 'Jane Smith', email: 'jane@example.com' };
    svc.userModel = { findById: () => ({ select: () => ({ lean: async () => ({ _id: ownerId, username: 'studio', name: 'Studio' }) }) }) };
    svc.studioRecordModel = { findOne: jest.fn(() => ({ select: () => ({ lean: async () => contact }) })) };
    svc.serviceModel = { findOne: jest.fn(() => ({ select: () => ({ lean: async () => ({ _id: serviceId, name: 'Private minis' }) }) })) };
    svc.shareLinkModel = { create: jest.fn(async (payload) => ({ toObject: () => ({ _id: 'invite-id', ...payload }) })) };
    svc.shareLinkUrl = jest.fn(() => 'http://localhost:3000/book/studio?invite=token');
    const result = await svc.createShareLink(ownerId, {
      serviceId, contactId, recipientName: 'Wrong name', recipientEmail: 'wrong@example.com',
      expiresAt: new Date(Date.now() + 86400000).toISOString(), sendEmail: false,
    });
    expect(svc.studioRecordModel.findOne).toHaveBeenCalledWith({ _id: contactId, userId: ownerId, kind: 'contacts' });
    expect(svc.shareLinkModel.create).toHaveBeenCalledWith(expect.objectContaining({
      contactId, recipientName: 'Jane Smith', recipientEmail: 'jane@example.com',
    }));
    expect(result.contactId).toBe(contactId);
  });

  it('does not allow a private invitation to reference another owner contact', async () => {
    const svc = fixture();
    svc.userModel = { findById: () => ({ select: () => ({ lean: async () => ({ _id: ownerId, username: 'studio', name: 'Studio' }) }) }) };
    svc.studioRecordModel = { findOne: jest.fn(() => ({ select: () => ({ lean: async () => null }) })) };
    svc.shareLinkModel = { create: jest.fn() };
    await expect(svc.createShareLink(ownerId, {
      serviceId, contactId: otherServiceId, recipientEmail: 'jane@example.com',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(svc.shareLinkModel.create).not.toHaveBeenCalled();
  });

  it('lists only published public session types on the Booking Site landing page', async () => {
    const svc = fixture();
    svc.resolveOwner = jest.fn().mockResolvedValue({ _id: { toString: () => ownerId }, name: 'Studio' });
    svc.ensureSettings = jest.fn().mockResolvedValue({ timezone: 'Asia/Dhaka' });
    const query = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    svc.serviceModel = { find: jest.fn(() => query) };
    svc.homepageModel = { findOne: jest.fn(() => ({ select: () => ({ lean: async () => null }) })) };
    await svc.publicDetails('studio');
    expect(svc.serviceModel.find).toHaveBeenCalledWith({
      userId: ownerId, active: true, status: 'published', bookingVisibility: { $ne: 'private' },
    });
  });

  it('requires an invitation for private sessions before issuing availability', async () => {
    const svc = fixture();
    await expect(svc.publicAvailability('owner', serviceId, '2027-01-06')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invitation for a different private session', async () => {
    const svc = fixture();
    svc.resolveShareLink.mockResolvedValue({ token: 'some-token', serviceId: otherServiceId });
    await expect(svc.publicAvailability('owner', serviceId, '2027-01-06', 'some-token'))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

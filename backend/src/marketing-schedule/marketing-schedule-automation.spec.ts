jest.mock('src/collections/entities/collection-email-registration.entity', () => ({ CollectionEmailRegistration: class CollectionEmailRegistration {} }), { virtual: true });
jest.mock('src/mail/mail.service', () => ({ MailService: class MailService {} }), { virtual: true });
jest.mock('src/user/entities/user.entity', () => ({ User: class User {} }), { virtual: true });

import { MarketingScheduleService } from './marketing-schedule.service';

describe('MarketingScheduleService automations', () => {
  const scheduleModel: any = {
    bulkWrite: jest.fn(),
    updateMany: jest.fn(),
  };
  const automationModel: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };
  const contactModel: any = { find: jest.fn() };
  const userModel: any = {};
  const mailService: any = {};
  const service = new MarketingScheduleService(
    scheduleModel,
    automationModel,
    contactModel,
    userModel,
    mailService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('queues one delayed email for a matching opted-in contact', async () => {
    const updatedAt = new Date(Date.now() - 1000);
    const contact = {
      _id: '64f000000000000000000101',
      email: 'client@example.test',
      marketingOptedInAt: updatedAt,
      createdAt: new Date(updatedAt.getTime() - 86_400_000),
      updatedAt,
    };
    const duplicate = {
      ...contact,
      _id: '64f000000000000000000102',
      marketingOptedInAt: new Date(updatedAt.getTime() + 1),
    };
    const lean = jest.fn().mockResolvedValue([contact, duplicate]);
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });
    contactModel.find.mockReturnValue({ sort });
    scheduleModel.bulkWrite.mockResolvedValue({ upsertedCount: 1 });
    automationModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const automation = {
      _id: '64f000000000000000000201',
      userId: 'owner-1',
      name: 'Welcome',
      recipientCategory: 'Wedding',
      delayMinutes: 60,
      cursorUpdatedAt: new Date(0),
      cursorContactId: '',
      templateId: 'welcome',
      templateName: 'Welcome',
      subject: 'Hello',
      message: 'Thanks for subscribing',
    };
    await (service as any).enqueueAutomationContacts(automation);

    expect(contactModel.find).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-1',
      marketingOptIn: true,
      $and: expect.any(Array),
    }));
    const [operations] = scheduleModel.bulkWrite.mock.calls[0];
    expect(operations).toHaveLength(1);
    const insert = operations[0].updateOne.update.$setOnInsert;
    expect(operations[0].updateOne.filter).toEqual({
      automationId: automation._id,
      automationRecipientEmail: 'client@example.test',
    });
    expect(insert.recipientEmails).toEqual(['client@example.test']);
    expect(insert.recipientCategory).toBe('Wedding');
    expect(insert.status).toBe('scheduled');
    expect(insert.scheduledAt.getTime()).toBeGreaterThanOrEqual(updatedAt.getTime() + 60 * 60 * 1000);
    expect(automationModel.updateOne).toHaveBeenCalled();
  });

  it('cancels queued automated emails when an automation is paused', async () => {
    const doc: any = {
      name: 'Welcome', enabled: true, recipientCategory: undefined, delayMinutes: 60,
      save: jest.fn().mockResolvedValue(undefined),
      toObject() { return { ...this }; },
    };
    automationModel.findOne.mockResolvedValue(doc);
    scheduleModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

    await service.updateAutomation('owner-1', 'automation-1', { enabled: false });

    expect(doc.enabled).toBe(false);
    expect(doc.save).toHaveBeenCalled();
    expect(scheduleModel.updateMany).toHaveBeenCalledWith(
      { userId: 'owner-1', automationId: 'automation-1', status: 'scheduled' },
      { $set: { status: 'cancelled', lastError: 'Automation paused before send' } },
    );
  });

  it('queues a transactional lifecycle email with an event-scoped dedupe key', async () => {
    const automation = {
      _id: 'automation-download-1', userId: 'owner-1', name: 'Download follow-up',
      trigger: 'client-download', enabled: true, delayMinutes: 0,
      templateId: 'download-template', templateName: 'Download template',
      subject: 'Thanks for downloading {{galleryName}}', message: '{{clientEmail}} downloaded {{galleryName}}',
      buttonText: 'Open Gallery', buttonLink: 'Collection URL', buttonColor: '#6337d8',
    };
    automationModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([automation]) });
    scheduleModel.bulkWrite.mockResolvedValue({ upsertedCount: 1 });

    const result = await service.queueLifecycleEvent({
      userId: 'owner-1', trigger: 'client-download', recipientEmails: ['Client@Example.test'],
      collectionId: 'gallery-1', collectionName: 'Jessie & Ryan', buttonLink: 'https://example.test/gallery-1',
    });

    expect(result).toEqual({ queued: 1 });
    const [operations] = scheduleModel.bulkWrite.mock.calls[0];
    const operation = operations[0].updateOne;
    expect(operation.filter.automationEventKey).toBe('automation-download-1:client-download:gallery-1:client@example.test');
    expect(operation.update.$setOnInsert.subscriptionRequired).toBe(false);
    expect(operation.update.$setOnInsert.automationRecipientEmail).toBeUndefined();
    expect(operation.update.$setOnInsert.subject).toContain('Jessie & Ryan');
    expect(operation.update.$setOnInsert.buttonLink).toBe('https://example.test/gallery-1');
  });

  it('uses a different lifecycle dedupe key for the same client in another gallery', async () => {
    automationModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{
      _id: 'automation-favorite-1', userId: 'owner-1', name: 'Favorite follow-up', trigger: 'client-favorite', enabled: true,
      delayMinutes: 0, templateId: 'favorite-template', templateName: 'Favorite template', subject: 'Favorites', message: 'Saved favorites',
    }]) });
    scheduleModel.bulkWrite.mockResolvedValue({ upsertedCount: 1 });

    await service.queueLifecycleEvent({ userId: 'owner-1', trigger: 'client-favorite', recipientEmails: ['client@example.test'], collectionId: 'gallery-a', collectionName: 'A' });
    await service.queueLifecycleEvent({ userId: 'owner-1', trigger: 'client-favorite', recipientEmails: ['client@example.test'], collectionId: 'gallery-b', collectionName: 'B' });

    const firstKey = scheduleModel.bulkWrite.mock.calls[0][0][0].updateOne.filter.automationEventKey;
    const secondKey = scheduleModel.bulkWrite.mock.calls[1][0][0].updateOne.filter.automationEventKey;
    expect(firstKey).not.toBe(secondKey);
  });
});

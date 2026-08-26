import { createHash } from 'node:crypto';
import { PrintLabNotificationService } from './print-lab-notification.service';
import { StoreService } from './store.service';

describe('StoreService owner order update security', () => {
  it('cannot forge server-controlled fields into a cross-tenant image authorization', async () => {
    const attackerOrder: any = {
      _id: '64f000000000000000000101',
      id: '64f000000000000000000101',
      userId: 'attacker',
      collectionId: '64f000000000000000000111',
      items: [{ imageId: '64f000000000000000000121' }],
      customer: { email: '' },
      subtotal: 10,
      total: 10,
      paymentStatus: 'paid',
      status: 'pending',
      printLabNotificationStatus: 'not-requested',
      save: jest.fn().mockResolvedValue(undefined),
      toObject() { return { ...this }; },
    };
    const ownerOrderModel: any = {
      findOne: jest.fn().mockResolvedValue(attackerOrder),
      find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([attackerOrder]) })),
    };
    const customerModel: any = { updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) };
    const store = new StoreService(
      {} as any,
      {} as any,
      ownerOrderModel,
      customerModel,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const chosenToken = 'attacker-chosen-token';

    await store.updateOrder('attacker', attackerOrder.id, {
      status: 'processing',
      userId: 'victim',
      collectionId: '64f000000000000000000211',
      items: [{ imageId: '64f000000000000000000221' }],
      customer: { email: 'victim@example.test' },
      subtotal: 0,
      total: 0,
      paymentStatus: 'not-required',
      printLabAccessTokenHash: createHash('sha256').update(chosenToken).digest('hex'),
      printLabAccessExpiresAt: new Date(Date.now() + 86400000),
      printLabNotificationStatus: 'sent',
      printLabNotificationClaimedAt: new Date(),
      printLabNotificationSentAt: new Date(),
      printLabNotificationError: 'forged',
      printLabNotificationRecipient: 'attacker@example.test',
      stripePaymentIntentId: 'pi_victim',
      activityLogIds: ['victim-log'],
    });

    expect(attackerOrder).toMatchObject({
      status: 'processing',
      userId: 'attacker',
      collectionId: '64f000000000000000000111',
      items: [{ imageId: '64f000000000000000000121' }],
      customer: { email: '' },
      subtotal: 10,
      total: 10,
      paymentStatus: 'paid',
      printLabNotificationStatus: 'not-requested',
    });
    expect(attackerOrder).not.toHaveProperty('printLabAccessTokenHash');
    expect(attackerOrder).not.toHaveProperty('printLabNotificationClaimedAt');
    expect(attackerOrder).not.toHaveProperty('printLabNotificationSentAt');
    expect(attackerOrder).not.toHaveProperty('printLabNotificationError');
    expect(attackerOrder).not.toHaveProperty('printLabNotificationRecipient');
    expect(attackerOrder).not.toHaveProperty('stripePaymentIntentId');
    expect(attackerOrder).not.toHaveProperty('activityLogIds');

    const publicOrderModel: any = {
      findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(attackerOrder) })),
    };
    const imageModel: any = {
      find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({
          _id: '64f000000000000000000221',
          userId: 'victim',
          collectionId: '64f000000000000000000211',
          url: 'https://victim.test/original.jpg',
        }),
      })),
    };
    const notification = new PrintLabNotificationService(
      publicOrderModel,
      { findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })) } as any,
      imageModel,
      { send: jest.fn() } as any,
    );

    await expect(
      notification.authorizeImage(
        attackerOrder.id,
        '64f000000000000000000221',
        chosenToken,
      ),
    ).rejects.toThrow('Print order unavailable');
    expect(imageModel.findOne).not.toHaveBeenCalled();
  });
});

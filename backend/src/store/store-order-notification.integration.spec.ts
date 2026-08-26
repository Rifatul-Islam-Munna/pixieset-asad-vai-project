jest.mock('./store-catalog.service', () => ({ StoreCatalogService: class StoreCatalogService {} }));
jest.mock('./store-pricing.service', () => ({ StorePricingService: class StorePricingService {} }));
jest.mock('./store-stripe.service', () => ({ StoreStripeService: class StoreStripeService {} }));
jest.mock('./print-lab-notification.service', () => ({ PrintLabNotificationService: class PrintLabNotificationService {} }));
jest.mock('./entities/store-activity.entity', () => ({
  StoreActivity: class StoreActivity {},
  STORE_ACTIVITY_TYPES: [],
}));

import { StoreOrderCreateService } from './store-order-create.service';
import { StorePaymentVerifyService } from './store-payment-verify.service';

describe('store order print-lab lifecycle integration', () => {
  it('notifies only after a free request order is saved and does not fail checkout when delivery rejects', async () => {
    const events: string[] = [];
    const order: any = {
      _id: { toString: () => 'order-1' },
      activityLogIds: [],
      toObject: () => ({ id: 'order-1' }),
      save: jest.fn(async () => { events.push('save'); return order; }),
    };
    const catalog: any = { log: jest.fn(async () => ({ _id: { toString: () => 'log-1' } })) };
    const pricing: any = {
      price: jest.fn(async () => ({
        resolved: { userId: 'owner-1', collection: { _id: { toString: () => 'collection-1' } }, config: {} },
        customer: { email: 'client@example.com', name: 'Client' },
        items: [{ imageId: 'image-1', quantity: 2 }], subtotal: 0, tax: 0, shipping: 0, discount: 0, total: 0, currency: 'EUR',
      })),
    };
    const orderModel: any = { create: jest.fn(async () => order) };
    const customerModel: any = { findOneAndUpdate: jest.fn(async () => ({ _id: { toString: () => 'customer-1' } })) };
    const notification: any = { notify: jest.fn(async () => { events.push('notify'); throw new Error('smtp down'); }) };
    const service = new StoreOrderCreateService(catalog, pricing, {} as any, orderModel, customerModel, notification);

    const result = await service.checkout('gallery', { printRequest: true, customer: { email: 'client@example.com' }, items: [] });

    expect(result.completed).toBe(true);
    expect(notification.notify).toHaveBeenCalledWith('order-1', 'free');
    expect(events.indexOf('save')).toBeLessThan(events.indexOf('notify'));
  });

  it('notifies a paid order only on the unpaid-to-paid transition and ignores notification failure', async () => {
    const order: any = {
      _id: { toString: () => 'order-2' }, userId: 'owner-1', collectionId: '', customer: { email: 'client@example.com' },
      total: 25, checkoutSource: 'public-store', paymentStatus: 'unpaid', status: 'pending', activityLogIds: [],
      save: jest.fn(async () => order),
    };
    const orderModel: any = { findOne: jest.fn(async () => order), find: jest.fn(() => ({ sort: () => ({ lean: async () => [order] }) })) };
    const stripe: any = { retrieveCheckoutSession: jest.fn(async () => ({ id: 'session-1', payment_status: 'paid', status: 'complete', currency: 'eur', payment_intent: 'pi-1', metadata: {} })) };
    const notification: any = { notify: jest.fn(async () => { throw new Error('smtp down'); }) };
    const service = new StorePaymentVerifyService({} as any, stripe, orderModel, { updateOne: jest.fn() } as any, { updateOne: jest.fn() } as any, {} as any, { exists: jest.fn() } as any, notification);

    const first = await service.checkoutSession('session-1');
    const second = await service.checkoutSession('session-1');

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(notification.notify).toHaveBeenCalledTimes(1);
    expect(notification.notify).toHaveBeenCalledWith('order-2', 'paid');
  });

  it('notifies a public-intent order only when payment first succeeds', async () => {
    const order: any = {
      _id: { toString: () => 'order-3' }, userId: 'owner-1', collectionId: 'collection-1', customer: { email: 'client@example.com' },
      total: 30, checkoutSource: 'public-gallery', paymentStatus: 'unpaid', status: 'pending', activityLogIds: [],
      save: jest.fn(async () => order),
    };
    const resolved: any = { userId: 'owner-1', collection: { _id: { toString: () => 'collection-1' } } };
    const catalog: any = { resolve: jest.fn(async () => resolved), log: jest.fn(async () => null) };
    const orderModel: any = { findOne: jest.fn(async () => order), find: jest.fn(() => ({ sort: () => ({ lean: async () => [order] }) })) };
    const stripe: any = { retrieveOrderIntent: jest.fn(async () => ({ id: 'pi-public', status: 'succeeded', amount: 3000, currency: 'eur' })) };
    const notification: any = { notify: jest.fn(async () => undefined) };
    const service = new StorePaymentVerifyService(catalog, stripe, orderModel, { updateOne: jest.fn() } as any, { updateOne: jest.fn() } as any, {} as any, { exists: jest.fn(async () => false) } as any, notification);

    await service.verifyPublicIntent('gallery', 'pi-public');
    await service.verifyPublicIntent('gallery', 'pi-public');

    expect(notification.notify).toHaveBeenCalledTimes(1);
    expect(notification.notify).toHaveBeenCalledWith('order-3', 'paid');
  });
});

jest.mock('src/lib/auth.guard', () => ({ AuthGuard: class AuthGuard {} }), { virtual: true });
jest.mock('./store.service', () => ({ StoreService: class StoreService {} }));
jest.mock('./store-catalog.service', () => ({ StoreCatalogService: class StoreCatalogService {} }));
jest.mock('./store-collection-catalog.service', () => ({ StoreCollectionCatalogService: class StoreCollectionCatalogService {} }));
jest.mock('./store-collection-product.service', () => ({ StoreCollectionProductService: class StoreCollectionProductService {} }));
jest.mock('./public-store.service', () => ({ PublicStoreService: class PublicStoreService {} }));
jest.mock('./print-lab-notification.service', () => ({ PrintLabNotificationService: class PrintLabNotificationService {} }));

import { StoreController } from './store.controller';

describe('StoreController print-lab resend', () => {
  it('resends using the authenticated gallery owner identity', async () => {
    const printLab = { resend: jest.fn(async () => ({ status: 'sent' })) };
    const controller = new StoreController(
      {} as any, {} as any, {} as any, {} as any, {} as any, printLab as any,
    );
    const result = await controller.resendPrintLabOrder(
      'order-1',
      { user: { id: 'owner-1' } } as any,
    );

    expect(printLab.resend).toHaveBeenCalledWith('owner-1', 'order-1');
    expect(result).toEqual({ message: 'Print company email resent', data: { status: 'sent' } });
  });
});
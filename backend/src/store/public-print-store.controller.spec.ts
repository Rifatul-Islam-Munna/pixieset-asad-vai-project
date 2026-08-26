jest.mock('./public-store.service', () => ({ PublicStoreService: class PublicStoreService {} }));
jest.mock('./print-lab-notification.service', () => ({
  PrintLabNotificationService: class PrintLabNotificationService {},
}));

import { NotFoundException } from '@nestjs/common';
import { PublicPrintLabController } from './public-print-store.controller';

describe('PublicPrintLabController print-lab routes', () => {
  const store = {} as any;
  const printLab = {
    getPublicOrder: jest.fn(),
    authorizeImage: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing token without calling the service', async () => {
    const controller = new PublicPrintLabController(printLab as any);
    await expect(controller.printLabOrder('order-1', '')).rejects.toBeInstanceOf(NotFoundException);
    expect(printLab.getPublicOrder).not.toHaveBeenCalled();
  });
  it('returns only the restricted print-lab order view', async () => {
    printLab.getPublicOrder.mockResolvedValue({ id: 'order-1', orderNumber: 'ORD-1', items: [] });
    const controller = new PublicPrintLabController(printLab as any);
    const result = await controller.printLabOrder('order-1', 'token-1');
    expect(printLab.getPublicOrder).toHaveBeenCalledWith('order-1', 'token-1');
    expect(result).toEqual({ data: { id: 'order-1', orderNumber: 'ORD-1', items: [] } });
  });
  it('authorizes an order image before redirecting to the asset', async () => {
    printLab.authorizeImage.mockResolvedValue({ url: 'https://cdn.test/photo.jpg', filename: 'photo.jpg' });
    const response = { setHeader: jest.fn(), redirect: jest.fn() } as any;
    const controller = new PublicPrintLabController(printLab as any);
    await controller.printLabImage('order-1', 'image-1', 'token-1', response);
    expect(printLab.authorizeImage).toHaveBeenCalledWith('order-1', 'image-1', 'token-1');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="photo.jpg"');
    expect(response.redirect).toHaveBeenCalledWith('https://cdn.test/photo.jpg');
  });
});



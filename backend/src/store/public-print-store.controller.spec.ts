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
    openPrintImage: jest.fn(),
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
  it('streams only the authorized private original', async () => {
    const body = { pipe: jest.fn() };
    printLab.openPrintImage.mockResolvedValue({
      body,
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      contentLength: 1234,
    });
    const response = { setHeader: jest.fn() } as any;
    const controller = new PublicPrintLabController(printLab as any);
    await controller.printLabImage('order-1', 'image-1', 'token-1', response);
    expect(printLab.openPrintImage).toHaveBeenCalledWith('order-1', 'image-1', 'token-1');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="photo.jpg"');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', '1234');
    expect(body.pipe).toHaveBeenCalledWith(response);
  });
});



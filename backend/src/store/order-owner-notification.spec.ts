import { PrintLabNotificationService } from './print-lab-notification.service';

describe('order owner activity notification', () => {
  it('sends the owner one activity email and marks it sent', async () => {
    const orderId = '64f000000000000000000321';
    const claimed: any = {
      _id: { toString: () => orderId },
      userId: '64f000000000000000000111',
      orderNumber: 'ORD-1001',
      customer: { name: 'Client', email: 'client@example.com' },
      total: 49.5,
      createdAt: new Date('2026-10-05T12:00:00Z'),
    };
    const orderModel: any = {
      findOneAndUpdate: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(claimed),
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const userModel: any = {
      findById: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest
            .fn()
            .mockResolvedValue({ email: 'owner@example.com', name: 'Owner' }),
        })),
      })),
    };
    const mail: any = {
      getWebsiteBranding: jest.fn().mockResolvedValue({
        brandText: 'Gallerista',
        logoUrl: 'https://cdn.example.com/gallerista-logo.png',
      }),
      send: jest.fn().mockResolvedValue({ sent: true, messageId: 'mail-1' }),
    };
    const service = new PrintLabNotificationService(
      orderModel,
      {} as any,
      {} as any,
      mail,
      {} as any,
      userModel,
    );

    await (service as any).notifyOwner(
      claimed,
      { name: 'Wedding Gallery' },
      'paid',
    );

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe('owner@example.com');
    expect(mail.send.mock.calls[0][0].subject).toContain('ORD-1001');
    expect(mail.send.mock.calls[0][0].html).toContain('Wedding Gallery');
    expect(orderModel.updateOne).toHaveBeenCalledWith(
      { _id: orderId, ownerNotificationStatus: 'pending' },
      expect.objectContaining({
        $set: expect.objectContaining({ ownerNotificationStatus: 'sent' }),
      }),
    );
  });
});

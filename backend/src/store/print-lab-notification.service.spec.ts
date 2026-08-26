import { NotFoundException } from '@nestjs/common';
import { PrintLabNotificationService } from './print-lab-notification.service';

describe('PrintLabNotificationService', () => {
  const initialFrontendUrl = process.env.FRONTEND_URL;
  let order: any;
  let collection: any;
  let images: any[];
  let orderModel: any;
  let collectionModel: any;
  let imageModel: any;
  let mail: { send: jest.Mock };
  let service: PrintLabNotificationService;

  const query = <T>(value: T) => ({ lean: jest.fn().mockResolvedValue(value) });

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://gallery.test';
    order = {
      id: 'order-1',
      _id: 'order-1',
      userId: 'owner-1',
      collectionId: 'collection-1',
      orderNumber: 'ORD-<101>',
      customer: {
        name: 'Ana & <script>alert(1)</script>',
        email: 'ana@example.test',
        phone: '555-0100',
        address: { line1: '12 <Main> Street', city: 'Dhaka' },
      },
      items: [
        {
          imageId: 'image-1',
          imageUrl: 'https://storage.test/private-original.jpg',
          name: 'Fine Art <Print>',
          type: 'print',
          variantLabel: '8 x 10',
          options: { Size: '8 x 10', Paper: 'Matte', Frame: 'Black & Gold' },
          quantity: 2,
        },
      ],
      shippingMethodName: 'Courier',
      shippingNote: 'Leave at <desk>',
      note: 'Crop around & preserve faces',
      checkoutSource: 'print-request',
      status: 'pending',
      paymentStatus: 'not-required',
      printLabNotificationStatus: 'not-requested',
      createdAt: new Date('2026-08-26T12:00:00.000Z'),
    };
    collection = {
      id: 'collection-1',
      _id: 'collection-1',
      userId: 'owner-1',
      name: 'Wedding <Gallery>',
      settings: {
        store: {
          printLabEmail: 'orders@lab.test',
          notifyPrintLabForFreeRequests: true,
          notifyPrintLabForPaidOrders: true,
        },
      },
    };
    images = [
      {
        id: 'image-1',
        _id: 'image-1',
        userId: 'owner-1',
        collectionId: 'collection-1',
        url: 'https://storage.test/private-original.jpg',
        thumbnailUrl: 'https://storage.test/thumb.jpg',
        originalName: 'ceremony & vows.jpg',
        filename: 'stored-image.jpg',
      },
      {
        id: 'image-2',
        _id: 'image-2',
        userId: 'owner-1',
        collectionId: 'collection-1',
        url: 'https://storage.test/not-ordered.jpg',
        originalName: 'not-ordered.jpg',
      },
    ];

    orderModel = {
      findOne: jest.fn((filter: any) =>
        query(
          String(filter._id) === order.id && (!filter.userId || filter.userId === order.userId)
            ? order
            : null,
        ),
      ),
      findOneAndUpdate: jest.fn((filter: any, update: any) => {
        const normalEligible =
          order.printLabNotificationStatus === undefined ||
          order.printLabNotificationStatus === 'not-requested';
        const forceEligible = order.printLabNotificationStatus !== 'pending';
        const eligible = filter.$or ? normalEligible : forceEligible;
        if (String(filter._id) !== order.id || !eligible) return query(null);
        Object.assign(order, update.$set || {});
        for (const key of Object.keys(update.$unset || {})) delete order[key];
        return query(order);
      }),
      updateOne: jest.fn(async (filter: any, update: any) => {
        if (
          String(filter._id) === order.id &&
          (!filter.printLabAccessTokenHash ||
            filter.printLabAccessTokenHash === order.printLabAccessTokenHash)
        ) {
          Object.assign(order, update.$set || {});
          for (const key of Object.keys(update.$unset || {})) delete order[key];
          return { modifiedCount: 1 };
        }
        return { modifiedCount: 0 };
      }),
    };
    collectionModel = {
      findOne: jest.fn((filter: any) =>
        query(
          String(filter._id) === collection.id && filter.userId === collection.userId
            ? collection
            : null,
        ),
      ),
    };
    imageModel = {
      find: jest.fn((filter: any) =>
        query(
          images.filter(
            (image) =>
              filter._id.$in.map(String).includes(image.id) &&
              image.userId === filter.userId &&
              image.collectionId === filter.collectionId,
          ),
        ),
      ),
      findOne: jest.fn((filter: any) =>
        query(
          images.find(
            (image) =>
              image.id === String(filter._id) &&
              image.userId === filter.userId &&
              image.collectionId === filter.collectionId,
          ) || null,
        ),
      ),
    };
    mail = { send: jest.fn().mockResolvedValue({ sent: true, messageId: 'mail-1' }) };
    service = new PrintLabNotificationService(
      orderModel,
      collectionModel,
      imageModel,
      mail as any,
    );
  });

  afterAll(() => {
    if (initialFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = initialFrontendUrl;
  });

  it.each([
    [true, false, 1],
    [false, true, 1],
    [true, true, 2],
    [false, false, 0],
  ])(
    'routes free and paid modes through independent toggles (%s, %s)',
    async (freeEnabled, paidEnabled, expectedSends) => {
      collection.settings.store = {
        printLabEmail: 'orders@lab.test',
        notifyPrintLabForFreeRequests: freeEnabled,
        notifyPrintLabForPaidOrders: paidEnabled,
      };

      await service.notify(order.id, 'free');
      order.printLabNotificationStatus = 'not-requested';
      await service.notify(order.id, 'paid');

      expect(mail.send).toHaveBeenCalledTimes(expectedSends);
    },
  );

  it('skips missing and invalid recipients before claiming an order', async () => {
    for (const recipient of ['', 'bad-address']) {
      collection.settings.store.printLabEmail = recipient;
      const result = await service.notify(order.id, 'free');
      expect(result).toMatchObject({ status: 'skipped', reason: 'invalid-recipient' });
    }

    expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('atomically claims only a not-requested order before sending', async () => {
    await service.notify(order.id, 'free');
    const second = await service.notify(order.id, 'free');

    expect(second).toMatchObject({ status: 'skipped', reason: 'already-claimed' });
    expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: order.id,
        $or: expect.arrayContaining([
          { printLabNotificationStatus: { $exists: false } },
          { printLabNotificationStatus: 'not-requested' },
        ]),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ printLabNotificationStatus: 'pending' }),
      }),
      expect.any(Object),
    );
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('stores only a token hash and returns a restricted public order', async () => {
    const result = await service.notify(order.id, 'free');
    expect(result.token).toEqual(expect.any(String));
    expect(order.printLabAccessTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(order.printLabAccessTokenHash).not.toContain(result.token);
    expect(order.printLabAccessExpiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);

    const view = await service.getPublicOrder(order.id, result.token!);
    expect(view).not.toHaveProperty('userId');
    expect(view).not.toHaveProperty('printLabAccessTokenHash');
    expect(view).not.toHaveProperty('paymentStatus');
    expect(view).not.toHaveProperty('activityLogIds');
    expect(view.items[0]).toMatchObject({
      imageId: 'image-1',
      filename: 'ceremony & vows.jpg',
      quantity: 2,
      options: { Size: '8 x 10', Paper: 'Matte', Frame: 'Black & Gold' },
    });
    expect(view.items[0]).not.toHaveProperty('imageUrl');
  });

  it('rejects invalid, expired, and rotated tokens with one generic error', async () => {
    const first = await service.notify(order.id, 'free');
    await expect(service.getPublicOrder(order.id, 'wrong-token')).rejects.toThrow(
      'Print order unavailable',
    );

    order.printLabAccessExpiresAt = new Date(Date.now() - 1);
    await expect(service.getPublicOrder(order.id, first.token!)).rejects.toThrow(
      'Print order unavailable',
    );

    order.printLabAccessExpiresAt = new Date(Date.now() + 86400000);
    const second = await service.resend(order.userId, order.id);
    await expect(service.getPublicOrder(order.id, first.token!)).rejects.toThrow(
      'Print order unavailable',
    );
    await expect(service.getPublicOrder(order.id, second.token!)).resolves.toMatchObject({
      orderNumber: 'ORD-<101>',
    });
  });

  it('records a sanitized failed state when SMTP does not send', async () => {
    mail.send.mockResolvedValue({ sent: false, reason: 'SMTP_SEND_FAILED' });

    const result = await service.notify(order.id, 'free');

    expect(result).toMatchObject({ status: 'failed' });
    expect(order.printLabNotificationStatus).toBe('failed');
    expect(order.printLabNotificationError).toBe('Print lab email delivery failed.');
    expect(order.printLabNotificationError).not.toContain('SMTP');
  });

  it('authorizes only an image item belonging to the token order', async () => {
    const result = await service.notify(order.id, 'free');

    await expect(service.authorizeImage(order.id, 'image-1', result.token!)).resolves.toEqual({
      url: 'https://storage.test/private-original.jpg',
      filename: 'ceremony & vows.jpg',
    });
    await expect(service.authorizeImage(order.id, 'image-2', result.token!)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.authorizeImage(order.id, 'image-1', 'wrong-token')).rejects.toThrow(
      'Print order unavailable',
    );
  });

  it('marks deleted order photos unavailable without exposing a storage URL', async () => {
    order.items.push({
      imageId: 'deleted-image',
      imageUrl: 'https://storage.test/deleted-private-original.jpg',
      name: 'Deleted photo',
      type: 'print',
      options: {},
      quantity: 1,
    });
    const result = await service.notify(order.id, 'free');

    const view = await service.getPublicOrder(order.id, result.token!);

    expect(view.items[0]).toMatchObject({ imageId: 'image-1', available: true });
    expect(view.items[1]).toMatchObject({ imageId: 'deleted-image', available: false });
    expect(view.items[1]).not.toHaveProperty('imageUrl');
  });

  it('escapes HTML and includes filenames, options, quantity, notes, and secure link', async () => {
    const result = await service.notify(order.id, 'free');
    const payload = mail.send.mock.calls[0][0];

    expect(payload.to).toBe('orders@lab.test');
    expect(payload.html).toContain('Wedding &lt;Gallery&gt;');
    expect(payload.html).toContain('Ana &amp; &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(payload.html).not.toContain('<script>');
    expect(payload.html).toContain('ceremony &amp; vows.jpg');
    expect(payload.html).toContain('Fine Art &lt;Print&gt;');
    expect(payload.html).toContain('Size: 8 x 10');
    expect(payload.html).toContain('Paper: Matte');
    expect(payload.html).toContain('Frame: Black &amp; Gold');
    expect(payload.html).toContain('Quantity: 2');
    expect(payload.html).toContain('Crop around &amp; preserve faces');
    expect(payload.html).not.toContain('https://storage.test/private-original.jpg');
    expect(payload.html).toContain(
      `https://gallery.test/print-lab/orders/order-1?token=${encodeURIComponent(result.token!)}`,
    );
    expect(payload.text).toContain('ceremony & vows.jpg');
    expect(payload.text).toContain('Quantity: 2');
    expect(payload.text).toContain('Crop around & preserve faces');
  });

  it('resends only an owner order and rotates a failed or sent attempt', async () => {
    await expect(service.resend('other-user', order.id)).rejects.toThrow('Order not found');
    const first = await service.notify(order.id, 'free');
    const second = await service.resend(order.userId, order.id);

    expect(second.status).toBe('sent');
    expect(second.token).not.toBe(first.token);
    expect(mail.send).toHaveBeenCalledTimes(2);
  });
});

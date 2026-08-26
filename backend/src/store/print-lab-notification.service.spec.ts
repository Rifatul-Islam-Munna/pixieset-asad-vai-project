import { NotFoundException } from '@nestjs/common';
import { CollectionImageSchema } from 'src/collections/entities/collection-image.entity';
import { StoreOrderSchema } from './entities/store-order.entity';
import { PrintLabNotificationService } from './print-lab-notification.service';

const ORDER_ID = '64f000000000000000000001';
const COLLECTION_ID = '64f000000000000000000011';
const IMAGE_ID = '64f000000000000000000021';
const OTHER_IMAGE_ID = '64f000000000000000000022';

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
      id: ORDER_ID,
      _id: ORDER_ID,
      userId: 'owner-1',
      collectionId: COLLECTION_ID,
      orderNumber: 'ORD-<101>',
      customer: {
        name: 'Ana & <script>alert(1)</script>',
        email: 'ana@example.test',
        phone: '555-0100',
        address: { line1: '12 <Main> Street', city: 'Dhaka' },
      },
      items: [
        {
          imageId: IMAGE_ID,
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
      id: COLLECTION_ID,
      _id: COLLECTION_ID,
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
        id: IMAGE_ID,
        _id: IMAGE_ID,
        userId: 'owner-1',
        collectionId: COLLECTION_ID,
        url: 'https://storage.test/private-original.jpg',
        thumbnailUrl: 'https://storage.test/thumb.jpg',
        originalName: 'ceremony & vows.jpg',
        filename: 'stored-image.jpg',
      },
      {
        id: OTHER_IMAGE_ID,
        _id: OTHER_IMAGE_ID,
        userId: 'owner-1',
        collectionId: COLLECTION_ID,
        url: 'https://storage.test/not-ordered.jpg',
        originalName: 'not-ordered.jpg',
      },
    ];

    orderModel = {
      findOne: jest.fn((filter: any) =>
        query(
          String(filter._id) === order.id && (!filter.userId || filter.userId === order.userId)
            ? snapshot(order)
            : null,
        ),
      ),
      findOneAndUpdate: jest.fn((filter: any, update: any) => {
        if (!matches(filter, order)) return query(null);
        Object.assign(order, update.$set || {});
        for (const key of Object.keys(update.$unset || {})) delete order[key];
        return query(order);
      }),
      updateOne: jest.fn(async (filter: any, update: any) => {
        if (matches(filter, order)) {
          Object.assign(order, update.$set || {});
          for (const key of Object.keys(update.$unset || {})) delete order[key];
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
        }
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
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
      order.checkoutSource = 'public-store';
      order.paymentStatus = 'paid';
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
      imageId: IMAGE_ID,
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

    await expect(service.authorizeImage(order.id, IMAGE_ID, result.token!)).resolves.toEqual({
      url: 'https://storage.test/private-original.jpg',
      filename: 'ceremony & vows.jpg',
    });
    await expect(service.authorizeImage(order.id, OTHER_IMAGE_ID, result.token!)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.authorizeImage(order.id, IMAGE_ID, 'wrong-token')).rejects.toThrow(
      'Print order unavailable',
    );
  });

  it('marks deleted order photos unavailable without exposing a storage URL', async () => {
    order.items.push({
      imageId: '64f000000000000000000099',
      imageUrl: 'https://storage.test/deleted-private-original.jpg',
      name: 'Deleted photo',
      type: 'print',
      options: {},
      quantity: 1,
    });
    const result = await service.notify(order.id, 'free');

    const view = await service.getPublicOrder(order.id, result.token!);

    expect(view.items[0]).toMatchObject({ imageId: IMAGE_ID, available: true });
    expect(view.items[1]).toMatchObject({
      imageId: '64f000000000000000000099',
      available: false,
    });
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
      `https://gallery.test/print-lab/orders/${ORDER_ID}?token=${encodeURIComponent(result.token!)}`,
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

  it('permits resend only for sent or failed orders with the current mode enabled', async () => {
    for (const status of ['not-requested', 'pending'] as const) {
      order.printLabNotificationStatus = status;
      await expect(service.resend(order.userId, order.id)).rejects.toThrow(
        'Print lab notification cannot be resent',
      );
    }

    order.printLabNotificationStatus = 'failed';
    collection.settings.store.notifyPrintLabForFreeRequests = false;
    await expect(service.resend(order.userId, order.id)).rejects.toThrow(
      'Print lab notification is disabled',
    );

    collection.settings.store.notifyPrintLabForFreeRequests = true;
    await expect(service.resend(order.userId, order.id)).resolves.toMatchObject({ status: 'sent' });
    order.printLabNotificationStatus = 'sent';
    await expect(service.resend(order.userId, order.id)).resolves.toMatchObject({ status: 'sent' });
  });

  it('rejects resend for an unpaid paid order', async () => {
    order.checkoutSource = 'public-store';
    order.paymentStatus = 'unpaid';
    order.printLabNotificationStatus = 'failed';

    await expect(service.resend(order.userId, order.id)).rejects.toThrow(
      'Paid order is not paid',
    );
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('rejects resend when current recipient is invalid', async () => {
    order.printLabNotificationStatus = 'failed';
    collection.settings.store.printLabEmail = 'bad-address';

    await expect(service.resend(order.userId, order.id)).rejects.toThrow(
      'Print lab recipient is invalid',
    );
    expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps owner, resendable state, mode, and payment in the atomic paid resend claim', async () => {
    order.checkoutSource = 'public-store';
    order.paymentStatus = 'paid';
    order.printLabNotificationStatus = 'failed';

    await service.resend(order.userId, order.id);

    expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: order.id,
        userId: order.userId,
        checkoutSource: { $ne: 'print-request' },
        paymentStatus: 'paid',
        printLabNotificationStatus: { $in: ['sent', 'failed'] },
      }),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('recovers a bounded stale pending claim to failed without automatically resending', async () => {
    order.printLabNotificationStatus = 'pending';
    order.printLabNotificationClaimedAt = new Date(Date.now() - 16 * 60 * 1000);

    const result = await service.notify(order.id, 'free');

    expect(result).toMatchObject({ status: 'skipped', reason: 'stale-claim-recovered' });
    expect(order.printLabNotificationStatus).toBe('failed');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('keeps a fresh pending claim locked', async () => {
    order.printLabNotificationStatus = 'pending';
    order.printLabNotificationClaimedAt = new Date(Date.now() - 14 * 60 * 1000);

    const result = await service.notify(order.id, 'free');

    expect(result).toMatchObject({ status: 'skipped', reason: 'already-claimed' });
    expect(order.printLabNotificationStatus).toBe('pending');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('records failed when image loading fails after claim', async () => {
    imageModel.find.mockReturnValueOnce({ lean: jest.fn().mockRejectedValue(new Error('catalog down')) });

    await expect(service.notify(order.id, 'free')).resolves.toMatchObject({ status: 'failed' });
    expect(order.printLabNotificationStatus).toBe('failed');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('records failed when payload construction fails after claim', async () => {
    collection.name = { toString: () => { throw new Error('bad gallery value'); } };

    await expect(service.notify(order.id, 'free')).resolves.toMatchObject({ status: 'failed' });
    expect(order.printLabNotificationStatus).toBe('failed');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('records failed when SMTP rejects after claim', async () => {
    mail.send.mockRejectedValueOnce(new Error('socket closed'));

    await expect(service.notify(order.id, 'free')).resolves.toMatchObject({
      status: 'failed',
      statePersisted: true,
    });
    expect(order.printLabNotificationStatus).toBe('failed');
  });

  it('retries failed-state persistence on zero-match writes', async () => {
    const zero = { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    const defaultUpdate = orderModel.updateOne.getMockImplementation();
    orderModel.updateOne
      .mockResolvedValueOnce(zero)
      .mockResolvedValueOnce(zero)
      .mockImplementation(defaultUpdate);
    mail.send.mockResolvedValueOnce({ sent: false, reason: 'SMTP_SEND_FAILED' });

    const result = await service.notify(order.id, 'free');

    expect(result).toMatchObject({ status: 'failed', statePersisted: true });
    expect(order.printLabNotificationStatus).toBe('failed');
    expect(orderModel.updateOne).toHaveBeenCalledTimes(3);
  });

  it('retries sent-state persistence and never labels confirmed SMTP delivery failed', async () => {
    const defaultUpdate = orderModel.updateOne.getMockImplementation();
    orderModel.updateOne
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockImplementation(defaultUpdate);

    const result = await service.notify(order.id, 'free');

    expect(result).toMatchObject({ status: 'sent', statePersisted: false });
    expect(order.printLabNotificationStatus).toBe('pending');
    expect(orderModel.updateOne).toHaveBeenCalledTimes(3);
  });

  it('treats zero-match terminal writes as failures and retries them', async () => {
    const zero = { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    const defaultUpdate = orderModel.updateOne.getMockImplementation();
    orderModel.updateOne
      .mockResolvedValueOnce(zero)
      .mockResolvedValueOnce(zero)
      .mockImplementation(defaultUpdate);

    const result = await service.notify(order.id, 'free');

    expect(result).toMatchObject({ status: 'sent', statePersisted: true });
    expect(order.printLabNotificationStatus).toBe('sent');
    expect(orderModel.updateOne).toHaveBeenCalledTimes(3);
  });

  it('allows only one SMTP send across overlapping notify calls', async () => {
    let release!: () => void;
    mail.send.mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ sent: true }); }),
    );

    const first = service.notify(order.id, 'free');
    const second = service.notify(order.id, 'free');
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const results = await Promise.all([first, second]);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.status).sort()).toEqual(['sent', 'skipped']);
  });

  it('returns the generic unavailable error for malformed ObjectIds before querying', async () => {
    expect(() => StoreOrderSchema.path('_id')!.cast('not-an-object-id')).toThrow();
    expect(() => CollectionImageSchema.path('_id')!.cast('not-an-object-id')).toThrow();
    orderModel.findOne.mockClear();

    await expect(service.getPublicOrder('not-an-object-id', 'token')).rejects.toThrow(
      'Print order unavailable',
    );
    await expect(service.authorizeImage(order.id, 'bad-image-id', 'token')).rejects.toThrow(
      'Print order unavailable',
    );
    expect(orderModel.findOne).not.toHaveBeenCalled();
    expect(imageModel.findOne).not.toHaveBeenCalled();
  });

  it('keeps phone and address behind the secure view instead of persisting them in email', async () => {
    const result = await service.notify(order.id, 'free');
    const payload = mail.send.mock.calls[0][0];

    expect(payload.html).not.toContain('555-0100');
    expect(payload.html).not.toContain('12 &lt;Main&gt; Street');
    expect(payload.text).not.toContain('555-0100');
    expect(payload.text).not.toContain('12 <Main> Street');
    await expect(service.getPublicOrder(order.id, result.token!)).resolves.toMatchObject({
      customer: { phone: '555-0100', address: { line1: '12 <Main> Street' } },
    });
  });

  it('returns bounded header-safe filenames', async () => {
    images[0].originalName = 'evil";\r\nname?.jpg';
    const result = await service.notify(order.id, 'free');
    await expect(service.authorizeImage(order.id, IMAGE_ID, result.token!)).resolves.toEqual({
      url: 'https://storage.test/private-original.jpg',
      filename: 'evil_name_.jpg',
    });

    images[0].originalName = 'CON.txt';
    await expect(service.authorizeImage(order.id, IMAGE_ID, result.token!)).resolves.toMatchObject({
      filename: '_CON.txt',
    });

    images[0].originalName = `${'a'.repeat(200)}.jpg... `;
    const bounded = await service.authorizeImage(order.id, IMAGE_ID, result.token!);
    expect(bounded.filename).toHaveLength(120);
    expect(bounded.filename).toMatch(/\.jpg$/);
    expect(bounded.filename).not.toMatch(/[. ]$/);
  });
});

function matches(filter: any, value: any): boolean {
  return Object.entries(filter).every(([key, condition]: [string, any]) => {
    if (key === '$or') return condition.some((entry: any) => matches(entry, value));
    const actual = value[key];
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      if ('$exists' in condition) return condition.$exists ? actual !== undefined : actual === undefined;
      if ('$in' in condition) return condition.$in.includes(actual);
      if ('$ne' in condition) return actual !== condition.$ne;
      if ('$lte' in condition) return new Date(actual).getTime() <= new Date(condition.$lte).getTime();
    }
    return String(actual) === String(condition);
  });
}

function snapshot(value: any) {
  return {
    ...value,
    customer: value.customer ? { ...value.customer } : value.customer,
    items: (value.items ?? []).map((item: any) => ({ ...item, options: { ...(item.options ?? {}) } })),
  };
}

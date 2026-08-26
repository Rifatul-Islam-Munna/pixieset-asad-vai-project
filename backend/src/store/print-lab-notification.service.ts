import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import {
  CollectionImage,
  CollectionImageDocument,
} from 'src/collections/entities/collection-image.entity';
import { MailService } from 'src/mail/mail.service';
import { StoreOrder, StoreOrderDocument } from './entities/store-order.entity';

export type PrintLabDeliveryResult = {
  status: 'sent' | 'failed' | 'skipped';
  token?: string;
  reason?:
    | 'disabled'
    | 'invalid-recipient'
    | 'already-claimed'
    | 'ineligible-order'
    | 'stale-claim-recovered';
  statePersisted?: boolean;
};

export type PrintLabPublicOrder = {
  id: string;
  orderNumber: string;
  galleryName: string;
  mode: 'free' | 'paid';
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: Record<string, unknown>;
  };
  items: Array<{
    imageId?: string;
    filename: string;
    available: boolean;
    name: string;
    type: string;
    variantLabel?: string;
    options: Record<string, string>;
    crop?: unknown;
    quantity: number;
  }>;
  shippingMethodName: string;
  shippingNote: string;
  note: string;
  createdAt?: Date;
};

type NotificationMode = 'free' | 'paid';
const CLAIM_STALE_AFTER_MS = 15 * 60 * 1000;
const TERMINAL_WRITE_ATTEMPTS = 3;

@Injectable()
export class PrintLabNotificationService {
  constructor(
    @InjectModel(StoreOrder.name)
    private readonly orderModel: Model<StoreOrderDocument>,
    @InjectModel(Collection.name)
    private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name)
    private readonly imageModel: Model<CollectionImageDocument>,
    private readonly mailService: MailService,
  ) {}

  async notify(
    orderId: string,
    mode: NotificationMode,
    force = false,
  ): Promise<PrintLabDeliveryResult> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found');
    const order = await this.orderModel.findOne({ _id: orderId }).lean();
    if (!order) throw new NotFoundException('Order not found');

    const collection = order.collectionId
      ? await this.collectionModel
          .findOne({ _id: order.collectionId, userId: order.userId })
          .lean()
      : null;
    const settings = ((collection?.settings as any)?.store ?? {}) as Record<string, unknown>;
    const recipient = String(settings.printLabEmail ?? '').trim();
    if (!isValidEmail(recipient)) {
      return { status: 'skipped', reason: 'invalid-recipient' };
    }

    const enabled =
      mode === 'free'
        ? settings.notifyPrintLabForFreeRequests === true
        : settings.notifyPrintLabForPaidOrders === true;
    if (!enabled) return { status: 'skipped', reason: 'disabled' };

    if (!modeMatchesOrder(order, mode)) {
      return { status: 'skipped', reason: 'ineligible-order' };
    }
    if (!force && order.printLabNotificationStatus === 'pending') {
      const recovered = await this.recoverStaleClaim(orderId);
      return recovered
        ? { status: 'skipped', reason: 'stale-claim-recovered' }
        : { status: 'skipped', reason: 'already-claimed' };
    }

    return this.deliver(orderId, order, collection, mode, recipient, force);
  }

  private async deliver(
    orderId: string,
    order: any,
    collection: any,
    mode: NotificationMode,
    recipient: string,
    force: boolean,
    ownerId?: string,
  ): Promise<PrintLabDeliveryResult> {

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const claimedAt = new Date();
    const claimUpdate = {
      $set: {
        printLabAccessTokenHash: tokenHash,
        printLabAccessExpiresAt: expiresAt,
        printLabNotificationStatus: 'pending' as const,
        printLabNotificationClaimedAt: claimedAt,
        printLabNotificationError: '',
        printLabNotificationRecipient: recipient,
      },
      $unset: { printLabNotificationSentAt: 1 },
    };
    let claimQuery;
    if (force && mode === 'free') {
      claimQuery = this.orderModel.findOneAndUpdate(
        {
          _id: orderId,
          ...(ownerId ? { userId: ownerId } : {}),
          checkoutSource: 'print-request',
          printLabNotificationStatus: { $in: ['sent', 'failed'] },
        },
        claimUpdate,
        { returnDocument: 'after' },
      );
    } else if (force) {
      claimQuery = this.orderModel.findOneAndUpdate(
        {
          _id: orderId,
          ...(ownerId ? { userId: ownerId } : {}),
          checkoutSource: { $ne: 'print-request' },
          paymentStatus: 'paid',
          printLabNotificationStatus: { $in: ['sent', 'failed'] },
        },
        claimUpdate,
        { returnDocument: 'after' },
      );
    } else if (mode === 'free') {
      claimQuery = this.orderModel.findOneAndUpdate(
        {
          _id: orderId,
          checkoutSource: 'print-request',
          $or: [
            { printLabNotificationStatus: { $exists: false } },
            { printLabNotificationStatus: 'not-requested' },
          ],
        },
        claimUpdate,
        { returnDocument: 'after' },
      );
    } else {
      claimQuery = this.orderModel.findOneAndUpdate(
        {
          _id: orderId,
          checkoutSource: { $ne: 'print-request' },
          paymentStatus: 'paid',
          $or: [
            { printLabNotificationStatus: { $exists: false } },
            { printLabNotificationStatus: 'not-requested' },
          ],
        },
        claimUpdate,
        { returnDocument: 'after' },
      );
    }
    const claimed = await claimQuery.lean();
    if (!claimed) return { status: 'skipped', reason: 'already-claimed' };

    let delivery: Awaited<ReturnType<MailService['send']>>;
    try {
      const imageMap = await this.loadImages(claimed);
      const link = this.secureLink(orderId, token);
      const payload = buildMailPayload(
        claimed,
        collection,
        imageMap,
        mode,
        recipient,
        link,
        expiresAt,
      );
      delivery = await this.mailService.send(payload);
    } catch {
      const statePersisted = await this.persistTerminal(orderId, tokenHash, 'failed');
      return { status: 'failed', token, statePersisted };
    }

    if (!delivery.sent) {
      const statePersisted = await this.persistTerminal(orderId, tokenHash, 'failed');
      return { status: 'failed', token, statePersisted };
    }

    const statePersisted = await this.persistTerminal(orderId, tokenHash, 'sent');
    return { status: 'sent', token, statePersisted };
  }

  async getPublicOrder(orderId: string, token: string): Promise<PrintLabPublicOrder> {
    const order = await this.validatedOrder(orderId, token);
    const [collection, imageMap] = await Promise.all([
      order.collectionId
        ? this.collectionModel
            .findOne({ _id: order.collectionId, userId: order.userId })
            .lean()
        : Promise.resolve(null),
      this.loadImages(order),
    ]);

    return {
      id: idOf(order),
      orderNumber: String(order.orderNumber ?? ''),
      galleryName: String(collection?.name ?? ''),
      mode: order.checkoutSource === 'print-request' ? 'free' : 'paid',
      customer: {
        name: String(order.customer?.name ?? ''),
        email: String(order.customer?.email ?? ''),
        ...(order.customer?.phone ? { phone: String(order.customer.phone) } : {}),
        ...(order.customer?.address ? { address: order.customer.address } : {}),
      },
      items: (order.items ?? []).map((item: any) => {
        const image = item.imageId ? imageMap.get(String(item.imageId)) : undefined;
        return {
          ...(item.imageId ? { imageId: String(item.imageId) } : {}),
          filename: filenameFor(image, item),
          available: Boolean(image?.url),
          name: String(item.name ?? ''),
          type: String(item.type ?? ''),
          ...(item.variantLabel ? { variantLabel: String(item.variantLabel) } : {}),
          options: normalizeOptions(item.options),
          ...(item.crop ? { crop: item.crop } : {}),
          quantity: finiteNumber(item.quantity, 1),
        };
      }),
      shippingMethodName: String(order.shippingMethodName ?? ''),
      shippingNote: String(order.shippingNote ?? ''),
      note: String(order.note ?? ''),
      ...((order as any).createdAt ? { createdAt: new Date((order as any).createdAt) } : {}),
    };
  }

  async authorizeImage(
    orderId: string,
    imageId: string,
    token: string,
  ): Promise<{ url: string; filename: string }> {
    if (!Types.ObjectId.isValid(orderId) || !Types.ObjectId.isValid(imageId)) throw unavailable();
    const order = await this.validatedOrder(orderId, token);
    const ownsImage = (order.items ?? []).some(
      (item: any) => item.imageId && String(item.imageId) === String(imageId),
    );
    if (!ownsImage || !order.collectionId) throw unavailable();

    const image = await this.imageModel
      .findOne({
        _id: imageId,
        userId: order.userId,
        collectionId: order.collectionId,
      })
      .lean();
    if (!image?.url) throw unavailable();
    return {
      url: String(image.url),
      filename: safeFilename(image.originalName || image.filename || `image-${imageId}`),
    };
  }

  async resend(userId: string, orderId: string): Promise<PrintLabDeliveryResult> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found');
    const order = await this.orderModel.findOne({ _id: orderId, userId }).lean();
    if (!order) throw new NotFoundException('Order not found');
    if (!['sent', 'failed'].includes(String(order.printLabNotificationStatus))) {
      throw new BadRequestException('Print lab notification cannot be resent');
    }
    const mode: NotificationMode = order.checkoutSource === 'print-request' ? 'free' : 'paid';
    if (mode === 'paid' && order.paymentStatus !== 'paid') {
      throw new BadRequestException('Paid order is not paid');
    }
    const collection = order.collectionId
      ? await this.collectionModel
          .findOne({ _id: order.collectionId, userId: order.userId })
          .lean()
      : null;
    const settings = ((collection?.settings as any)?.store ?? {}) as Record<string, unknown>;
    const recipient = String(settings.printLabEmail ?? '').trim();
    if (!isValidEmail(recipient)) {
      throw new BadRequestException('Print lab recipient is invalid');
    }
    const enabled =
      mode === 'free'
        ? settings.notifyPrintLabForFreeRequests === true
        : settings.notifyPrintLabForPaidOrders === true;
    if (!enabled) throw new BadRequestException('Print lab notification is disabled');

    const result = await this.deliver(
      orderId,
      order,
      collection,
      mode,
      recipient,
      true,
      userId,
    );
    if (result.status === 'skipped') {
      throw new BadRequestException('Print lab notification cannot be resent');
    }
    return result;
  }

  private async validatedOrder(orderId: string, token: string): Promise<any> {
    if (!Types.ObjectId.isValid(orderId)) throw unavailable();
    const order = await this.orderModel.findOne({ _id: orderId }).lean();
    if (!order) throw unavailable();

    const suppliedHash = Buffer.from(hashToken(String(token ?? '')), 'hex');
    const storedHash = /^[a-f0-9]{64}$/i.test(String(order.printLabAccessTokenHash ?? ''))
      ? Buffer.from(String(order.printLabAccessTokenHash), 'hex')
      : Buffer.alloc(32);
    const validToken = timingSafeEqual(storedHash, suppliedHash);
    const expiresAt = new Date(order.printLabAccessExpiresAt ?? 0).getTime();
    if (!validToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw unavailable();
    return order;
  }

  private async loadImages(order: any): Promise<Map<string, any>> {
    const imageIds: string[] = Array.from(
      new Set<string>(
        (order.items ?? [])
          .map((item: any) => (item.imageId ? String(item.imageId) : ''))
          .filter(Boolean),
      ),
    );
    if (!imageIds.length || !order.collectionId) return new Map();
    const images = await this.imageModel
      .find({
        _id: { $in: imageIds },
        userId: order.userId,
        collectionId: order.collectionId,
      })
      .lean();
    return new Map((images ?? []).map((image: any) => [idOf(image), image]));
  }

  private secureLink(orderId: string, token: string) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return `${frontendUrl.replace(/\/+$/, '')}/print-lab/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`;
  }

  private async persistTerminal(
    orderId: string,
    tokenHash: string,
    status: 'sent' | 'failed',
  ) {
    const update =
      status === 'sent'
        ? {
            $set: {
              printLabNotificationStatus: 'sent' as const,
              printLabNotificationSentAt: new Date(),
              printLabNotificationError: '',
            },
            $unset: { printLabNotificationClaimedAt: 1 },
          }
        : {
            $set: {
              printLabNotificationStatus: 'failed' as const,
              printLabNotificationError: 'Print lab email delivery failed.',
            },
            $unset: { printLabNotificationClaimedAt: 1, printLabNotificationSentAt: 1 },
          };
    for (let attempt = 0; attempt < TERMINAL_WRITE_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.orderModel.updateOne(
          {
            _id: orderId,
            printLabNotificationStatus: 'pending',
            printLabAccessTokenHash: tokenHash,
          },
          update,
        );
        if (writeMatched(result)) return true;
      } catch {
        // Bounded immediate retry keeps SMTP outcome separate from database persistence.
      }
    }
    return false;
  }

  private async recoverStaleClaim(orderId: string) {
    const cutoff = new Date(Date.now() - CLAIM_STALE_AFTER_MS);
    for (let attempt = 0; attempt < TERMINAL_WRITE_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.orderModel.updateOne(
          {
            _id: orderId,
            printLabNotificationStatus: 'pending',
            printLabNotificationClaimedAt: { $lte: cutoff },
          },
          {
            $set: {
              printLabNotificationStatus: 'failed',
              printLabNotificationError: 'Previous print lab delivery attempt did not complete.',
            },
            $unset: { printLabNotificationClaimedAt: 1 },
          },
        );
        if (writeMatched(result)) return true;
      } catch {
        // Leave claim locked when recovery persistence is unavailable.
      }
    }
    return false;
  }
}

function buildMailPayload(
  order: any,
  collection: any,
  images: Map<string, any>,
  mode: NotificationMode,
  recipient: string,
  link: string,
  expiresAt: Date,
) {
  const modeLabel = mode === 'free' ? 'Free print request' : 'Paid print order';
  const galleryName = String(collection?.name ?? 'Gallery');
  const customer = order.customer ?? {};
  const items = (order.items ?? []).map((item: any, index: number) => {
    const image = item.imageId ? images.get(String(item.imageId)) : undefined;
    return {
      index: index + 1,
      filename: filenameFor(image, item),
      product: String(item.name ?? item.type ?? ''),
      variant: String(item.variantLabel ?? ''),
      options: Object.entries(normalizeOptions(item.options)),
      quantity: finiteNumber(item.quantity, 1),
    };
  });

  const htmlItems = items
    .map((item) => {
      const options = item.options.map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`);
      if (item.variant && !item.options.some(([key]) => key.toLowerCase() === 'size')) {
        options.unshift(`Size: ${escapeHtml(item.variant)}`);
      }
      return `<tr><td>${item.index}</td><td>${escapeHtml(item.filename)}</td><td>${escapeHtml(item.product)}</td><td>${options.join('<br>')}</td><td>Quantity: ${item.quantity}</td></tr>`;
    })
    .join('');
  const textItems = items
    .map((item) => {
      const options = item.options.map(([key, value]) => `${key}: ${value}`);
      if (item.variant && !item.options.some(([key]) => key.toLowerCase() === 'size')) {
        options.unshift(`Size: ${item.variant}`);
      }
      return `${item.index}. ${item.filename} — ${item.product}; ${options.join('; ')}; Quantity: ${item.quantity}`;
    })
    .join('\n');
  const notes = [String(order.note ?? ''), String(order.shippingNote ?? '')]
    .filter(Boolean)
    .join(' | ');
  const expires = expiresAt.toISOString().slice(0, 10);

  return {
    to: recipient,
    subject: sanitizeLine(`${modeLabel}: ${order.orderNumber} — ${galleryName}`),
    html: [
      `<h1>${escapeHtml(modeLabel)}</h1>`,
      `<p>Gallery: ${escapeHtml(galleryName)}<br>Order: ${escapeHtml(order.orderNumber)}<br>Customer: ${escapeHtml(customer.name)} (${escapeHtml(customer.email)})</p>`,
      `<table><thead><tr><th>#</th><th>Filename</th><th>Product</th><th>Options</th><th>Quantity</th></tr></thead><tbody>${htmlItems}</tbody></table>`,
      notes ? `<p>Notes: ${escapeHtml(notes)}</p>` : '',
      `<p><a href="${escapeHtml(link)}">Open print order</a></p>`,
      `<p>Link expires: ${escapeHtml(expires)}</p>`,
    ].join(''),
    text: [
      modeLabel,
      `Gallery: ${galleryName}`,
      `Order: ${order.orderNumber}`,
      `Customer: ${customer.name} (${customer.email})`,
      textItems,
      notes ? `Notes: ${notes}` : '',
      `Open print order: ${link}`,
      `Link expires: ${expires}`,
    ]
      .filter(Boolean)
      .map(sanitizeText)
      .join('\n'),
  };
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function unavailable() {
  return new NotFoundException('Print order unavailable');
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function idOf(value: any) {
  return String(value?.id ?? value?._id ?? '');
}

function normalizeOptions(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, option]) => [
      String(key),
      String(option ?? ''),
    ]),
  );
}

function filenameFor(image: any, item: any) {
  return safeFilename(
    image?.originalName || image?.filename || item?.filename || item?.name || 'image',
  );
}

function safeFilename(value: unknown) {
  const leaf = String(value ?? '').split(/[\\/]/).pop() ?? '';
  let filename = leaf
    .replace(/[^A-Za-z0-9._() &+-]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '');
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(filename)) {
    filename = `_${filename}`;
  }
  if (filename.length > 120) {
    const dot = filename.lastIndexOf('.');
    const extension = dot > 0 && filename.length - dot <= 10 ? filename.slice(dot) : '';
    filename = `${filename.slice(0, 120 - extension.length).replace(/[. ]+$/g, '')}${extension}`;
  }
  return filename || 'image';
}

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeLine(value: unknown) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function sanitizeText(value: unknown) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function modeMatchesOrder(order: any, mode: NotificationMode) {
  return mode === 'free'
    ? order.checkoutSource === 'print-request'
    : order.checkoutSource !== 'print-request' && order.paymentStatus === 'paid';
}

function writeMatched(result: any) {
  return Number(result?.matchedCount ?? result?.modifiedCount ?? 0) > 0;
}

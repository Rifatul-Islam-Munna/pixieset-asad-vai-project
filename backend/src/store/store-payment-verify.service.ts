import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StoreActivity, StoreActivityDocument, StoreActivityType } from './entities/store-activity.entity';
import { StoreCoupon, StoreCouponDocument } from './entities/store-coupon.entity';
import { StoreCustomer, StoreCustomerDocument } from './entities/store-customer.entity';
import { StoreOrder, StoreOrderDocument } from './entities/store-order.entity';
import { StoreSetting, StoreSettingDocument } from './entities/store-setting.entity';
import { StoreCatalogService, type ResolvedCollectionStore } from './store-catalog.service';
import { StoreStripeService } from './store-stripe.service';
import { StorePayPalService } from './store-paypal.service';
import { PrintLabNotificationService } from './print-lab-notification.service';

@Injectable()
export class StorePaymentVerifyService {
  constructor(
    private readonly catalog: StoreCatalogService,
    private readonly stripe: StoreStripeService,
    private readonly paypal: StorePayPalService,
    @InjectModel(StoreOrder.name)
    private readonly orderModel: Model<StoreOrderDocument>,
    @InjectModel(StoreCustomer.name)
    private readonly customerModel: Model<StoreCustomerDocument>,
    @InjectModel(StoreCoupon.name)
    private readonly couponModel: Model<StoreCouponDocument>,
    @InjectModel(StoreSetting.name)
    private readonly settingModel: Model<StoreSettingDocument>,
    @InjectModel(StoreActivity.name)
    private readonly activityModel: Model<StoreActivityDocument>,
    private readonly printLabNotification: PrintLabNotificationService,
  ) {}

  async checkoutSession(sessionId: string) {
    const order = await this.orderModel.findOne({ stripeCheckoutSessionId: sessionId });
    if (!order) throw new NotFoundException('Checkout order not found');
    const session = await this.stripe.retrieveCheckoutSession(order);
    const paid = session.payment_status === 'paid';
    const becamePaid = paid && order.paymentStatus !== 'paid';
    order.stripePaymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    if (paid) {
      order.paymentStatus = 'paid';
      order.status = 'processing';
      order.paymentProvider = 'stripe';
    }
    if (order.collectionId) {
      const resolved = await this.catalog.resolve(order.collectionId, false);
      const activity = await this.logPaymentOnce(
        resolved,
        order,
        paid ? 'payment_succeeded' : 'payment_failed',
        {
          orderId: order._id.toString(),
          amount: order.total,
          currency: session.currency?.toUpperCase(),
          source: order.checkoutSource,
        },
      );
      if (activity?._id) {
        order.activityLogIds = [...(order.activityLogIds ?? []), activity._id.toString()];
      }
    }
    await order.save();
    if (becamePaid) {
      void this.printLabNotification.notify(order._id.toString(), 'paid').catch(() => undefined);
    }
    const couponId = session.metadata?.couponId || order.couponId;
    if (becamePaid && couponId) {
      await this.couponModel.updateOne({ _id: couponId }, { $inc: { usageCount: 1 } });
    }
    if (becamePaid) {
      await this.recalculateCustomer(order.userId, order.customer?.email);
    }
    return {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      orderId: order._id.toString(),
      success: paid,
    };
  }

  async capturePayPalCheckout(paypalOrderId: string) {
    const order = await this.orderModel.findOne({ paypalOrderId });
    if (!order) throw new NotFoundException('PayPal checkout order not found');
    const paypalOrder = await this.paypal.captureCheckoutOrder(order);
    const capture = paypalOrder?.purchase_units?.[0]?.payments?.captures?.find((item: any) => item?.status === 'COMPLETED');
    const becamePaid = order.paymentStatus !== 'paid';
    order.paymentStatus = 'paid';
    order.status = 'processing';
    order.paymentProvider = 'paypal';
    if (capture?.id) order.paypalCaptureId = String(capture.id);
    if (order.collectionId) {
      const resolved = await this.catalog.resolve(order.collectionId, false);
      const activity = await this.logPaymentOnce(
        resolved,
        order,
        'payment_succeeded',
        {
          orderId: order._id.toString(),
          amount: Number(capture?.amount?.value ?? order.total),
          currency: String(capture?.amount?.currency_code ?? 'EUR').toUpperCase(),
          source: order.checkoutSource,
          paymentProvider: 'paypal',
        },
      );
      if (activity?._id) order.activityLogIds = [...(order.activityLogIds ?? []), activity._id.toString()];
    }
    await order.save();
    if (becamePaid) {
      void this.printLabNotification.notify(order._id.toString(), 'paid').catch(() => undefined);
      if (order.couponId) await this.couponModel.updateOne({ _id: order.couponId }, { $inc: { usageCount: 1 } });
      await this.recalculateCustomer(order.userId, order.customer?.email);
    }
    return {
      paypalOrderId,
      paymentStatus: 'paid',
      status: paypalOrder?.status,
      orderId: order._id.toString(),
      success: true,
    };
  }

  async handlePayPalWebhook(headers: any, event: any, rawBody?: Buffer) {
    const resource = event?.resource ?? {};
    const customId = String(resource?.custom_id ?? resource?.customId ?? resource?.purchase_units?.[0]?.custom_id ?? '');
    const relatedOrderId = String(resource?.supplementary_data?.related_ids?.order_id ?? '');
    let order: StoreOrderDocument | null = null;
    if (customId.startsWith('store:')) {
      order = await this.orderModel.findById(customId.slice('store:'.length));
    }
    if (!order && relatedOrderId) order = await this.orderModel.findOne({ paypalOrderId: relatedOrderId });
    if (!order && resource?.id) order = await this.orderModel.findOne({ paypalOrderId: String(resource.id) });
    if (!order) return { received: true, verified: false, processed: false, reason: 'store-order-not-found' };

    const verification = await this.paypal.verifyWebhook(order, headers, event, rawBody);
    if (!verification.verified) {
      return { received: true, verified: false, processed: false, reason: verification.reason };
    }
    const eventType = String(event?.event_type ?? event?.eventType ?? '');
    if (!['PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.COMPLETED'].includes(eventType)) {
      return { received: true, verified: true, processed: false, reason: 'event-not-used' };
    }
    if (!order.paypalOrderId) return { received: true, verified: true, processed: false, reason: 'paypal-order-id-missing' };
    const result = await this.capturePayPalCheckout(order.paypalOrderId);
    return { received: true, verified: true, processed: Boolean(result.success), orderId: result.orderId };
  }
  async createPublicIntent(identifier: string, body: any, siteSlug?: string) {
    const resolved = await this.catalog.resolve(identifier, true, siteSlug);
    const order = await this.orderModel.findOne({
      _id: body.orderId,
      userId: resolved.userId,
      collectionId: resolved.collection._id.toString(),
    });
    if (!order) throw new NotFoundException('Order not found');
    const result = await this.stripe.createOrderIntent(resolved, order);
    order.stripePaymentIntentId = result.intent.id;
    await order.save();
    return result.response;
  }

  async verifyPublicIntent(identifier: string, paymentIntentId: string, siteSlug?: string) {
    const resolved = await this.catalog.resolve(identifier, true, siteSlug);
    const order = await this.orderModel.findOne({
      userId: resolved.userId,
      collectionId: resolved.collection._id.toString(),
      stripePaymentIntentId: paymentIntentId,
    });
    if (!order) throw new NotFoundException('Order not found');
    const intent = await this.stripe.retrieveOrderIntent(resolved, paymentIntentId);
    const success = intent.status === 'succeeded';
    const becamePaid = success && order.paymentStatus !== 'paid';
    if (success) {
      order.paymentStatus = 'paid';
      order.status = 'processing';
    }
    const activity = await this.logPaymentOnce(
      resolved,
      order,
      success ? 'payment_succeeded' : 'payment_failed',
      {
        orderId: order._id.toString(),
        amount: intent.amount / 100,
        currency: intent.currency.toUpperCase(),
        source: order.checkoutSource,
      },
    );
    if (activity?._id) {
      order.activityLogIds = [...(order.activityLogIds ?? []), activity._id.toString()];
    }
    await order.save();
    if (becamePaid) {
      void this.printLabNotification.notify(order._id.toString(), 'paid').catch(() => undefined);
      await this.recalculateCustomer(order.userId, order.customer?.email);
    }
    return {
      paymentIntentId: intent.id,
      status: intent.status,
      success,
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
      orderId: order._id.toString(),
    };
  }

  async createOwnerIntent(userId: string, body: any) {
    const order = body.orderId
      ? await this.orderModel.findOne({ _id: body.orderId, userId }).lean()
      : null;
    const amount = Number(order?.total ?? body.amount ?? 0);
    if (amount <= 0) throw new BadRequestException('Payment amount is invalid');
    const currency = 'EUR';
    return this.stripe.createOwnerIntent(userId, { amount, currency, orderId: body.orderId });
  }

  async verifyOwnerIntent(userId: string, paymentIntentId: string) {
    const intent = await this.stripe.retrieveOwnerIntent(userId, paymentIntentId);
    return {
      paymentIntentId: intent.id,
      status: intent.status,
      success: intent.status === 'succeeded',
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
    };
  }

  private async logPaymentOnce(
    resolved: ResolvedCollectionStore,
    order: StoreOrderDocument,
    type: Extract<StoreActivityType, 'payment_succeeded' | 'payment_failed'>,
    metadata: Record<string, unknown>,
  ) {
    const orderId = order._id.toString();
    const exists = await this.activityModel.exists({
      userId: resolved.userId,
      collectionId: resolved.collection._id.toString(),
      type,
      'metadata.orderId': orderId,
    });
    if (exists) return null;
    return this.catalog.log(resolved, type, metadata, order.customer?.email);
  }

  private async recalculateCustomer(userId: string, email?: string) {
    if (!email) return;
    const orders = await this.orderModel.find({ userId, 'customer.email': email }).sort({ createdAt: -1 }).lean();
    const paid = orders.filter((order) => order.paymentStatus === 'paid' && order.status !== 'cancelled');
    await this.customerModel.updateOne(
      { userId, email },
      {
        $set: {
          orderCount: orders.length,
          totalSpent: paid.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
          lastOrderAt: (orders[0] as any)?.createdAt,
        },
      },
    );
  }
}

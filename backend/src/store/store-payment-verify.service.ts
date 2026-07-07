import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StoreCoupon, StoreCouponDocument } from './entities/store-coupon.entity';
import { StoreCustomer, StoreCustomerDocument } from './entities/store-customer.entity';
import { StoreOrder, StoreOrderDocument } from './entities/store-order.entity';
import { StoreSetting, StoreSettingDocument } from './entities/store-setting.entity';
import { StoreCatalogService } from './store-catalog.service';
import { StoreStripeService } from './store-stripe.service';

@Injectable()
export class StorePaymentVerifyService {
  constructor(
    private readonly catalog: StoreCatalogService,
    private readonly stripe: StoreStripeService,
    @InjectModel(StoreOrder.name)
    private readonly orderModel: Model<StoreOrderDocument>,
    @InjectModel(StoreCustomer.name)
    private readonly customerModel: Model<StoreCustomerDocument>,
    @InjectModel(StoreCoupon.name)
    private readonly couponModel: Model<StoreCouponDocument>,
    @InjectModel(StoreSetting.name)
    private readonly settingModel: Model<StoreSettingDocument>,
  ) {}

  async checkoutSession(sessionId: string) {
    const order = await this.orderModel.findOne({ stripeCheckoutSessionId: sessionId });
    if (!order) throw new NotFoundException('Checkout order not found');
    const session = await this.stripe.retrieveCheckoutSession(order);
    const paid = session.payment_status === 'paid';
    order.stripePaymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    if (paid) {
      order.paymentStatus = 'paid';
      order.status = 'processing';
    }
    if (order.collectionId) {
      const resolved = await this.catalog.resolve(order.collectionId, false);
      const activity = await this.catalog.log(
        resolved,
        paid ? 'payment_succeeded' : 'payment_failed',
        {
          orderId: order._id.toString(),
          amount: order.total,
          currency: session.currency?.toUpperCase(),
          source: order.checkoutSource,
        },
        order.customer?.email,
      );
      if (activity?._id) {
        order.activityLogIds = [...(order.activityLogIds ?? []), activity._id.toString()];
      }
    }
    await order.save();
    if (paid && session.metadata?.couponId) {
      await this.couponModel.updateOne({ _id: session.metadata.couponId }, { $inc: { usageCount: 1 } });
    }
    await this.recalculateCustomer(order.userId, order.customer?.email);
    return {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      orderId: order._id.toString(),
      success: paid,
    };
  }

  async createPublicIntent(identifier: string, body: any) {
    const resolved = await this.catalog.resolve(identifier);
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

  async verifyPublicIntent(identifier: string, paymentIntentId: string) {
    const resolved = await this.catalog.resolve(identifier);
    const order = await this.orderModel.findOne({
      userId: resolved.userId,
      collectionId: resolved.collection._id.toString(),
      stripePaymentIntentId: paymentIntentId,
    });
    if (!order) throw new NotFoundException('Order not found');
    const intent = await this.stripe.retrieveOrderIntent(resolved, paymentIntentId);
    const success = intent.status === 'succeeded';
    if (success) {
      order.paymentStatus = 'paid';
      order.status = 'processing';
    }
    const activity = await this.catalog.log(
      resolved,
      success ? 'payment_succeeded' : 'payment_failed',
      {
        orderId: order._id.toString(),
        amount: intent.amount / 100,
        currency: intent.currency.toUpperCase(),
        source: order.checkoutSource,
      },
      order.customer?.email,
    );
    if (activity?._id) {
      order.activityLogIds = [...(order.activityLogIds ?? []), activity._id.toString()];
    }
    await order.save();
    await this.recalculateCustomer(order.userId, order.customer?.email);
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
    const settings = await this.settingModel.findOne({ userId }).lean();
    const order = body.orderId
      ? await this.orderModel.findOne({ _id: body.orderId, userId }).lean()
      : null;
    const amount = Number(order?.total ?? body.amount ?? 0);
    if (amount <= 0) throw new BadRequestException('Payment amount is invalid');
    const currency = String(body.currency || settings?.currency || 'EUR');
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

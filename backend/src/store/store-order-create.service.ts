import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StoreCustomer, StoreCustomerDocument } from './entities/store-customer.entity';
import { StoreOrder, StoreOrderDocument } from './entities/store-order.entity';
import { StoreCatalogService } from './store-catalog.service';
import { StorePricingService } from './store-pricing.service';
import { StoreStripeService } from './store-stripe.service';
import { StorePayPalService } from './store-paypal.service';
import { PrintLabNotificationService } from './print-lab-notification.service';

@Injectable()
export class StoreOrderCreateService {
  constructor(
    private readonly catalog: StoreCatalogService,
    private readonly pricing: StorePricingService,
    private readonly stripe: StoreStripeService,
    @InjectModel(StoreOrder.name)
    private readonly orderModel: Model<StoreOrderDocument>,
    @InjectModel(StoreCustomer.name)
    private readonly customerModel: Model<StoreCustomerDocument>,
    private readonly printLabNotification: PrintLabNotificationService,
    private readonly paypal: StorePayPalService,
  ) {}

  async checkout(identifier: string, body: any, siteSlug?: string) {
    const priced = await this.pricing.price(identifier, body, siteSlug);
    const { resolved, customer } = priced;
    const printRequestMode = Boolean(body.printRequest);
    if (!customer.email || !customer.email.includes('@')) {
      throw new BadRequestException('A valid email is required');
    }
    if (!printRequestMode && resolved.config.requireProfessionalInfo && !priced.professionalInfo?.company) {
      throw new BadRequestException('Professional information is required');
    }
    let paymentProvider: 'stripe' | 'paypal' | '' = '';
    if (!printRequestMode) {
      const stripeReady = this.catalog.stripeReady(this.catalog.ownerStripe(resolved.settings));
      const paypalReady = this.catalog.paypalReady(this.catalog.ownerPayPal(resolved.settings));
      paymentProvider = body.paymentProvider === 'paypal' ? 'paypal' : body.paymentProvider === 'stripe' ? 'stripe' : '';
      if (!paymentProvider) {
        if (stripeReady && !paypalReady) paymentProvider = 'stripe';
        else if (paypalReady && !stripeReady) paymentProvider = 'paypal';
        else if (stripeReady && paypalReady) throw new BadRequestException('Choose Stripe or PayPal');
        else throw new BadRequestException(this.catalog.paymentMessage(this.catalog.ownerStripe(resolved.settings), this.catalog.ownerPayPal(resolved.settings)));
      }
      if (paymentProvider === 'stripe' && !stripeReady) throw new BadRequestException('Stripe is not configured for this store');
      if (paymentProvider === 'paypal' && !paypalReady) throw new BadRequestException('PayPal is not configured for this store');
    }
    const savedCustomer = await this.customerModel.findOneAndUpdate(
      { userId: resolved.userId, email: customer.email },
      {
        $set: {
          name: customer.name || customer.email,
          phone: customer.phone,
          address: customer.address,
          lastOrderAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    const source = printRequestMode
      ? 'print-request'
      : body.checkoutSource === 'public-gallery' || body.checkoutSource === 'buy-photo'
        ? body.checkoutSource
        : 'public-store';
    const order = await this.orderModel.create({
      userId: resolved.userId,
      collectionId: resolved.collection._id.toString(),
      priceSheetId: resolved.sheet?._id?.toString(),
      orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      customerId: savedCustomer?._id?.toString(),
      customer,
      professionalInfo: priced.professionalInfo,
      items: priced.items,
      subtotal: priced.subtotal,
      tax: priced.tax,
      shipping: priced.shipping,
      shippingMethodId: priced.shippingMethod?._id?.toString(),
      shippingMethodName: priced.shippingMethod?.name ?? '',
      shippingNote: priced.shippingMethod?.region ?? '',
      discount: priced.discount,
      couponId: priced.coupon?._id?.toString(),
      total: priced.total,
      status: 'pending',
      paymentStatus: printRequestMode ? 'not-required' : 'unpaid',
      paymentProvider: paymentProvider || undefined,
      stripeAccountMode: 'owner',
      checkoutSource: source,
      note: String(body.note ?? ''),
    });
    const logs = await Promise.all([
      this.catalog.log(resolved, 'checkout_started', {
        orderId: order._id.toString(), amount: priced.total, currency: priced.currency, source,
      }, customer.email),
      this.catalog.log(resolved, 'order_created', {
        orderId: order._id.toString(), amount: priced.total, currency: priced.currency, source,
      }, customer.email),
    ]);
    order.activityLogIds = logs.map((entry) => entry?._id?.toString()).filter(Boolean) as string[];
    if (printRequestMode) {
      await order.save();
      void this.printLabNotification.notify(order._id.toString(), 'free').catch(() => undefined);
      return {
        order: order.toObject(),
        paymentUnavailable: false,
        checkoutUrl: null,
        sessionId: null,
        printRequest: true,
        completed: true,
      };
    }
    if (paymentProvider === 'paypal') {
      const paypalCheckout = await this.paypal.createCheckoutOrder(priced, order, body);
      order.paypalOrderId = paypalCheckout.paypalOrderId;
      await order.save();
      return {
        order: order.toObject(),
        paymentUnavailable: false,
        paymentProvider: 'paypal',
        checkoutUrl: paypalCheckout.checkoutUrl,
        paypalOrderId: paypalCheckout.paypalOrderId,
        sessionId: null,
        printRequest: false,
        completed: false,
      };
    }
    const session = await this.stripe.createCheckoutSession(priced, order, body);
    order.stripeCheckoutSessionId = session.id;
    await order.save();
    return {
      order: order.toObject(),
      paymentUnavailable: false,
      paymentProvider: 'stripe',
      checkoutUrl: session.url,
      sessionId: session.id,
      printRequest: false,
      completed: false,
    };
  }
}

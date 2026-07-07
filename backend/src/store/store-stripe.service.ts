import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { StoreOrder, StoreOrderDocument } from './entities/store-order.entity';
import { StoreSetting, StoreSettingDocument } from './entities/store-setting.entity';
import { ResolvedCollectionStore, StoreCatalogService } from './store-catalog.service';

@Injectable()
export class StoreStripeService {
  constructor(
    private readonly catalog: StoreCatalogService,
    @InjectModel(StoreSetting.name)
    private readonly settingModel: Model<StoreSettingDocument>,
  ) {}

  async createCheckoutSession(priced: any, order: StoreOrderDocument, body: any) {
    const config = this.catalog.ownerStripe(priced.resolved.settings);
    this.requireReady(config);
    const stripe = new Stripe(config.secretKey);
    const currency = priced.currency.toLowerCase();
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priced.items.map((item: any) => ({
      quantity: item.quantity,
      price_data: {
        currency,
        unit_amount: this.amount(item.unitPrice, currency),
        product_data: {
          name: item.variantLabel ? `${item.name} - ${item.variantLabel}` : item.name,
          images: item.imageUrl && /^https?:\/\//.test(item.imageUrl) ? [item.imageUrl] : undefined,
          metadata: { productId: item.productId || '', imageId: item.imageId || '' },
        },
      },
    }));
    if (priced.shipping > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: this.amount(priced.shipping, currency),
          product_data: { name: priced.shippingMethod?.name || 'Shipping' },
        },
      });
    }
    if (priced.tax > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: this.amount(priced.tax, currency),
          product_data: { name: 'Tax' },
        },
      });
    }
    const coupon = priced.discount > 0
      ? await stripe.coupons.create({
          amount_off: this.amount(priced.discount, currency),
          currency,
          duration: 'once',
          name: priced.coupon?.code || 'Discount',
        })
      : null;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      discounts: coupon ? [{ coupon: coupon.id }] : undefined,
      customer_email: order.customer?.email,
      payment_intent_data: {
        receipt_email: order.customer?.email,
        metadata: {
          orderId: order._id.toString(),
          collectionId: order.collectionId || '',
          ownerUserId: order.userId,
        },
      },
      success_url: body.successUrl || `${frontendUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancelUrl || `${frontendUrl}/store/cancel`,
      metadata: {
        orderId: order._id.toString(),
        collectionId: order.collectionId || '',
        ownerUserId: order.userId,
        couponId: priced.coupon?._id?.toString() ?? '',
      },
    });
  }

  async retrieveCheckoutSession(order: StoreOrderDocument) {
    const settings = await this.settingModel.findOne({ userId: order.userId }).lean();
    const config = this.catalog.ownerStripe(settings);
    if (!config.secretKey) throw new BadRequestException('Store owner Stripe secret key is missing');
    const stripe = new Stripe(config.secretKey);
    return stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId || '');
  }

  async createOrderIntent(resolved: ResolvedCollectionStore, order: StoreOrderDocument) {
    const config = this.catalog.ownerStripe(resolved.settings);
    this.requireReady(config);
    const currency = resolved.config.currency.toLowerCase();
    const stripe = new Stripe(config.secretKey);
    const intent = await stripe.paymentIntents.create({
      amount: this.amount(order.total, currency),
      currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: order.customer?.email,
      metadata: {
        orderId: order._id.toString(),
        collectionId: resolved.collection._id.toString(),
        ownerUserId: resolved.userId,
      },
    });
    return {
      intent,
      response: {
        publishableKey: config.publishableKey,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        status: intent.status,
      },
    };
  }

  async retrieveOrderIntent(resolved: ResolvedCollectionStore, paymentIntentId: string) {
    const config = this.catalog.ownerStripe(resolved.settings);
    if (!config.secretKey) throw new BadRequestException('Store owner Stripe secret key is missing');
    const stripe = new Stripe(config.secretKey);
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async createOwnerIntent(userId: string, input: { amount: number; currency: string; orderId?: string }) {
    const settings = await this.settingModel.findOne({ userId }).lean();
    const config = this.catalog.ownerStripe(settings);
    this.requireReady(config);
    const currency = input.currency.toLowerCase();
    const stripe = new Stripe(config.secretKey);
    const intent = await stripe.paymentIntents.create({
      amount: this.amount(input.amount, currency),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { ownerUserId: userId, orderId: input.orderId || '' },
    });
    return {
      publishableKey: config.publishableKey,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
    };
  }

  async retrieveOwnerIntent(userId: string, paymentIntentId: string) {
    const settings = await this.settingModel.findOne({ userId }).lean();
    const config = this.catalog.ownerStripe(settings);
    if (!config.secretKey) throw new BadRequestException('Store owner Stripe secret key is missing');
    const stripe = new Stripe(config.secretKey);
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  private requireReady(config: { enabled: boolean; publishableKey: string; secretKey: string }) {
    if (!config.enabled || !config.publishableKey || !config.secretKey) {
      throw new BadRequestException(this.catalog.stripeMessage(config));
    }
  }

  private amount(value: number, currency: string) {
    const zeroDecimal = new Set([
      'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg',
      'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
    ]);
    return Math.max(1, Math.round(Number(value ?? 0) * (zeroDecimal.has(currency) ? 1 : 100)));
  }
}

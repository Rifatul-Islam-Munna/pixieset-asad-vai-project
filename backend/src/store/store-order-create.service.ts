import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StoreCustomer, StoreCustomerDocument } from './entities/store-customer.entity';
import { StoreOrder, StoreOrderDocument } from './entities/store-order.entity';
import { StoreCatalogService } from './store-catalog.service';
import { StorePricingService } from './store-pricing.service';
import { StoreStripeService } from './store-stripe.service';

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
  ) {}

  async checkout(identifier: string, body: any) {
    const priced = await this.pricing.price(identifier, body);
    const { resolved, customer } = priced;
    if (!customer.email || !customer.email.includes('@')) {
      throw new BadRequestException('A valid email is required');
    }
    if (resolved.config.requireProfessionalInfo && !priced.professionalInfo?.company) {
      throw new BadRequestException('Professional information is required');
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
    const source = body.checkoutSource === 'public-gallery' || body.checkoutSource === 'buy-photo'
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
      total: priced.total,
      status: 'pending',
      paymentStatus: 'unpaid',
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
    const session = await this.stripe.createCheckoutSession(priced, order, body);
    order.stripeCheckoutSessionId = session.id;
    await order.save();
    return {
      order: order.toObject(),
      paymentUnavailable: false,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }
}

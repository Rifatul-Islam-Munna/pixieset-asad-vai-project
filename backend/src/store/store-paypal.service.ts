import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalOrder,
  paypalCaptureCompleted,
  verifyPayPalWebhookSignature,
  type PayPalConfig,
  type PayPalWebhookHeaders,
} from '../lib/paypal';
import { StoreOrder, StoreOrderDocument } from './entities/store-order.entity';
import { StoreSetting, StoreSettingDocument } from './entities/store-setting.entity';
import { StoreCatalogService } from './store-catalog.service';

@Injectable()
export class StorePayPalService {
  constructor(
    private readonly catalog: StoreCatalogService,
    @InjectModel(StoreSetting.name)
    private readonly settingModel: Model<StoreSettingDocument>,
  ) {}

  async createCheckoutOrder(priced: any, order: StoreOrderDocument, body: any) {
    const config = this.config(priced.resolved.settings);
    this.requireReady(config);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const result = await createPayPalOrder(config, {
      amount: Number(priced.total ?? 0),
      currency: String(priced.currency ?? 'EUR'),
      description: `Order ${order.orderNumber}`,
      customId: `store:${order._id.toString()}`,
      invoiceId: order.orderNumber,
      returnUrl: body.paypalSuccessUrl || `${frontendUrl}/store/success?provider=paypal`,
      cancelUrl: body.cancelUrl || `${frontendUrl}/store/cancel`,
    });
    return {
      order: result.order,
      checkoutUrl: result.approveUrl,
      paypalOrderId: String(result.order.id),
    };
  }

  async captureCheckoutOrder(order: StoreOrderDocument) {
    if (!order.paypalOrderId) throw new BadRequestException('PayPal order is missing');
    const settings = await this.settingModel.findOne({ userId: order.userId }).lean();
    const config = this.config(settings);
    this.requireReady(config);
    let paypalOrder = await getPayPalOrder(config, order.paypalOrderId);
    this.assertOrderMatches(paypalOrder, order);
    if (!paypalCaptureCompleted(paypalOrder)) {
      if (paypalOrder?.status !== 'APPROVED') {
        throw new BadRequestException('PayPal payment has not been approved');
      }
      paypalOrder = await capturePayPalOrder(config, order.paypalOrderId);
      this.assertOrderMatches(paypalOrder, order);
    }
    if (!paypalCaptureCompleted(paypalOrder)) {
      throw new BadRequestException('PayPal payment was not completed');
    }
    return paypalOrder;
  }

  async verifyWebhook(order: StoreOrderDocument, headers: PayPalWebhookHeaders, event: Record<string, unknown>, rawBody?: Buffer) {
    const settings = await this.settingModel.findOne({ userId: order.userId }).lean();
    const config = this.config(settings);
    if (!config.webhookId) return { verified: false, configured: false, reason: 'webhook-id-not-configured' };
    const result = await verifyPayPalWebhookSignature(config, headers, event, rawBody);
    return { ...result, configured: true };
  }

  private config(settings: any): PayPalConfig {
    const paypal = this.catalog.ownerPayPal(settings);
    return {
      enabled: paypal.enabled,
      environment: paypal.environment,
      clientId: paypal.clientId,
      clientSecret: paypal.clientSecret,
      webhookId: paypal.webhookId,
    };
  }

  private requireReady(config: PayPalConfig) {
    if (!config.enabled) throw new BadRequestException('PayPal is turned off');
    if (!config.clientId) throw new BadRequestException('PayPal client ID is missing');
    if (!config.clientSecret) throw new BadRequestException('PayPal client secret is missing');
  }

  private assertOrderMatches(paypalOrder: any, order: StoreOrderDocument) {
    const unit = paypalOrder?.purchase_units?.[0];
    if (String(unit?.custom_id ?? '') !== `store:${order._id.toString()}`) {
      throw new BadRequestException('PayPal order does not match this store order');
    }
    const captured = unit?.payments?.captures?.find((item: any) => item?.status === 'COMPLETED');
    const amount = captured?.amount ?? unit?.amount;
    const currency = String(amount?.currency_code ?? '').toUpperCase();
    const value = Number(amount?.value ?? NaN);
    const expected = Number(Number(order.total).toFixed(2));
    if (currency !== 'EUR' || !Number.isFinite(value) || Math.abs(value - expected) > 0.001) {
      throw new BadRequestException('PayPal payment amount does not match this order');
    }
  }
}


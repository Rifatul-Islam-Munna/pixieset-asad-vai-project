import { Injectable } from '@nestjs/common';
import { StoreCatalogService } from './store-catalog.service';
import { StorePricingService } from './store-pricing.service';
import { StoreOrderCreateService } from './store-order-create.service';
import { StorePaymentVerifyService } from './store-payment-verify.service';

@Injectable()
export class PublicStoreService {
  constructor(
    private readonly catalog: StoreCatalogService,
    private readonly pricing: StorePricingService,
    private readonly orders: StoreOrderCreateService,
    private readonly payments: StorePaymentVerifyService,
  ) {}

  getStore(identifier: string) {
    return this.catalog.getPublicStore(identifier);
  }

  getProduct(identifier: string, slug: string) {
    return this.catalog.getPublicProduct(identifier, slug);
  }

  getCartPrice(identifier: string, body: any) {
    return this.pricing.price(identifier, body);
  }

  createCheckout(identifier: string, body: any) {
    return this.orders.checkout(identifier, body);
  }

  getCheckoutResult(sessionId: string) {
    return this.payments.checkoutSession(sessionId);
  }

  makePublicIntent(identifier: string, body: any) {
    return this.payments.createPublicIntent(identifier, body);
  }

  checkPublicIntent(identifier: string, intentId: string) {
    return this.payments.verifyPublicIntent(identifier, intentId);
  }

  makeOwnerIntent(userId: string, body: any) {
    return this.payments.createOwnerIntent(userId, body);
  }

  checkOwnerIntent(userId: string, intentId: string) {
    return this.payments.verifyOwnerIntent(userId, intentId);
  }

  saveActivity(identifier: string, body: any) {
    return this.catalog.recordPublicActivity(identifier, body);
  }

  getActivity(userId: string, collectionId: string) {
    return this.catalog.listActivity(userId, collectionId);
  }

  addDefaults(userId: string, priceSheetId: string, replace = false) {
    return this.catalog.seedDefaults(userId, priceSheetId, replace);
  }
}

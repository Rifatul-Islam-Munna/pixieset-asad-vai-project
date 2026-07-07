import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublicStoreService } from './public-store.service';

@Controller('public/collections')
export class PublicPrintStoreController {
  constructor(private readonly store: PublicStoreService) {}

  @Get('store/checkout-session/:sessionId')
  async checkoutResult(@Param('sessionId') sessionId: string) {
    return { data: await this.store.getCheckoutResult(sessionId) };
  }

  @Get(':identifier/store')
  async storefront(@Param('identifier') identifier: string) {
    return { data: await this.store.getStore(identifier) };
  }

  @Get(':identifier/store/products/:slug')
  async product(@Param('identifier') identifier: string, @Param('slug') slug: string) {
    return { data: await this.store.getProduct(identifier, slug) };
  }

  @Post(':identifier/store/cart/price')
  async cartPrice(@Param('identifier') identifier: string, @Body() body: any) {
    return { data: await this.store.getCartPrice(identifier, body) };
  }

  @Post(':identifier/store/checkout')
  async checkout(@Param('identifier') identifier: string, @Body() body: any) {
    return { message: 'Checkout created', data: await this.store.createCheckout(identifier, body) };
  }

  @Post(':identifier/store/stripe-intent')
  async createIntent(@Param('identifier') identifier: string, @Body() body: any) {
    return { message: 'Payment intent created', data: await this.store.makePublicIntent(identifier, body) };
  }

  @Post(':identifier/store/stripe-verify')
  async verifyIntent(
    @Param('identifier') identifier: string,
    @Body('paymentIntentId') paymentIntentId: string,
  ) {
    const data = await this.store.checkPublicIntent(identifier, paymentIntentId);
    return { message: data.success ? 'Payment succeeded' : 'Payment not completed', data };
  }

  @Post(':identifier/store/activity')
  async activity(@Param('identifier') identifier: string, @Body() body: any) {
    return { data: await this.store.saveActivity(identifier, body) };
  }
}

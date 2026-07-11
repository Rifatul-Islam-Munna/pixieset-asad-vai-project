import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PublicStoreService } from './public-store.service';

@Controller('public/collections')
export class PublicPrintStoreController {
  constructor(private readonly store: PublicStoreService) {}

  @Get('store/checkout-session/:sessionId')
  async checkoutResult(@Param('sessionId') sessionId: string) {
    return { data: await this.store.getCheckoutResult(sessionId) };
  }

  @Get(':identifier/store')
  async storefront(@Param('identifier') identifier: string, @Query('siteSlug') siteSlug?: string) {
    return { data: await this.store.getStore(identifier, siteSlug) };
  }

  @Get(':identifier/store/products/:slug')
  async product(@Param('identifier') identifier: string, @Param('slug') slug: string, @Query('siteSlug') siteSlug?: string) {
    return { data: await this.store.getProduct(identifier, slug, siteSlug) };
  }

  @Post(':identifier/store/cart/price')
  async cartPrice(@Param('identifier') identifier: string, @Body() body: any, @Query('siteSlug') siteSlug?: string) {
    return { data: await this.store.getCartPrice(identifier, body, siteSlug) };
  }

  @Post(':identifier/store/checkout')
  async checkout(@Param('identifier') identifier: string, @Body() body: any, @Query('siteSlug') siteSlug?: string) {
    return { message: 'Checkout created', data: await this.store.createCheckout(identifier, body, siteSlug) };
  }

  @Post(':identifier/store/stripe-intent')
  async createIntent(@Param('identifier') identifier: string, @Body() body: any, @Query('siteSlug') siteSlug?: string) {
    return { message: 'Payment intent created', data: await this.store.makePublicIntent(identifier, body, siteSlug) };
  }

  @Post(':identifier/store/stripe-verify')
  async verifyIntent(
    @Param('identifier') identifier: string,
    @Body('paymentIntentId') paymentIntentId: string,
    @Query('siteSlug') siteSlug?: string,
  ) {
    const data = await this.store.checkPublicIntent(identifier, paymentIntentId, siteSlug);
    return { message: data.success ? 'Payment succeeded' : 'Payment not completed', data };
  }

  @Post(':identifier/store/activity')
  async activity(@Param('identifier') identifier: string, @Body() body: any, @Query('siteSlug') siteSlug?: string) {
    return { data: await this.store.saveActivity(identifier, body, siteSlug) };
  }
}

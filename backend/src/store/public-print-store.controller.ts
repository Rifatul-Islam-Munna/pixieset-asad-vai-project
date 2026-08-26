import { Body, Controller, Get, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicStoreService } from './public-store.service';
import { PrintLabNotificationService } from './print-lab-notification.service';

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



@Controller('public/print-lab')
export class PublicPrintLabController {
  constructor(private readonly printLab: PrintLabNotificationService) {}

  @Get('orders/:orderId')
  async printLabOrder(
    @Param('orderId') orderId: string,
    @Query('token') token?: string,
  ) {
    if (!token) throw new NotFoundException('Print order unavailable');
    return { data: await this.printLab.getPublicOrder(orderId, token) };
  }

  @Get('orders/:orderId/images/:imageId')
  async printLabImage(
    @Param('orderId') orderId: string,
    @Param('imageId') imageId: string,
    @Query('token') token: string | undefined,
    @Res() response: Response,
  ) {
    if (!token) throw new NotFoundException('Print order unavailable');
    const asset = await this.printLab.authorizeImage(orderId, imageId, token);
    const filename = asset.filename.replace(/["\r\n]/g, '_');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return response.redirect(asset.url);
  }
}

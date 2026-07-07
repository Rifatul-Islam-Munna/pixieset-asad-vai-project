import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { PublicStoreService } from './public-store.service';
import { StoreService } from './store.service';

@Controller('store/catalog')
@UseGuards(AuthGuard)
export class StorePrintAdminController {
  constructor(
    private readonly storeService: StoreService,
    private readonly printStore: PublicStoreService,
  ) {}

  @Get('activity/:collectionId')
  async activity(@Param('collectionId') collectionId: string, @Req() request: ExpressRequest) {
    return { data: await this.printStore.getActivity(request.user.id, collectionId) };
  }

  @Get('price-sheets')
  async priceSheets(
    @Req() request: ExpressRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    return { data: await this.storeService.findPriceSheets(request.user.id, collectionId) };
  }

  @Post('price-sheets/default')
  async createDefaultPriceSheet(@Body() body: any, @Req() request: ExpressRequest) {
    const sheet = await this.storeService.createPriceSheet(request.user.id, {
      name: body.name || 'Default Print Store',
      isDefault: body.isDefault !== false,
      collectionIds: Array.isArray(body.collectionIds) ? body.collectionIds : [],
      minimumOrderAmount: Number(body.minimumOrderAmount ?? 0),
    });
    const defaults = await this.printStore.addDefaults(request.user.id, sheet._id.toString(), false);
    return { message: 'Default print store created', data: sheet, defaults };
  }

  @Get('price-sheets/:id')
  async priceSheet(@Param('id') id: string, @Req() request: ExpressRequest) {
    return { data: await this.storeService.findPriceSheet(request.user.id, id) };
  }

  @Patch('price-sheets/:id')
  async updatePriceSheet(
    @Param('id') id: string,
    @Body() body: any,
    @Req() request: ExpressRequest,
  ) {
    const data = await this.storeService.updatePriceSheet(request.user.id, id, body);
    return { message: 'Price sheet updated', data };
  }

  @Post('price-sheets/:id/default-products')
  async defaults(
    @Param('id') id: string,
    @Body('replace') replace: boolean,
    @Req() request: ExpressRequest,
  ) {
    const data = await this.printStore.addDefaults(request.user.id, id, Boolean(replace));
    return { message: 'Default products added', data };
  }

  @Post('price-sheets/:id/products')
  async createProduct(
    @Param('id') id: string,
    @Body() body: any,
    @Req() request: ExpressRequest,
  ) {
    const data = await this.storeService.createProduct(request.user.id, id, body);
    return { message: 'Product created', data };
  }

  @Patch('price-sheets/:id/products/:productId')
  async updateProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() body: any,
    @Req() request: ExpressRequest,
  ) {
    const data = await this.storeService.updateProduct(request.user.id, id, productId, body);
    return { message: 'Product updated', data };
  }

  @Delete('price-sheets/:id/products/:productId')
  async deleteProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Req() request: ExpressRequest,
  ) {
    const data = await this.storeService.removeProduct(request.user.id, id, productId);
    return { message: 'Product deleted', data };
  }

  @Post('payments/stripe-intent')
  async ownerIntent(@Body() body: any, @Req() request: ExpressRequest) {
    return { data: await this.printStore.makeOwnerIntent(request.user.id, body) };
  }

  @Post('payments/stripe-verify')
  async ownerVerify(
    @Body('paymentIntentId') paymentIntentId: string,
    @Req() request: ExpressRequest,
  ) {
    return { data: await this.printStore.checkOwnerIntent(request.user.id, paymentIntentId) };
  }
}

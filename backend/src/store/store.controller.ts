import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { CreatePriceSheetDto } from './dto/create-price-sheet.dto';
import { CreateStoreProductDto } from './dto/create-store-product.dto';
import { UpdatePriceSheetDto } from './dto/update-price-sheet.dto';
import { UpdateStoreProductDto } from './dto/update-store-product.dto';
import { StoreCatalogService } from './store-catalog.service';
import { StoreCollectionCatalogService } from './store-collection-catalog.service';
import { StoreCollectionProductService } from './store-collection-product.service';
import { PublicStoreService } from './public-store.service';
import { StoreService } from './store.service';

@Controller('public/store')
export class PublicStoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('checkout-session/:sessionId')
  async publicCheckoutSession(@Param('sessionId') sessionId: string) {
    const data = await this.storeService.publicCheckoutSession(sessionId);
    return { data };
  }

  @Post(':identifier/checkout')
  async publicCheckout(@Param('identifier') identifier: string, @Body() dto: any) {
    const data = await this.storeService.publicCheckout(identifier, dto);
    return { message: 'Checkout created', data };
  }

  @Get(':identifier')
  async publicStore(@Param('identifier') identifier: string) {
    const data = await this.storeService.publicStore(identifier);
    return { data };
  }
}

@Controller('store')
@UseGuards(AuthGuard)
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly catalogService: StoreCatalogService,
    private readonly collectionCatalogService: StoreCollectionCatalogService,
    private readonly collectionProductService: StoreCollectionProductService,
    private readonly printStore: PublicStoreService,
  ) {}

  @Get('dashboard')
  async dashboard(@Req() req: ExpressRequest) {
    const data = await this.storeService.dashboard(req.user.id);
    return { data };
  }

  @Get('settings')
  async getSettings(@Req() req: ExpressRequest) {
    const data = await this.storeService.getSettings(req.user.id);
    return { data };
  }

  @Patch('settings')
  async updateSettings(@Body() dto: any, @Req() req: ExpressRequest) {
    const data = await this.storeService.updateSettings(req.user.id, dto);
    return { message: 'Store settings saved', data };
  }


  @Get('catalog/price-sheets')
  async catalogPriceSheets(
    @Req() req: ExpressRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    const data = await this.storeService.findPriceSheets(req.user.id, collectionId);
    return { data };
  }

  @Post('catalog/price-sheets/default')
  async createDefaultCatalog(@Body() body: any, @Req() req: ExpressRequest) {
    const sheet = await this.storeService.createPriceSheet(req.user.id, {
      name: body.name || 'Default Print Store',
      isDefault: body.isDefault !== false,
      collectionIds: Array.isArray(body.collectionIds) ? body.collectionIds : [],
      minimumOrderAmount: Number(body.minimumOrderAmount ?? 0),
    });
    const defaults = await this.printStore.addDefaults(req.user.id, sheet._id.toString(), false);
    return { message: 'Default print store created', data: sheet, defaults };
  }

  @Get('catalog/price-sheets/:id')
  async catalogPriceSheet(@Param('id') id: string, @Req() req: ExpressRequest) {
    return { data: await this.storeService.findPriceSheet(req.user.id, id) };
  }

  @Patch('catalog/price-sheets/:id')
  async updateCatalogPriceSheet(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.updatePriceSheet(req.user.id, id, body);
    return { message: 'Price sheet updated', data };
  }

  @Post('catalog/price-sheets/:id/default-products')
  async addCatalogDefaults(
    @Param('id') id: string,
    @Body('replace') replace: boolean,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.printStore.addDefaults(req.user.id, id, Boolean(replace));
    return { message: 'Default products added', data };
  }

  @Post('catalog/price-sheets/:id/products')
  async createCatalogProduct(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.createProduct(req.user.id, id, body);
    return { message: 'Product created', data };
  }

  @Patch('catalog/price-sheets/:id/products/:productId')
  async updateCatalogProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() body: any,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.updateProduct(req.user.id, id, productId, body);
    return { message: 'Product updated', data };
  }

  @Delete('catalog/price-sheets/:id/products/:productId')
  async hideCatalogProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.updateProduct(req.user.id, id, productId, { active: false });
    return { message: 'Product hidden', data };
  }

  @Get('catalog/activity/:collectionId')
  async catalogActivity(
    @Param('collectionId') collectionId: string,
    @Req() req: ExpressRequest,
  ) {
    return { data: await this.printStore.getActivity(req.user.id, collectionId) };
  }

  @Post('catalog/payments/stripe-intent')
  async catalogStripeIntent(@Body() body: any, @Req() req: ExpressRequest) {
    return { data: await this.printStore.makeOwnerIntent(req.user.id, body) };
  }

  @Post('catalog/payments/stripe-verify')
  async catalogStripeVerify(
    @Body('paymentIntentId') paymentIntentId: string,
    @Req() req: ExpressRequest,
  ) {
    return { data: await this.printStore.checkOwnerIntent(req.user.id, paymentIntentId) };
  }

  @Get('collection/:collectionId/catalog')
  async getCollectionCatalog(
    @Param('collectionId') collectionId: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionCatalogService.getCatalog(req.user.id, collectionId);
    return { data };
  }

  @Post('collection/:collectionId/catalog/ensure')
  async ensureCollectionCatalog(
    @Param('collectionId') collectionId: string,
    @Body() dto: { minimumOrderAmount?: number },
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionCatalogService.getCatalog(req.user.id, collectionId, {
      minimumOrderAmount: Number(dto?.minimumOrderAmount ?? 0),
    });
    return { message: 'Collection catalog ready', data };
  }

  @Get('collection/:collectionId/activity')
  async collectionActivity(
    @Param('collectionId') collectionId: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.catalogService.listActivity(req.user.id, collectionId);
    return { data };
  }

  @Post('collection/:collectionId/products')
  async createCollectionProduct(
    @Param('collectionId') collectionId: string,
    @Body() dto: any,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionProductService.createProduct(req.user.id, collectionId, dto);
    return { message: 'Product created', data };
  }

  @Patch('collection/:collectionId/products/:productId')
  async updateCollectionProduct(
    @Param('collectionId') collectionId: string,
    @Param('productId') productId: string,
    @Body() dto: any,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionProductService.updateProduct(
      req.user.id,
      collectionId,
      productId,
      dto,
    );
    return { message: 'Product updated', data };
  }

  @Delete('collection/:collectionId/products/:productId')
  async removeCollectionProduct(
    @Param('collectionId') collectionId: string,
    @Param('productId') productId: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionProductService.hideProduct(
      req.user.id,
      collectionId,
      productId,
    );
    return { message: 'Product hidden', data };
  }

  @Post('payments/stripe-intent')
  async createStripePaymentIntent(@Body() dto: any, @Req() req: ExpressRequest) {
    const data = await this.storeService.createStripePaymentIntent(req.user.id, dto);
    return { message: 'Stripe payment intent created', data };
  }

  @Post('payments/stripe-verify')
  async verifyStripePayment(@Body('paymentIntentId') paymentIntentId: string, @Req() req: ExpressRequest) {
    const data = await this.storeService.verifyStripePayment(req.user.id, paymentIntentId);
    return { message: data.success ? 'Payment succeeded' : 'Payment not completed', data };
  }

  @Get('orders')
  async findOrders(@Req() req: ExpressRequest) {
    const data = await this.storeService.findOrders(req.user.id);
    return { data };
  }

  @Post('orders')
  async createOrder(@Body() dto: any, @Req() req: ExpressRequest) {
    const data = await this.storeService.createOrder(req.user.id, dto);
    return { message: 'Order saved', data };
  }

  @Patch('orders/:id')
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.updateOrder(req.user.id, id, dto);
    return { message: 'Order updated', data };
  }

  @Delete('orders/:id')
  async removeOrder(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.storeService.removeOrder(req.user.id, id);
    return { message: 'Order deleted', data };
  }

  @Get('customers')
  async findCustomers(@Req() req: ExpressRequest) {
    const data = await this.storeService.findCustomers(req.user.id);
    return { data };
  }

  @Post('customers')
  async createCustomer(@Body() dto: any, @Req() req: ExpressRequest) {
    const data = await this.storeService.createCustomer(req.user.id, dto);
    return { message: 'Customer saved', data };
  }

  @Patch('customers/:id')
  async updateCustomer(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.updateCustomer(req.user.id, id, dto);
    return { message: 'Customer updated', data };
  }

  @Get('coupons')
  async findCoupons(@Req() req: ExpressRequest) {
    const data = await this.storeService.findCoupons(req.user.id);
    return { data };
  }

  @Post('coupons')
  async saveCoupon(@Body() dto: any, @Req() req: ExpressRequest) {
    const data = await this.storeService.saveCoupon(req.user.id, dto);
    return { message: 'Coupon saved', data };
  }

  @Delete('coupons/:id')
  async deleteCoupon(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.storeService.deleteCoupon(req.user.id, id);
    return { message: 'Coupon deleted', data };
  }

  @Get('taxes')
  async findTaxes(@Req() req: ExpressRequest) {
    const data = await this.storeService.findTaxes(req.user.id);
    return { data };
  }

  @Post('taxes')
  async saveTax(@Body() dto: any, @Req() req: ExpressRequest) {
    const data = await this.storeService.saveTax(req.user.id, dto);
    return { message: 'Tax saved', data };
  }

  @Delete('taxes/:id')
  async deleteTax(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.storeService.deleteTax(req.user.id, id);
    return { message: 'Tax deleted', data };
  }

  @Get('shipping')
  async findShipping(@Req() req: ExpressRequest) {
    const data = await this.storeService.findShipping(req.user.id);
    return { data };
  }

  @Post('shipping')
  async saveShipping(@Body() dto: any, @Req() req: ExpressRequest) {
    const data = await this.storeService.saveShipping(req.user.id, dto);
    return { message: 'Shipping saved', data };
  }

  @Delete('shipping/:id')
  async deleteShipping(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.storeService.deleteShipping(req.user.id, id);
    return { message: 'Shipping deleted', data };
  }

  @Get('price-sheets')
  async findPriceSheets(
    @Req() req: ExpressRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    const data = await this.storeService.findPriceSheets(req.user.id, collectionId);
    return { data };
  }

  @Post('price-sheets')
  async createPriceSheet(@Body() dto: CreatePriceSheetDto, @Req() req: ExpressRequest) {
    const data = await this.storeService.createPriceSheet(req.user.id, dto);
    return { message: 'Price sheet saved', data };
  }

  @Get('price-sheets/:id')
  async findPriceSheet(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.storeService.findPriceSheet(req.user.id, id);
    return { data };
  }

  @Patch('price-sheets/:id')
  async updatePriceSheet(
    @Param('id') id: string,
    @Body() dto: UpdatePriceSheetDto,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.updatePriceSheet(req.user.id, id, dto);
    return { message: 'Price sheet updated', data };
  }

  @Delete('price-sheets/:id')
  async removePriceSheet(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.storeService.removePriceSheet(req.user.id, id);
    return { message: 'Price sheet deleted', data };
  }

  @Post('price-sheets/:id/products')
  async createProduct(
    @Param('id') id: string,
    @Body() dto: CreateStoreProductDto,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.createProduct(req.user.id, id, dto);
    return { message: 'Product saved', data };
  }

  @Patch('price-sheets/:id/products/:productId')
  async updateProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateStoreProductDto,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.updateProduct(req.user.id, id, productId, dto);
    return { message: 'Product updated', data };
  }

  @Delete('price-sheets/:id/products/:productId')
  async removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.storeService.removeProduct(req.user.id, id, productId);
    return { message: 'Product deleted', data };
  }
}

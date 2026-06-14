import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { CreatePriceSheetDto } from './dto/create-price-sheet.dto';
import { CreateStoreProductDto } from './dto/create-store-product.dto';
import { UpdatePriceSheetDto } from './dto/update-price-sheet.dto';
import { UpdateStoreProductDto } from './dto/update-store-product.dto';
import { StoreService } from './store.service';

@Controller('store')
@UseGuards(AuthGuard)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

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

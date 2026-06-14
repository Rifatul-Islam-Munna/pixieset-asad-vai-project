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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatePriceSheetDto } from './dto/create-price-sheet.dto';
import { CreateStoreProductDto } from './dto/create-store-product.dto';
import { UpdatePriceSheetDto } from './dto/update-price-sheet.dto';
import { UpdateStoreProductDto } from './dto/update-store-product.dto';
import { StorePriceSheet, StorePriceSheetDocument } from './entities/store-price-sheet.entity';
import { StoreProduct, StoreProductDocument } from './entities/store-product.entity';

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(StorePriceSheet.name)
    private readonly priceSheetModel: Model<StorePriceSheetDocument>,
    @InjectModel(StoreProduct.name)
    private readonly productModel: Model<StoreProductDocument>,
  ) {}

  async findPriceSheets(userId: string, collectionId?: string) {
    const query = collectionId ? { userId, collectionIds: collectionId } : { userId };
    const sheets = await this.priceSheetModel.find(query).sort({ createdAt: -1 }).lean();
    const ids = sheets.map((sheet) => sheet._id.toString());
    const counts = await this.productModel.aggregate([
      { $match: { userId, priceSheetId: { $in: ids } } },
      { $group: { _id: '$priceSheetId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [item._id, item.count]));

    return sheets.map((sheet) => ({
      ...sheet,
      productCount: countMap.get(sheet._id.toString()) ?? 0,
      collectionCount: sheet.collectionIds?.length ?? 0,
    }));
  }

  async createPriceSheet(userId: string, dto: CreatePriceSheetDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Price sheet name is required');
    if (dto.isDefault) await this.priceSheetModel.updateMany({ userId }, { $set: { isDefault: false } });

    const sheet = await this.priceSheetModel.create({
      userId,
      name: dto.name.trim(),
      isDefault: Boolean(dto.isDefault),
      collectionIds: dto.collectionIds ?? [],
      minimumOrderAmount: dto.minimumOrderAmount ?? 0,
      fulfillment: 'self-fulfilled',
    });

    return sheet.toObject();
  }

  async findPriceSheet(userId: string, id: string) {
    const sheet = await this.priceSheetModel.findOne({ _id: id, userId }).lean();
    if (!sheet) throw new NotFoundException('Price sheet not found');
    const products = await this.productModel
      .find({ userId, priceSheetId: id })
      .sort({ type: 1, category: 1, createdAt: -1 })
      .lean();

    return {
      ...sheet,
      productCount: products.length,
      collectionCount: sheet.collectionIds?.length ?? 0,
      products,
    };
  }

  async updatePriceSheet(userId: string, id: string, dto: UpdatePriceSheetDto) {
    const sheet = await this.priceSheetModel.findOne({ _id: id, userId });
    if (!sheet) throw new NotFoundException('Price sheet not found');
    if (dto.isDefault) await this.priceSheetModel.updateMany({ userId, _id: { $ne: id } }, { $set: { isDefault: false } });
    if (dto.name !== undefined) sheet.name = dto.name.trim();
    if (dto.isDefault !== undefined) sheet.isDefault = dto.isDefault;
    if (dto.collectionIds !== undefined) sheet.collectionIds = dto.collectionIds;
    if (dto.minimumOrderAmount !== undefined) sheet.minimumOrderAmount = dto.minimumOrderAmount;
    await sheet.save();
    return sheet.toObject();
  }

  async removePriceSheet(userId: string, id: string) {
    const sheet = await this.priceSheetModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!sheet) throw new NotFoundException('Price sheet not found');
    await this.productModel.deleteMany({ userId, priceSheetId: id });
    return sheet;
  }

  async createProduct(userId: string, priceSheetId: string, dto: CreateStoreProductDto) {
    await this.assertPriceSheet(userId, priceSheetId);
    if (!dto.name?.trim()) throw new BadRequestException('Product name is required');

    const product = await this.productModel.create({
      userId,
      priceSheetId,
      ...dto,
      name: dto.name.trim(),
      description: dto.description ?? '',
      price: dto.price ?? 0,
      extraShipping: dto.extraShipping ?? 0,
      category: dto.type === 'digital-download' ? 'Digital Downloads' : dto.category ?? 'Prints',
      images: dto.images ?? [],
      downloadType: dto.type === 'digital-download' ? dto.downloadType ?? 'single-photo' : undefined,
      downloadSize: dto.type === 'digital-download' ? dto.downloadSize ?? 'High Resolution Original (Full res)' : undefined,
      options: dto.options ?? [],
      noImageRequired: Boolean(dto.noImageRequired),
      exemptFromSalesTax: Boolean(dto.exemptFromSalesTax),
      limitOnePerCheckout: Boolean(dto.limitOnePerCheckout),
      allowBulkPurchase: Boolean(dto.allowBulkPurchase),
    });

    return product.toObject();
  }

  async updateProduct(userId: string, priceSheetId: string, productId: string, dto: UpdateStoreProductDto) {
    await this.assertPriceSheet(userId, priceSheetId);
    const product = await this.productModel.findOne({ _id: productId, userId, priceSheetId });
    if (!product) throw new NotFoundException('Product not found');
    Object.assign(product, dto);
    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.type === 'digital-download' && !product.downloadSize) {
      product.downloadSize = 'High Resolution Original (Full res)';
    }
    await product.save();
    return product.toObject();
  }

  async removeProduct(userId: string, priceSheetId: string, productId: string) {
    const product = await this.productModel.findOneAndDelete({ _id: productId, userId, priceSheetId }).lean();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async assertPriceSheet(userId: string, priceSheetId: string) {
    const sheet = await this.priceSheetModel.exists({ _id: priceSheetId, userId });
    if (!sheet) throw new NotFoundException('Price sheet not found');
  }
}

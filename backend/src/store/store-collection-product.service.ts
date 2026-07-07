import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StoreProduct, StoreProductDocument } from './entities/store-product.entity';
import { StoreCollectionCatalogService } from './store-collection-catalog.service';

@Injectable()
export class StoreCollectionProductService {
  constructor(
    private readonly catalogService: StoreCollectionCatalogService,
    @InjectModel(StoreProduct.name)
    private readonly productModel: Model<StoreProductDocument>,
  ) {}

  async createProduct(userId: string, collectionId: string, body: any) {
    const catalog = await this.catalogService.getCatalog(userId, collectionId);
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('Product name is required');
    const slug = this.slugify(body.slug || name) || `product-${Date.now()}`;
    const product = await this.productModel.create({
      userId,
      priceSheetId: catalog._id.toString(),
      name,
      slug,
      type: body.type || 'self-fulfilled',
      category: body.category || 'Prints',
      description: body.description || '',
      productInfo: body.productInfo || '',
      productionNote: body.productionNote || '',
      price: Math.max(0, Number(body.price ?? 0)),
      extraShipping: Math.max(0, Number(body.extraShipping ?? 0)),
      active: body.active !== false,
      sortOrder: Number(body.sortOrder ?? 999),
      images: Array.isArray(body.images) ? body.images : [],
      previewImages: Array.isArray(body.previewImages) ? body.previewImages : [],
      variants: Array.isArray(body.variants) ? body.variants : [],
      options: Array.isArray(body.options) ? body.options : [],
      requiresPhoto: body.requiresPhoto !== false,
      allowCrop: body.allowCrop !== false,
      allowBulkPurchase: Boolean(body.allowBulkPurchase),
      noImageRequired: Boolean(body.noImageRequired),
    });
    return product.toObject();
  }

  async updateProduct(userId: string, collectionId: string, productId: string, body: any) {
    const catalog = await this.catalogService.getCatalog(userId, collectionId);
    const product = await this.productModel.findOne({
      _id: productId,
      userId,
      priceSheetId: catalog._id.toString(),
    });
    if (!product) throw new NotFoundException('Product not found');
    if (body.name !== undefined) product.name = String(body.name).trim();
    if (body.description !== undefined) product.description = String(body.description);
    if (body.productInfo !== undefined) product.productInfo = String(body.productInfo);
    if (body.productionNote !== undefined) product.productionNote = String(body.productionNote);
    if (body.price !== undefined) product.price = Math.max(0, Number(body.price || 0));
    if (body.extraShipping !== undefined) product.extraShipping = Math.max(0, Number(body.extraShipping || 0));
    if (body.category !== undefined) product.category = String(body.category);
    if (body.active !== undefined) product.active = Boolean(body.active);
    if (body.sortOrder !== undefined) product.sortOrder = Number(body.sortOrder || 0);
    if (Array.isArray(body.images)) product.images = body.images;
    if (Array.isArray(body.previewImages)) product.previewImages = body.previewImages;
    if (Array.isArray(body.variants)) product.variants = body.variants;
    if (Array.isArray(body.options)) product.options = body.options;
    if (body.requiresPhoto !== undefined) product.requiresPhoto = Boolean(body.requiresPhoto);
    if (body.allowCrop !== undefined) product.allowCrop = Boolean(body.allowCrop);
    if (body.allowBulkPurchase !== undefined) product.allowBulkPurchase = Boolean(body.allowBulkPurchase);
    if (body.noImageRequired !== undefined) product.noImageRequired = Boolean(body.noImageRequired);
    if (!product.name) throw new BadRequestException('Product name is required');
    await product.save();
    return product.toObject();
  }

  async hideProduct(userId: string, collectionId: string, productId: string) {
    return this.updateProduct(userId, collectionId, productId, { active: false });
  }

  private slugify(value: string) {
    return String(value ?? '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

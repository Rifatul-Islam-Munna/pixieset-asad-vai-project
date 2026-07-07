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
    const priceSheetId = String(catalog._id);
    if (!body?.name?.trim()) throw new BadRequestException('Product name is required');
    const type = body.type === 'digital-download' ? 'digital-download' : 'self-fulfilled';
    const category = type === 'digital-download' ? 'Digital Downloads' : body.category || 'Prints';
    const baseSlug = this.slugify(body.slug || body.name) || `product-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 2;
    while (await this.productModel.exists({ userId, priceSheetId, slug })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const product = await this.productModel.create({
      userId,
      priceSheetId,
      type,
      slug,
      active: body.active !== false,
      sortOrder: Number(body.sortOrder ?? 999),
      name: body.name.trim(),
      description: body.description ?? '',
      productInfo: body.productInfo ?? '',
      productionNote: body.productionNote ?? '',
      price: Math.max(0, Number(body.price ?? 0)),
      extraShipping: Math.max(0, Number(body.extraShipping ?? 0)),
      category,
      images: Array.isArray(body.images) ? body.images : [],
      previewImages: Array.isArray(body.previewImages)
        ? body.previewImages
        : Array.isArray(body.images) ? body.images : [],
      requiresPhoto: body.requiresPhoto !== false,
      allowCrop: body.allowCrop !== false,
      allowBulkPurchase: Boolean(body.allowBulkPurchase),
      noImageRequired: Boolean(body.noImageRequired),
      exemptFromSalesTax: Boolean(body.exemptFromSalesTax),
      limitOnePerCheckout: Boolean(body.limitOnePerCheckout),
      downloadType: type === 'digital-download' ? body.downloadType ?? 'single-photo' : undefined,
      downloadSize: type === 'digital-download'
        ? body.downloadSize ?? 'High Resolution Original (Full res)'
        : undefined,
      options: Array.isArray(body.options) ? body.options : [],
      variants: Array.isArray(body.variants) ? body.variants : [],
    });
    return product.toObject();
  }

  async updateProduct(userId: string, collectionId: string, productId: string, body: any) {
    const catalog = await this.catalogService.getCatalog(userId, collectionId);
    const priceSheetId = String(catalog._id);
    const product = await this.productModel.findOne({
      _id: productId,
      userId,
      priceSheetId,
    });
    if (!product) throw new NotFoundException('Product not found');

    const allowed = [
      'type', 'active', 'sortOrder', 'description', 'productInfo', 'productionNote',
      'category', 'images', 'previewImages', 'requiresPhoto', 'allowCrop',
      'allowBulkPurchase', 'noImageRequired', 'exemptFromSalesTax',
      'limitOnePerCheckout', 'downloadType', 'downloadSize', 'options', 'variants',
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) (product as any)[key] = body[key];
    }
    if (body.name !== undefined) product.name = String(body.name).trim();
    if (body.slug !== undefined) product.slug = this.slugify(body.slug || product.name);
    if (body.price !== undefined) product.price = Math.max(0, Number(body.price || 0));
    if (body.extraShipping !== undefined) {
      product.extraShipping = Math.max(0, Number(body.extraShipping || 0));
    }
    if (!product.name) throw new BadRequestException('Product name is required');
    await product.save();
    return product.toObject();
  }

  async hideProduct(userId: string, collectionId: string, productId: string) {
    const catalog = await this.catalogService.getCatalog(userId, collectionId);
    const priceSheetId = String(catalog._id);
    const product = await this.productModel.findOne({
      _id: productId,
      userId,
      priceSheetId,
    });
    if (!product) throw new NotFoundException('Product not found');
    product.active = false;
    await product.save();
    return product.toObject();
  }

  private slugify(value: string) {
    return String(value ?? '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

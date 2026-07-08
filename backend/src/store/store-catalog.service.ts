import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { StoreActivity, StoreActivityDocument, StoreActivityType } from './entities/store-activity.entity';
import { StoreCoupon, StoreCouponDocument } from './entities/store-coupon.entity';
import { StorePriceSheet, StorePriceSheetDocument } from './entities/store-price-sheet.entity';
import { StoreProduct, StoreProductDocument } from './entities/store-product.entity';
import { StoreSetting, StoreSettingDocument } from './entities/store-setting.entity';
import { StoreShipping, StoreShippingDocument } from './entities/store-shipping.entity';
import { StoreTax, StoreTaxDocument } from './entities/store-tax.entity';
import { StoreDefaultProductService } from './store-default-product.service';

export type CollectionStoreConfig = {
  enabled: boolean;
  priceSheetId?: string;
  showPrintStoreNav: boolean;
  showBuyPhotoButton: boolean;
  allowBulkBuy: boolean;
  minimumOrderAmount: number;
  currency: string;
  requireProfessionalInfo: boolean;
};

export type ResolvedCollectionStore = {
  collection: any;
  userId: string;
  settings: any;
  config: CollectionStoreConfig;
  sheet: any | null;
};

@Injectable()
export class StoreCatalogService {
  constructor(
    @InjectModel(Collection.name)
    private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(StorePriceSheet.name)
    private readonly priceSheetModel: Model<StorePriceSheetDocument>,
    @InjectModel(StoreProduct.name)
    private readonly productModel: Model<StoreProductDocument>,
    @InjectModel(StoreCoupon.name)
    private readonly couponModel: Model<StoreCouponDocument>,
    @InjectModel(StoreTax.name)
    private readonly taxModel: Model<StoreTaxDocument>,
    @InjectModel(StoreShipping.name)
    private readonly shippingModel: Model<StoreShippingDocument>,
    @InjectModel(StoreSetting.name)
    private readonly settingModel: Model<StoreSettingDocument>,
    @InjectModel(StoreActivity.name)
    private readonly activityModel: Model<StoreActivityDocument>,
    private readonly defaultProducts: StoreDefaultProductService,
  ) {}

  async getPublicStore(identifier: string, logView = true) {
    const resolved = await this.resolve(identifier, false);
    const products = resolved.config.enabled && resolved.sheet
      ? await this.productModel
          .find({
            userId: resolved.userId,
            priceSheetId: resolved.sheet._id.toString(),
            active: { $ne: false },
          })
          .sort({ category: 1, sortOrder: 1, createdAt: 1 })
          .lean()
      : [];
    const [shipping, taxes, coupons, owner] = await Promise.all([
      this.shippingModel.find({ userId: resolved.userId, active: true }).sort({ createdAt: -1 }).lean(),
      this.taxModel.find({ userId: resolved.userId, active: true }).sort({ createdAt: -1 }).lean(),
      this.couponModel
        .find({
          userId: resolved.userId,
          active: true,
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }],
        })
        .select('code name discountType amount')
        .sort({ createdAt: -1 })
        .lean(),
      this.userModel.findById(resolved.userId).select('name email').lean(),
    ]);
    const stripe = this.ownerStripe(resolved.settings);
    if (logView && resolved.config.enabled) {
      void this.log(resolved, 'store_view', { source: 'public-store' });
    }
    return {
      collection: {
        _id: resolved.collection._id,
        name: resolved.collection.name,
        slug: resolved.collection.slug,
        coverImage: resolved.collection.coverImage,
        sets: resolved.collection.sets ?? [],
        studioName: owner?.name || owner?.email || '',
      },
      store: {
        ...resolved.config,
        priceSheetId: resolved.sheet?._id?.toString(),
        globalStatus: resolved.settings?.globalStatus ?? false,
        canCheckout: Boolean(stripe.enabled && stripe.publishableKey && stripe.secretKey),
        checkoutMessage: this.stripeMessage(stripe),
        paymentMethods: {
          stripe: { enabled: stripe.enabled, publishableKey: stripe.publishableKey },
        },
      },
      priceSheet: resolved.sheet,
      priceSheets: resolved.sheet ? [resolved.sheet] : [],
      products: products.map((product: any) => this.publicProduct(product)),
      shipping,
      taxes,
      coupons,
    };
  }

  async getPublicProduct(identifier: string, slug: string) {
    const resolved = await this.resolve(identifier);
    if (!resolved.sheet) throw new NotFoundException('The automatic store catalog is unavailable');
    const product = await this.productModel.findOne({
      userId: resolved.userId,
      priceSheetId: resolved.sheet._id.toString(),
      slug,
      active: { $ne: false },
    }).lean();
    if (!product) throw new NotFoundException('Product not found');
    void this.log(resolved, 'product_view', {
      productId: product._id.toString(),
      productName: product.name,
      source: 'public-store',
    });
    const related = await this.productModel.find({
      userId: resolved.userId,
      priceSheetId: resolved.sheet._id.toString(),
      category: product.category,
      active: { $ne: false },
      _id: { $ne: product._id },
    }).sort({ sortOrder: 1 }).limit(4).lean();
    return {
      product: this.publicProduct(product),
      related: related.map((item: any) => this.publicProduct(item)),
      collection: {
        _id: resolved.collection._id,
        name: resolved.collection.name,
        slug: resolved.collection.slug,
      },
      store: { enabled: true, currency: resolved.config.currency },
    };
  }

  async resolve(identifier: string, requireEnabled = true): Promise<ResolvedCollectionStore> {
    const query: Record<string, unknown>[] = [{ slug: identifier }, { name: identifier }];
    if (Types.ObjectId.isValid(identifier)) query.unshift({ _id: identifier });
    const collection = await this.collectionModel.findOne({ $or: query }).lean();
    if (!collection) throw new NotFoundException('Collection not found');
    const userId = String(collection.userId);
    const settings = await this.settingModel.findOne({ userId }).lean();
    const raw = ((collection.settings as any)?.store ?? {}) as Record<string, any>;
    const enabled = Boolean(raw.enabled ?? raw.storeStatus);
    let sheet: any | null = null;

    if (raw.priceSheetId && Types.ObjectId.isValid(raw.priceSheetId)) {
      sheet = await this.priceSheetModel.findOne({ _id: raw.priceSheetId, userId }).lean();
    }
    if (!sheet) {
      sheet = await this.priceSheetModel
        .findOne({ userId, collectionIds: collection._id.toString() })
        .sort({ isDefault: -1, createdAt: -1 })
        .lean();
    }
    if (!sheet) {
      sheet = await this.priceSheetModel
        .findOne({ userId })
        .sort({ isDefault: -1, createdAt: 1 })
        .lean();
    }
    if (enabled && !sheet) {
      sheet = await this.priceSheetModel.create({
        userId,
        name: 'Default Print Store',
        isDefault: true,
        collectionIds: [collection._id.toString()],
        minimumOrderAmount: Number(raw.minimumOrderAmount ?? 0),
      });
      const defaults = await this.defaultProducts.listActiveData();
      await this.productModel.insertMany(
        defaults.map((item: any) => ({
          userId,
          priceSheetId: sheet._id.toString(),
          defaultTemplateSlug: item.slug,
          ...item,
        })),
      );
      await this.collectionModel.updateOne(
        { _id: collection._id, userId },
        {
          $set: {
            'settings.store.priceSheetId': sheet._id.toString(),
            'settings.store.showPrintStoreNav': true,
            'settings.store.showBuyPhotoButton': true,
            'settings.store.allowBulkBuy': true,
          },
        },
      );
    } else if (sheet && enabled) {
      await Promise.all([
        this.priceSheetModel.updateOne(
          { _id: sheet._id, userId },
          { $addToSet: { collectionIds: collection._id.toString() } },
        ),
        this.ensureDefaultProducts(userId, sheet._id.toString()),
      ]);
    }

    const config: CollectionStoreConfig = {
      enabled,
      priceSheetId: sheet?._id?.toString() || raw.priceSheetId,
      showPrintStoreNav: raw.showPrintStoreNav ?? true,
      showBuyPhotoButton: raw.showBuyPhotoButton ?? true,
      allowBulkBuy: raw.allowBulkBuy ?? true,
      minimumOrderAmount: Number(raw.minimumOrderAmount ?? 0),
      currency: String(raw.currency || settings?.currency || 'EUR').toUpperCase(),
      requireProfessionalInfo: Boolean(raw.requireProfessionalInfo),
    };
    if (requireEnabled && !config.enabled) throw new NotFoundException('Store is not enabled for this collection');
    return { collection, userId, settings, config, sheet };
  }

  async seedDefaults(userId: string, priceSheetId: string, replace = false) {
    const sheet = await this.priceSheetModel.findOne({ _id: priceSheetId, userId }).lean();
    if (!sheet) throw new NotFoundException('Price sheet not found');
    if (replace) await this.productModel.deleteMany({ userId, priceSheetId });
    const created = await this.ensureDefaultProducts(userId, priceSheetId);
    return {
      created,
      total: await this.productModel.countDocuments({ userId, priceSheetId }),
    };
  }

  async listActivity(userId: string, collectionId: string) {
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');
    return this.activityModel.find({ userId, collectionId }).sort({ createdAt: -1 }).limit(500).lean();
  }

  async recordPublicActivity(identifier: string, body: any) {
    const resolved = await this.resolve(identifier);
    const allowed: StoreActivityType[] = ['store_view', 'product_view', 'add_to_cart', 'checkout_started'];
    const type = allowed.includes(body.type) ? body.type : 'store_view';
    const activity = await this.log(
      resolved,
      type,
      {
        productId: body.metadata?.productId,
        productName: body.metadata?.productName,
        imageId: body.metadata?.imageId,
        source: body.metadata?.source,
        amount: Number(body.metadata?.amount ?? 0) || undefined,
        currency: body.metadata?.currency,
      },
      body.email,
      body.sessionId,
    );
    return { saved: Boolean(activity?._id), id: activity?._id?.toString() };
  }

  async log(
    resolved: ResolvedCollectionStore,
    type: StoreActivityType,
    metadata: Record<string, unknown>,
    email = '',
    sessionId = '',
  ) {
    try {
      return await this.activityModel.create({
        userId: resolved.userId,
        collectionId: resolved.collection._id.toString(),
        type,
        metadata,
        email: String(email ?? '').trim().toLowerCase(),
        sessionId: String(sessionId ?? ''),
      });
    } catch {
      return null;
    }
  }

  ownerStripe(settings: any) {
    const stripe = settings?.paymentMethods?.stripe ?? {};
    return {
      enabled: Boolean(stripe.enabled),
      publishableKey: String(stripe.publishableKey ?? '').trim(),
      secretKey: String(stripe.secretKey ?? '').trim(),
    };
  }

  stripeMessage(stripe: { enabled: boolean; publishableKey?: string; secretKey?: string }) {
    if (!stripe.enabled) return 'The collection owner has not enabled Stripe.';
    if (!stripe.publishableKey) return 'The collection owner Stripe publishable key is missing.';
    if (!stripe.secretKey) return 'The collection owner Stripe secret key is missing.';
    return 'No payment method is active at this moment.';
  }

  publicProduct(product: any) {
    const previewImages = product.previewImages?.length ? product.previewImages : product.images ?? [];
    return {
      ...product,
      images: previewImages,
      previewImages,
      variants: (product.variants ?? [])
        .filter((variant: any) => !variant.hidden)
        .sort((a: any, b: any) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
    };
  }

  private async ensureDefaultProducts(userId: string, priceSheetId: string) {
    const existing = await this.productModel.find({ userId, priceSheetId }).select('slug').lean();
    const slugs = new Set(existing.map((item: any) => item.slug));
    const defaults = await this.defaultProducts.listActiveData();
    const missing = defaults.filter((item: any) => !slugs.has(item.slug));
    if (missing.length) {
      await this.productModel.insertMany(
        missing.map((item: any) => ({ userId, priceSheetId, defaultTemplateSlug: item.slug, ...item })),
      );
    }
    return missing.length;
  }
}

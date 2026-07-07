import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { DEFAULT_STORE_PRODUCTS } from './store-defaults';
import { StorePriceSheet, StorePriceSheetDocument } from './entities/store-price-sheet.entity';
import { StoreProduct, StoreProductDocument } from './entities/store-product.entity';

@Injectable()
export class StoreCollectionCatalogService {
  constructor(
    @InjectModel(Collection.name)
    private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(StorePriceSheet.name)
    private readonly priceSheetModel: Model<StorePriceSheetDocument>,
    @InjectModel(StoreProduct.name)
    private readonly productModel: Model<StoreProductDocument>,
  ) {}

  async getCatalog(
    userId: string,
    collectionId: string,
    options: { minimumOrderAmount?: number } = {},
  ) {
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const raw = ((collection.settings as any)?.store ?? {}) as Record<string, any>;
    let sheet: any | null = null;
    if (raw.priceSheetId && Types.ObjectId.isValid(raw.priceSheetId)) {
      sheet = await this.priceSheetModel.findOne({ _id: raw.priceSheetId, userId }).lean();
    }
    if (!sheet) {
      sheet = await this.priceSheetModel
        .findOne({ userId, collectionIds: collectionId })
        .sort({ createdAt: -1 })
        .lean();
    }
    if (!sheet) {
      sheet = await this.priceSheetModel.create({
        userId,
        name: `${collection.name || 'Collection'} Print Store`,
        isDefault: false,
        collectionIds: [collectionId],
        minimumOrderAmount: Number(options.minimumOrderAmount ?? raw.minimumOrderAmount ?? 0),
        fulfillment: 'self-fulfilled',
      });
    }

    const priceSheetId = sheet._id.toString();
    await this.productModel.bulkWrite(
      DEFAULT_STORE_PRODUCTS.map((item) => ({
        updateOne: {
          filter: { userId, priceSheetId, slug: item.slug },
          update: { $setOnInsert: { userId, priceSheetId, ...item } },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    const update: Record<string, any> = { $addToSet: { collectionIds: collectionId } };
    if (options.minimumOrderAmount !== undefined) {
      update.$set = { minimumOrderAmount: Number(options.minimumOrderAmount || 0) };
    }
    await this.priceSheetModel.updateOne({ _id: priceSheetId, userId }, update);
    await this.collectionModel.updateOne(
      { _id: collectionId, userId },
      {
        $set: {
          'settings.store.priceSheetId': priceSheetId,
          'settings.store.showPrintStoreNav': true,
          'settings.store.showBuyPhotoButton': true,
          'settings.store.allowBulkBuy': true,
        },
      },
    );

    const [freshSheet, products] = await Promise.all([
      this.priceSheetModel.findOne({ _id: priceSheetId, userId }).lean(),
      this.productModel
        .find({ userId, priceSheetId })
        .sort({ category: 1, sortOrder: 1, createdAt: 1 })
        .lean(),
    ]);
    return {
      ...freshSheet,
      productCount: products.length,
      collectionCount: freshSheet?.collectionIds?.length ?? 0,
      products,
    };
  }
}

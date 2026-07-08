import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DEFAULT_STORE_PRODUCTS } from './store-defaults';
import {
  StoreDefaultProduct,
  StoreDefaultProductDocument,
} from './entities/store-default-product.entity';

@Injectable()
export class StoreDefaultProductService {
  constructor(
    @InjectModel(StoreDefaultProduct.name)
    private readonly model: Model<StoreDefaultProductDocument>,
  ) {}

  async ensureSeeded() {
    if (!DEFAULT_STORE_PRODUCTS.length) return;
    await this.model.bulkWrite(
      DEFAULT_STORE_PRODUCTS.map((item) => ({
        updateOne: {
          filter: { slug: item.slug },
          update: {
            $setOnInsert: {
              slug: item.slug,
              name: item.name,
              category: item.category,
              active: item.active !== false,
              sortOrder: item.sortOrder ?? 0,
              data: item,
            },
          },
          upsert: true,
        },
      })),
    );
  }

  async list() {
    await this.ensureSeeded();
    const rows = await this.model
      .find()
      .sort({ category: 1, sortOrder: 1, createdAt: 1 })
      .lean();
    return rows.map((row) => this.publicRow(row));
  }

  async listActiveData() {
    const rows = await this.list();
    return rows
      .filter((row) => row.active !== false)
      .map(({ _id, createdAt, updatedAt, ...row }) => row);
  }

  async create(dto: Record<string, unknown>) {
    const incoming = { ...dto } as Record<string, any>;
    const name = String(incoming.name ?? 'New Product').trim() || 'New Product';
    const category = String(incoming.category ?? 'Prints').trim() || 'Prints';
    const slug = await this.uniqueSlug(String(incoming.slug ?? name));
    const sortOrder = incoming.sortOrder === undefined
      ? await this.nextSortOrder(category)
      : Number(incoming.sortOrder) || 0;

    const data = {
      type: incoming.type === 'digital-download' ? 'digital-download' : 'self-fulfilled',
      slug,
      active: incoming.active === undefined ? true : Boolean(incoming.active),
      sortOrder,
      name,
      category,
      description: String(incoming.description ?? ''),
      productInfo: String(incoming.productInfo ?? ''),
      productionNote: String(incoming.productionNote ?? ''),
      price: Number(incoming.price) || 0,
      extraShipping: Number(incoming.extraShipping) || 0,
      images: Array.isArray(incoming.images) ? incoming.images : [],
      previewImages: Array.isArray(incoming.previewImages) ? incoming.previewImages : [],
      requiresPhoto: incoming.requiresPhoto === undefined ? true : Boolean(incoming.requiresPhoto),
      allowCrop: incoming.allowCrop === undefined ? true : Boolean(incoming.allowCrop),
      allowBulkPurchase: incoming.allowBulkPurchase === undefined ? true : Boolean(incoming.allowBulkPurchase),
      noImageRequired: Boolean(incoming.noImageRequired),
      exemptFromSalesTax: Boolean(incoming.exemptFromSalesTax),
      limitOnePerCheckout: Boolean(incoming.limitOnePerCheckout),
      options: Array.isArray(incoming.options) ? incoming.options : [],
      variants: Array.isArray(incoming.variants) ? incoming.variants : [],
    };

    const product = await this.model.create({
      slug,
      name,
      category,
      active: data.active,
      sortOrder,
      data,
    });
    return this.publicRow(product.toObject());
  }

  async update(id: string, dto: Record<string, unknown>) {
    const product = await this.model.findById(id);
    if (!product) throw new NotFoundException('Default product template not found');
    const incoming = { ...dto } as Record<string, any>;
    delete incoming._id;
    delete incoming.createdAt;
    delete incoming.updatedAt;
    delete incoming.slug;
    delete incoming.type;

    const next = {
      ...(product.data ?? {}),
      ...incoming,
      slug: product.slug,
      type: (product.data as any)?.type ?? 'self-fulfilled',
    };
    product.name = String(incoming.name ?? product.name).trim() || product.name;
    product.category = String(incoming.category ?? product.category).trim() || product.category;
    product.active = incoming.active === undefined ? product.active : Boolean(incoming.active);
    product.sortOrder = incoming.sortOrder === undefined ? product.sortOrder : Number(incoming.sortOrder) || 0;
    product.data = {
      ...next,
      name: product.name,
      category: product.category,
      active: product.active,
      sortOrder: product.sortOrder,
    };
    product.markModified('data');
    await product.save();
    return this.publicRow(product.toObject());
  }

  async remove(id: string) {
    const product = await this.model.findByIdAndDelete(id).lean();
    if (!product) throw new NotFoundException('Default product template not found');
    return this.publicRow(product);
  }

  private async uniqueSlug(value: string) {
    const base = this.slugify(value) || 'product';
    let slug = base;
    let counter = 2;
    while (await this.model.exists({ slug })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private async nextSortOrder(category: string) {
    const latest = await this.model
      .findOne({ category })
      .sort({ sortOrder: -1 })
      .select('sortOrder')
      .lean();
    return Number(latest?.sortOrder ?? 0) + 10;
  }

  private publicRow(row: any) {
    const data = { ...(row.data ?? {}) };
    return {
      _id: row._id.toString(),
      ...data,
      slug: row.slug,
      name: row.name,
      category: row.category,
      active: row.active,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

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
    const rows = await this.model.find().sort({ category: 1, sortOrder: 1, createdAt: 1 }).lean();
    return rows.map((row) => this.publicRow(row));
  }

  async listActiveData() {
    const rows = await this.list();
    return rows
      .filter((row) => row.active !== false)
      .map(({ _id, createdAt, updatedAt, ...row }) => row);
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

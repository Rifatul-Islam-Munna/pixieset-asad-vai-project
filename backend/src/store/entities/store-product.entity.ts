import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreProductDocument = HydratedDocument<StoreProduct>;
export type StoreProductType = 'digital-download' | 'self-fulfilled';

@Schema({ timestamps: true, autoIndex: true })
export class StoreProduct {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  priceSheetId: string;

  @Prop({ required: true, enum: ['digital-download', 'self-fulfilled'], index: true })
  type: StoreProductType;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, index: true, default: '' })
  slug: string;

  @Prop({ default: true, index: true })
  active: boolean;

  @Prop({ index: true })
  defaultTemplateSlug?: string;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  productInfo: string;

  @Prop({ default: '' })
  productionNote: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: 0, min: 0 })
  extraShipping: number;

  @Prop({ default: 'Prints', index: true })
  category: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [String], default: [] })
  previewImages: string[];

  @Prop({ default: true })
  requiresPhoto: boolean;

  @Prop({ default: true })
  allowCrop: boolean;

  @Prop()
  downloadType?: 'single-photo' | 'all-photos';

  @Prop()
  downloadSize?: string;

  @Prop({ type: [{ name: String, values: [String] }], default: [] })
  options: { name: string; values: string[] }[];

  @Prop({
    type: [{
      id: String,
      label: String,
      options: Object,
      price: Number,
      extraShipping: Number,
      hidden: Boolean,
      sortOrder: Number,
      isDefault: Boolean,
    }],
    default: [],
  })
  variants: {
    id: string;
    label: string;
    options: Record<string, string>;
    price: number;
    extraShipping?: number;
    hidden?: boolean;
    sortOrder?: number;
    isDefault?: boolean;
  }[];

  @Prop({ default: false })
  noImageRequired: boolean;

  @Prop({ default: false })
  exemptFromSalesTax: boolean;

  @Prop({ default: false })
  limitOnePerCheckout: boolean;

  @Prop({ default: false })
  allowBulkPurchase: boolean;
}

export const StoreProductSchema = SchemaFactory.createForClass(StoreProduct);

StoreProductSchema.pre('validate', function setStoreProductSlug(this: StoreProductDocument) {
  if (!this.slug && this.name) {
    this.slug = String(this.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  if (!this.previewImages?.length && this.images?.length) {
    this.previewImages = [...this.images];
  }
});
StoreProductSchema.index({ userId: 1, priceSheetId: 1, sortOrder: 1, createdAt: -1 });
StoreProductSchema.index({ userId: 1, priceSheetId: 1, slug: 1 }, { unique: true });

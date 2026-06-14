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

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: 0, min: 0 })
  extraShipping: number;

  @Prop({ default: 'Prints' })
  category: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop()
  downloadType?: 'single-photo' | 'all-photos';

  @Prop()
  downloadSize?: string;

  @Prop({ type: [{ name: String, values: [String] }], default: [] })
  options: { name: string; values: string[] }[];

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

StoreProductSchema.index({ userId: 1, priceSheetId: 1, createdAt: -1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StorePriceSheetDocument = HydratedDocument<StorePriceSheet>;

@Schema({ timestamps: true, autoIndex: true })
export class StorePriceSheet {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ type: [String], default: [] })
  collectionIds: string[];

  @Prop({ default: 0 })
  minimumOrderAmount: number;

  @Prop({ default: 'self-fulfilled' })
  fulfillment: 'self-fulfilled';
}

export const StorePriceSheetSchema =
  SchemaFactory.createForClass(StorePriceSheet);

StorePriceSheetSchema.index({ userId: 1, createdAt: -1 });

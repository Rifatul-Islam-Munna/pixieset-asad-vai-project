import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreShippingDocument = HydratedDocument<StoreShipping>;

@Schema({ timestamps: true, autoIndex: true })
export class StoreShipping {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  region: string;

  @Prop({ default: false })
  shipInternational: boolean;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: 0 })
  freeOver: number;

  @Prop({ default: true })
  active: boolean;
}

export const StoreShippingSchema = SchemaFactory.createForClass(StoreShipping);

StoreShippingSchema.index({ userId: 1, createdAt: -1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreCouponDocument = HydratedDocument<StoreCoupon>;

@Schema({ timestamps: true, autoIndex: true })
export class StoreCoupon {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: 'percent' })
  discountType: 'percent' | 'fixed';

  @Prop({ default: 0 })
  amount: number;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop()
  expiresAt?: Date;
}

export const StoreCouponSchema = SchemaFactory.createForClass(StoreCoupon);

StoreCouponSchema.index({ userId: 1, code: 1 }, { unique: true });

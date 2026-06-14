import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreTaxDocument = HydratedDocument<StoreTax>;

@Schema({ timestamps: true, autoIndex: true })
export class StoreTax {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  region: string;

  @Prop({ default: 0 })
  rate: number;

  @Prop({ default: true })
  applyShipping: boolean;

  @Prop({ default: true })
  applyDigitalDownloads: boolean;

  @Prop({ default: true })
  active: boolean;
}

export const StoreTaxSchema = SchemaFactory.createForClass(StoreTax);

StoreTaxSchema.index({ userId: 1, createdAt: -1 });

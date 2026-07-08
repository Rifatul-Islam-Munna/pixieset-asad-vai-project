import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreDefaultProductDocument = HydratedDocument<StoreDefaultProduct>;

@Schema({ timestamps: true, autoIndex: true })
export class StoreDefaultProduct {
  @Prop({ required: true, unique: true, index: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ default: true, index: true })
  active: boolean;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ type: Object, required: true, default: {} })
  data: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StoreDefaultProductSchema = SchemaFactory.createForClass(StoreDefaultProduct);

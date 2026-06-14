import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreCustomerDocument = HydratedDocument<StoreCustomer>;

@Schema({ timestamps: true, autoIndex: true })
export class StoreCustomer {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ type: Object, default: {} })
  address: Record<string, unknown>;

  @Prop({ default: 0 })
  orderCount: number;

  @Prop({ default: 0 })
  totalSpent: number;

  @Prop()
  lastOrderAt?: Date;
}

export const StoreCustomerSchema = SchemaFactory.createForClass(StoreCustomer);

StoreCustomerSchema.index({ userId: 1, email: 1 }, { unique: true });
StoreCustomerSchema.index({ userId: 1, totalSpent: -1 });

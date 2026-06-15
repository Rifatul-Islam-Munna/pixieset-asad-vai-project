import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreOrderDocument = HydratedDocument<StoreOrder>;
export type StoreOrderStatus =
  | 'pending'
  | 'processing'
  | 'fulfilled'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

@Schema({ _id: false })
export class StoreOrderItem {
  @Prop()
  productId?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: 1 })
  quantity: number;

  @Prop({ default: 0 })
  unitPrice: number;

  @Prop({ default: 0 })
  total: number;
}

const StoreOrderItemSchema = SchemaFactory.createForClass(StoreOrderItem);

@Schema({ timestamps: true, autoIndex: true })
export class StoreOrder {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  orderNumber: string;

  @Prop({ index: true })
  customerId?: string;

  @Prop({ type: Object, required: true })
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: Record<string, unknown>;
  };

  @Prop({ type: [StoreOrderItemSchema], default: [] })
  items: {
    productId?: string;
    name: string;
    type: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];

  @Prop({ default: 0 })
  subtotal: number;

  @Prop({ default: 0 })
  tax: number;

  @Prop({ default: 0 })
  shipping: number;

  @Prop()
  shippingMethodId?: string;

  @Prop({ default: '' })
  shippingMethodName: string;

  @Prop({ default: '' })
  shippingNote: string;

  @Prop({ default: 0 })
  discount: number;

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 'pending', index: true })
  status: StoreOrderStatus;

  @Prop({ default: 'unpaid', index: true })
  paymentStatus: 'unpaid' | 'paid' | 'refunded';

  @Prop({ default: '' })
  trackingNumber: string;

  @Prop({ default: '' })
  trackingUrl: string;

  @Prop({ default: '' })
  note: string;
}

export const StoreOrderSchema = SchemaFactory.createForClass(StoreOrder);

StoreOrderSchema.index({ userId: 1, createdAt: -1 });
StoreOrderSchema.index({ userId: 1, customerId: 1 });

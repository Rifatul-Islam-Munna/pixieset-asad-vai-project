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

export type StoreCropData = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  rotation: number;
  aspectRatio: string;
  fit?: 'contain' | 'cover';
};

@Schema({ _id: false })
export class StoreOrderItem {
  @Prop()
  productId?: string;

  @Prop()
  collectionId?: string;

  @Prop()
  imageId?: string;

  @Prop()
  imageUrl?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  type: string;

  @Prop()
  variantId?: string;

  @Prop({ default: '' })
  variantLabel?: string;

  @Prop({ type: Object })
  options?: Record<string, string>;

  @Prop({ type: Object })
  crop?: StoreCropData;

  @Prop({ default: 1 })
  quantity: number;

  @Prop({ default: 0 })
  unitPrice: number;

  @Prop({ default: 0 })
  extraShipping: number;

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 'pending' })
  fulfillmentStatus?: 'pending' | 'in-production' | 'ready' | 'shipped' | 'delivered';
}

const StoreOrderItemSchema = SchemaFactory.createForClass(StoreOrderItem);

@Schema({ timestamps: true, autoIndex: true })
export class StoreOrder {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ index: true })
  collectionId?: string;

  @Prop({ index: true })
  priceSheetId?: string;

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

  @Prop({ type: Object })
  professionalInfo?: {
    company?: string;
    taxId?: string;
    invoiceNote?: string;
  };

  @Prop({ type: [StoreOrderItemSchema], default: [] })
  items: StoreOrderItem[];

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

  @Prop({ index: true })
  stripePaymentIntentId?: string;

  @Prop({ index: true })
  stripeCheckoutSessionId?: string;

  @Prop({ default: 'owner' })
  stripeAccountMode: 'owner';

  @Prop({ default: 'public-store' })
  checkoutSource: 'public-gallery' | 'public-store' | 'buy-photo';

  @Prop({ type: [String], default: [] })
  activityLogIds?: string[];

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
StoreOrderSchema.index({ collectionId: 1, createdAt: -1 });

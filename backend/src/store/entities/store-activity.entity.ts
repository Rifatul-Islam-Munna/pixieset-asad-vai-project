import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const STORE_ACTIVITY_TYPES = [
  'store_view',
  'product_view',
  'add_to_cart',
  'checkout_started',
  'payment_succeeded',
  'payment_failed',
  'order_created',
] as const;

export type StoreActivityType = (typeof STORE_ACTIVITY_TYPES)[number];
export type StoreActivityDocument = HydratedDocument<StoreActivity>;

@Schema({ timestamps: true, autoIndex: true })
export class StoreActivity {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ required: true, enum: STORE_ACTIVITY_TYPES, index: true })
  type: StoreActivityType;

  @Prop({ default: '' })
  sessionId?: string;

  @Prop({ default: '' })
  email?: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const StoreActivitySchema = SchemaFactory.createForClass(StoreActivity);
StoreActivitySchema.index({ userId: 1, collectionId: 1, createdAt: -1 });
StoreActivitySchema.index({ collectionId: 1, type: 1, createdAt: -1 });

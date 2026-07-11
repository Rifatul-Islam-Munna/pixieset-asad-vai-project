import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlanPurchaseDocument = HydratedDocument<PlanPurchase>;

@Schema({ timestamps: true })
export class PlanPurchase {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true }) planId: string;
  @Prop({ required: true }) planName: string;
  @Prop({ required: true, default: 0 }) amount: number;
  @Prop({ required: true, enum: ['admin', 'checkout', 'free'] }) source: 'admin' | 'checkout' | 'free';
  @Prop({ unique: true, sparse: true }) stripeSessionId?: string;
  @Prop({ required: true, enum: ['active', 'paid'] }) status: 'active' | 'paid';
}

export const PlanPurchaseSchema = SchemaFactory.createForClass(PlanPurchase);

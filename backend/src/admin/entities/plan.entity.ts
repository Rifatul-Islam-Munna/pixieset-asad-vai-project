import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlanDocument = HydratedDocument<Plan>;

@Schema({ timestamps: true, autoIndex: true })
export class Plan {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  storageGb: number;

  @Prop({ required: true, min: 0 })
  monthlyEmails: number;

  @Prop({ default: 0, min: 0 })
  videoMinutes: number;

  @Prop({ default: 'hd', enum: ['hd', '4k'] })
  videoQuality: 'hd' | '4k';

  @Prop({ default: 0, min: 0 })
  priceMonthly: number;

  @Prop({ default: false })
  yearlyEnabled: boolean;

  @Prop({ default: 0, min: 0 })
  priceYearly: number;

  @Prop({ type: Object, default: {} })
  features: {
    pinSet?: boolean;
    downloadLimit?: boolean;
    coverImage?: boolean;
    layouts?: boolean;
    advancedDesign?: boolean;
    customCover?: boolean;
    store?: boolean;
    marketingEmails?: boolean;
  };

  @Prop({ default: true })
  active: boolean;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);

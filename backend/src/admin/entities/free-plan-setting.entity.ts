import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FreePlanSettingDocument = HydratedDocument<FreePlanSetting>;

@Schema({ timestamps: true })
export class FreePlanSetting {
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  @Prop({ required: true, default: 3, min: 0 })
  storageGb: number;

  @Prop({ required: true, default: 1000, min: 0 })
  monthlyEmails: number;
}

export const FreePlanSettingSchema = SchemaFactory.createForClass(FreePlanSetting);

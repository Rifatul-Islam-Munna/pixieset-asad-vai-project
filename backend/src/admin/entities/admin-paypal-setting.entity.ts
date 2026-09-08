import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminPayPalSettingDocument = HydratedDocument<AdminPayPalSetting>;

@Schema({ timestamps: true, autoIndex: true })
export class AdminPayPalSetting {
  @Prop({ default: 'global', unique: true, index: true }) key: string;
  @Prop({ default: false }) enabled: boolean;
  @Prop({ default: 'sandbox', enum: ['sandbox', 'live'] }) environment: 'sandbox' | 'live';
  @Prop({ default: '' }) clientId: string;
  @Prop({ default: '' }) clientSecret: string;
  @Prop({ default: '' }) webhookId: string;
}

export const AdminPayPalSettingSchema = SchemaFactory.createForClass(AdminPayPalSetting);

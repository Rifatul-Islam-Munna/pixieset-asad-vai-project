import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminStripeSettingDocument = HydratedDocument<AdminStripeSetting>;

@Schema({ timestamps: true, autoIndex: true })
export class AdminStripeSetting {
  @Prop({ default: 'global', unique: true, index: true })
  key: string;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ default: '' })
  publishableKey: string;

  @Prop({ default: '' })
  secretKey: string;

  @Prop({ default: '' })
  webhookSecret: string;
}

export const AdminStripeSettingSchema = SchemaFactory.createForClass(AdminStripeSetting);

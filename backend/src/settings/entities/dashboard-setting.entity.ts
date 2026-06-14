import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DashboardSettingDocument = HydratedDocument<DashboardSetting>;

export enum DashboardSettingType {
  WATERMARK = 'watermark',
  PRESET = 'preset',
  EMAIL_TEMPLATE = 'email-template',
}

@Schema({ timestamps: true, autoIndex: true })
export class DashboardSetting {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: DashboardSettingType, index: true })
  type: DashboardSettingType;

  @Prop({ index: true })
  collectionId?: string;

  @Prop({ required: true })
  localId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Object, default: {} })
  data: Record<string, unknown>;
}

export const DashboardSettingSchema =
  SchemaFactory.createForClass(DashboardSetting);

DashboardSettingSchema.index(
  { userId: 1, type: 1, localId: 1 },
  { unique: true },
);

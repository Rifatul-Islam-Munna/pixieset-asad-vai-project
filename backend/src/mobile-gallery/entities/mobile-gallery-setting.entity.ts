import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MobileGallerySettingDocument = HydratedDocument<MobileGallerySetting>;

@Schema({ timestamps: true, autoIndex: true })
export class MobileGallerySetting {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop()
  logoUrl?: string;

  @Prop({ default: '' })
  biography: string;

  @Prop({ type: Object, default: {} })
  socialLinks: Record<string, string>;

  @Prop({ default: '' })
  contactEmail: string;

  @Prop({ default: '' })
  phoneNumber: string;

  @Prop({ default: '' })
  businessAddress: string;

  @Prop({ default: '' })
  website: string;
}

export const MobileGallerySettingSchema = SchemaFactory.createForClass(MobileGallerySetting);

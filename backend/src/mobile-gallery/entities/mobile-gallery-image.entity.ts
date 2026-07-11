import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MobileGalleryImageDocument = HydratedDocument<MobileGalleryImage>;

@Schema({ timestamps: true, autoIndex: true })
export class MobileGalleryImage {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  appId: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  originalName?: string;

  @Prop()
  filename?: string;

  @Prop()
  mimetype?: string;

  @Prop({ default: 'image', enum: ['image', 'video'], index: true })
  mediaType: 'image' | 'video';

  @Prop({ default: 0 })
  sizeBytes: number;

  @Prop({ default: 0 })
  durationSeconds?: number;

  @Prop({ default: 0 })
  width?: number;

  @Prop({ default: 0 })
  height?: number;

  @Prop({ default: 0 })
  order: number;
}

export const MobileGalleryImageSchema = SchemaFactory.createForClass(MobileGalleryImage);
MobileGalleryImageSchema.index({ appId: 1, order: 1, createdAt: -1 });

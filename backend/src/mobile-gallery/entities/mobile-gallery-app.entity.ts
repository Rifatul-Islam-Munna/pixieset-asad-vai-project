import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MobileGalleryAppDocument = HydratedDocument<MobileGalleryApp>;

@Schema({ timestamps: true, autoIndex: true })
export class MobileGalleryApp {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  slug: string;

  @Prop()
  eventDate?: Date;

  @Prop()
  coverImage?: string;

  @Prop()
  iconUrl?: string;

  @Prop({ default: 0 })
  imageCount: number;

  @Prop({ default: 'published' })
  status: 'published' | 'draft';

  @Prop({ type: Object, default: {} })
  design: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  settings: Record<string, unknown>;
}

export const MobileGalleryAppSchema = SchemaFactory.createForClass(MobileGalleryApp);
MobileGalleryAppSchema.index({ userId: 1, createdAt: -1 });

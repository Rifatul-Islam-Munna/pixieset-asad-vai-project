import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionDocument = HydratedDocument<Collection>;

@Schema({ timestamps: true, autoIndex: true })
export class Collection {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  slug?: string;

  @Prop()
  eventDate?: Date;

  @Prop()
  presetId?: string;

  @Prop()
  coverImage?: string;

  @Prop({ default: 0 })
  imageCount: number;

  @Prop({ default: 'draft' })
  status: string;
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);
CollectionSchema.index({ userId: 1, createdAt: -1 });

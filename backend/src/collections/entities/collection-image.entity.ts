import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionImageDocument = HydratedDocument<CollectionImage>;

@Schema({ timestamps: true, autoIndex: true })
export class CollectionImage {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ index: true })
  setId?: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  blurDataUrl?: string;

  @Prop()
  originalName?: string;

  @Prop()
  filename?: string;

  @Prop()
  mimetype?: string;

  @Prop({ default: 0 })
  sizeBytes: number;

  @Prop({ default: false })
  watermarked: boolean;

  @Prop({ default: 0, index: true })
  order: number;

  @Prop()
  faceIndexedAt?: Date;

  @Prop({ default: 0 })
  faceCount?: number;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const CollectionImageSchema =
  SchemaFactory.createForClass(CollectionImage);
CollectionImageSchema.index({ collectionId: 1, order: 1, createdAt: -1 });

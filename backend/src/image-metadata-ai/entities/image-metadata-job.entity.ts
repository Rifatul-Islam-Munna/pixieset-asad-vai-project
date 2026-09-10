import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ImageMetadataJobDocument = HydratedDocument<ImageMetadataJob>;
export type ImageMetadataJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

@Schema({ timestamps: true, autoIndex: true })
export class ImageMetadataJob {
  @Prop({ required: true, unique: true, index: true })
  imageId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({
    default: 'queued',
    enum: ['queued', 'processing', 'completed', 'failed'],
    index: true,
  })
  status: ImageMetadataJobStatus;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: Date.now, index: true })
  nextAttemptAt: Date;

  @Prop()
  leaseUntil?: Date;

  @Prop({ maxlength: 500 })
  lastError?: string;
}

export const ImageMetadataJobSchema =
  SchemaFactory.createForClass(ImageMetadataJob);

ImageMetadataJobSchema.index({
  status: 1,
  nextAttemptAt: 1,
  createdAt: 1,
});

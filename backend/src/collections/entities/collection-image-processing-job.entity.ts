import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionImageProcessingJobDocument =
  HydratedDocument<CollectionImageProcessingJob>;
export type CollectionImageProcessingJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

@Schema({ timestamps: true, autoIndex: true })
export class CollectionImageProcessingJob {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop()
  setId?: string;

  @Prop()
  watermarkId?: string;

  @Prop()
  replaceImageId?: string;

  @Prop({ required: true, unique: true, index: true })
  objectKey: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true, min: 1 })
  size: number;

  @Prop({ default: 0 })
  durationSeconds?: number;

  @Prop({ default: 0 })
  width?: number;

  @Prop({ default: 0 })
  height?: number;

  @Prop({
    required: true,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued',
    index: true,
  })
  status: CollectionImageProcessingJobStatus;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: '' })
  lastError: string;

  @Prop({ default: '', enum: ['', 'optimized', 'raw-fallback'] })
  resultMode?: '' | 'optimized' | 'raw-fallback';

  @Prop({ default: '' })
  statusMessage?: string;

  @Prop({ default: Date.now, index: true })
  nextAttemptAt: Date;

  @Prop()
  processingStartedAt?: Date;

  @Prop()
  completedAt?: Date;
}

export const CollectionImageProcessingJobSchema =
  SchemaFactory.createForClass(CollectionImageProcessingJob);

CollectionImageProcessingJobSchema.index({
  status: 1,
  nextAttemptAt: 1,
  createdAt: 1,
});
CollectionImageProcessingJobSchema.index({ collectionId: 1, status: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionImageDeleteJobDocument =
  HydratedDocument<CollectionImageDeleteJob>;

@Schema({ timestamps: true, autoIndex: true })
export class CollectionImageDeleteJob {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ required: true, unique: true, index: true })
  imageId: string;

  @Prop({ type: [String], default: [] })
  publicReferences: string[];

  @Prop({ type: [String], default: [] })
  privateObjectKeys: string[];

  @Prop({ type: [String], default: [] })
  cacheObjectKeys: string[];

  @Prop({ type: [String], default: [] })
  cachePublicUrls: string[];

  // Signed Imagor URLs for on-demand Result Storage objects (currently the
  // tiny thumbnail). The Imagor worker deterministically derives the R2 key on
  // delete, so thumbnails do not need permanent metadata rows just to be cleaned.
  @Prop({ type: [String], default: [] })
  cacheTransformUrls: string[];

  @Prop({
    default: '',
    enum: ['', 'queued', 'processing', 'completed', 'failed'],
    index: true,
  })
  cacheDeleteStatus: '' | 'queued' | 'processing' | 'completed' | 'failed';

  @Prop({ default: 0 })
  cacheDeleteAttempts: number;

  @Prop({ index: true })
  cacheDeleteNextAttemptAt?: Date;

  @Prop({ default: '' })
  cacheDeleteLastError: string;

  @Prop()
  cacheDeleteProcessingStartedAt?: Date;

  @Prop()
  cacheDeletedAt?: Date;

  @Prop({
    default: 'queued',
    enum: ['queued', 'processing', 'completed', 'failed'],
    index: true,
  })
  status: 'queued' | 'processing' | 'completed' | 'failed';

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: Date.now, index: true })
  nextAttemptAt: Date;

  @Prop({ default: '' })
  lastError: string;

  @Prop()
  processingStartedAt?: Date;

  @Prop()
  completedAt?: Date;
}

export const CollectionImageDeleteJobSchema =
  SchemaFactory.createForClass(CollectionImageDeleteJob);

CollectionImageDeleteJobSchema.index({
  status: 1,
  nextAttemptAt: 1,
  createdAt: 1,
});
CollectionImageDeleteJobSchema.index({
  cacheDeleteStatus: 1,
  cacheDeleteNextAttemptAt: 1,
  createdAt: 1,
});

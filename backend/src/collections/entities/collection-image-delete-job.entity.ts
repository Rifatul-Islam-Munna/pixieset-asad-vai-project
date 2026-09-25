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

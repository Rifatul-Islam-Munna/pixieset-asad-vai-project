import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ImageMetadataWorkerLockDocument =
  HydratedDocument<ImageMetadataWorkerLock>;

@Schema({ timestamps: true, autoIndex: true })
export class ImageMetadataWorkerLock {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ default: '' })
  ownerId: string;

  @Prop({ default: () => new Date(0), index: true })
  lockedUntil: Date;
}

export const ImageMetadataWorkerLockSchema =
  SchemaFactory.createForClass(ImageMetadataWorkerLock);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionDownloadActivityDocument = HydratedDocument<CollectionDownloadActivity>;

@Schema({ timestamps: true, autoIndex: true })
export class CollectionDownloadActivity {
  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ trim: true, lowercase: true, default: '' })
  email: string;

  @Prop({ index: true })
  imageId?: string;

  @Prop({ default: '' })
  imageName: string;

  @Prop({ default: '' })
  imageUrl: string;

  @Prop({ default: 'single' })
  downloadType: 'single' | 'all';

  @Prop({ default: 1 })
  count: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CollectionDownloadActivitySchema =
  SchemaFactory.createForClass(CollectionDownloadActivity);
CollectionDownloadActivitySchema.index({ collectionId: 1, email: 1, imageId: 1, downloadType: 1 });

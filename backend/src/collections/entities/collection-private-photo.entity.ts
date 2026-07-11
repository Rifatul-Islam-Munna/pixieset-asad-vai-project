import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionPrivatePhotoDocument = HydratedDocument<CollectionPrivatePhoto>;

@Schema({ timestamps: true, autoIndex: true })
export class CollectionPrivatePhoto {
  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  email: string;

  @Prop({ required: true, index: true })
  imageId: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CollectionPrivatePhotoSchema =
  SchemaFactory.createForClass(CollectionPrivatePhoto);

CollectionPrivatePhotoSchema.index(
  { collectionId: 1, email: 1, imageId: 1 },
  { unique: true },
);

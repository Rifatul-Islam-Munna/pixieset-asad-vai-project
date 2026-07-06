import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionImageFavoriteDocument = HydratedDocument<CollectionImageFavorite>;

@Schema({ timestamps: true, autoIndex: true })
export class CollectionImageFavorite {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ required: true, index: true })
  imageId: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CollectionImageFavoriteSchema =
  SchemaFactory.createForClass(CollectionImageFavorite);
CollectionImageFavoriteSchema.index(
  { userId: 1, imageId: 1 },
  { unique: true },
);

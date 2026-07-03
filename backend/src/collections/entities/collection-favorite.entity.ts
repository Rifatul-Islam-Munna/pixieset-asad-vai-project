import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionFavoriteDocument = HydratedDocument<CollectionFavorite>;

@Schema({ timestamps: true, autoIndex: true })
export class CollectionFavorite {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  collectionId: string;

  createdAt?: Date;
}

export const CollectionFavoriteSchema = SchemaFactory.createForClass(CollectionFavorite);
CollectionFavoriteSchema.index({ userId: 1, collectionId: 1 }, { unique: true });

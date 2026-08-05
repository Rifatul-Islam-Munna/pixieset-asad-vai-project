import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionViewDocument = HydratedDocument<CollectionView>;

@Schema({ timestamps: true, autoIndex: true })
export class CollectionView {
  @Prop({ required: true, index: true }) collectionId: string;
  @Prop({ required: true, index: true }) ownerId: string;
  @Prop({ default: '' }) visitorKey: string;
  @Prop({ default: '' }) source: string;
  @Prop({ default: '' }) viewToken: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const CollectionViewSchema =
  SchemaFactory.createForClass(CollectionView);
CollectionViewSchema.index({ ownerId: 1, createdAt: -1 });
CollectionViewSchema.index({ collectionId: 1, createdAt: -1 });
CollectionViewSchema.index(
  { viewToken: 1 },
  {
    unique: true,
    partialFilterExpression: { viewToken: { $type: 'string', $ne: '' } },
  },
);

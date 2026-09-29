import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FacePersonDocument = HydratedDocument<FacePerson>;

@Schema({ timestamps: true, autoIndex: true })
export class FacePerson {
  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ index: true })
  userId?: string;

  @Prop({ required: true, index: true })
  personKey: string;

  @Prop({ index: true })
  identityKey?: string;

  @Prop({ required: true, type: [Number] })
  centroid: number[];

  @Prop({ required: true })
  representativeImageId: string;

  @Prop({ required: true })
  representativeFaceId: string;

  @Prop()
  representativeUrl?: string;

  @Prop({ type: Object })
  representativeBox?: { x: number; y: number; width: number; height: number };

  @Prop({ default: 0 })
  faceCount: number;

  @Prop({ default: 0 })
  imageCount: number;

  // Persist the photo membership for this person so clicking a face does not
  // have to scan every vector in Qdrant again. Existing rows without this field
  // transparently fall back to Qdrant once and are backfilled.
  @Prop({ type: [String], default: [] })
  imageIds: string[];
}

export const FacePersonSchema = SchemaFactory.createForClass(FacePerson);
FacePersonSchema.index({ collectionId: 1, personKey: 1 }, { unique: true });
FacePersonSchema.index({ userId: 1, identityKey: 1 });
FacePersonSchema.index({ collectionId: 1, identityKey: 1 });
FacePersonSchema.index({ collectionId: 1, imageCount: -1, faceCount: -1 });
FacePersonSchema.index({ collectionId: 1, representativeFaceId: 1 });

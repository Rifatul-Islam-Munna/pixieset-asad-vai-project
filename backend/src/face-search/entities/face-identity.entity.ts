import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FaceIdentityDocument = HydratedDocument<FaceIdentity>;

@Schema({ timestamps: true, autoIndex: true })
export class FaceIdentity {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  identityKey: string;

  @Prop({ trim: true, maxlength: 80 })
  name?: string;

  @Prop({ required: true, type: [Number] })
  centroid: number[];

  @Prop({ type: [String], default: [], index: true })
  collectionIds: string[];

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

  @Prop({ type: Date, default: Date.now, index: true })
  lastSeenAt: Date;
}

export const FaceIdentitySchema = SchemaFactory.createForClass(FaceIdentity);
FaceIdentitySchema.index({ userId: 1, identityKey: 1 }, { unique: true });
FaceIdentitySchema.index({ userId: 1, name: 1 });

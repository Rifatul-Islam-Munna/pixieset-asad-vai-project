import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FacePersonDocument = HydratedDocument<FacePerson>;

@Schema({ timestamps: true, autoIndex: true })
export class FacePerson {
  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ required: true, index: true })
  personKey: string;

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
}

export const FacePersonSchema = SchemaFactory.createForClass(FacePerson);
FacePersonSchema.index({ collectionId: 1, personKey: 1 }, { unique: true });

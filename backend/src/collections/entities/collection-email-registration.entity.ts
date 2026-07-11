import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionEmailRegistrationDocument = HydratedDocument<CollectionEmailRegistration>;

@Schema({ timestamps: true, autoIndex: true })
export class CollectionEmailRegistration {
  @Prop({ required: true, index: true })
  collectionId: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, default: '' })
  collectionName: string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  email: string;

  @Prop({ default: false, index: true })
  marketingOptIn: boolean;

  @Prop({ type: [String], default: [] })
  sources: string[];

  @Prop({ default: 'email-registration' })
  lastSource: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CollectionEmailRegistrationSchema =
  SchemaFactory.createForClass(CollectionEmailRegistration);

CollectionEmailRegistrationSchema.index(
  { collectionId: 1, email: 1 },
  { unique: true },
);
CollectionEmailRegistrationSchema.index(
  { ownerId: 1, marketingOptIn: 1, updatedAt: -1 },
);

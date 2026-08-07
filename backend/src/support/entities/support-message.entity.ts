import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SupportMessageDocument = HydratedDocument<SupportMessage>;

@Schema({ timestamps: true, autoIndex: true })
export class SupportMessage {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: ['user', 'admin'] })
  senderType: 'user' | 'admin';

  @Prop({ required: true, trim: true, maxlength: 4000 })
  message: string;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SupportMessageSchema = SchemaFactory.createForClass(SupportMessage);
SupportMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SupportMessageSchema.index({ userId: 1, createdAt: 1 });

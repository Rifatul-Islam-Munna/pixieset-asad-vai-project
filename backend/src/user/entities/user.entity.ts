import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum UserType {
  ADMIN = 'admin',
  EDITOR = 'editor',
  USER = 'user',
}

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, autoIndex: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  googleId?: string;

  @Prop()
  avatar?: string;

  @Prop({ required: true, unique: true, trim: true })
  phoneNumber: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: UserType, default: UserType.USER })
  role: UserType;

  @Prop()
  gender?: string;

  @Prop({ default: true })
  isOtpVerified: boolean;

  @Prop()
  otpNumber?: string;

  @Prop()
  otpValidatedAt?: Date;

  @Prop({ default: 0 })
  numberOfConnections: number;

  @Prop()
  planId?: string;

  @Prop({ default: 'Free' })
  planName: string;

  @Prop({ default: 0 })
  storageLimitGb: number;

  @Prop({ default: 0 })
  monthlyEmailLimit: number;

  @Prop({ default: 0 })
  storageUsedBytes: number;

  @Prop({ default: 0 })
  monthlyEmailsUsed: number;

  @Prop({ type: Object, default: {} })
  planFeatures: Record<string, boolean>;

  @Prop()
  monthlyUsageKey?: string;

  @Prop()
  planActivatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

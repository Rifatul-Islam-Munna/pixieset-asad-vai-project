import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingShareLinkDocument = HydratedDocument<BookingShareLink>;

@Schema({ timestamps: true, autoIndex: true })
export class BookingShareLink {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, unique: true, index: true, trim: true })
  token: string;

  @Prop({ trim: true, maxlength: 120, default: '' })
  recipientName: string;

  @Prop({ trim: true, lowercase: true, maxlength: 180, default: '' })
  recipientEmail: string;

  @Prop({ trim: true, default: '' })
  serviceId: string;

  @Prop({ trim: true, maxlength: 120, default: '' })
  serviceName: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ index: true })
  usedAt?: Date;

  @Prop({ trim: true, default: '' })
  bookingEventId: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BookingShareLinkSchema = SchemaFactory.createForClass(BookingShareLink);
BookingShareLinkSchema.index({ userId: 1, createdAt: -1 });
BookingShareLinkSchema.index({ userId: 1, expiresAt: 1 });

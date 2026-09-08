import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingCoworkerDocument = HydratedDocument<BookingCoworker>;

@Schema({ timestamps: true, autoIndex: true })
export class BookingCoworker {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, lowercase: true, maxlength: 180, default: '' })
  email: string;

  @Prop({ trim: true, maxlength: 60, default: '' })
  phone: string;

  @Prop({ trim: true, maxlength: 100, default: 'Photographer' })
  role: string;

  @Prop({ trim: true, maxlength: 1200, default: '' })
  notes: string;

  @Prop({ default: true, index: true })
  active: boolean;
}

export const BookingCoworkerSchema = SchemaFactory.createForClass(BookingCoworker);
BookingCoworkerSchema.index({ userId: 1, email: 1 });

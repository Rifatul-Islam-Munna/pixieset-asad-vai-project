import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingServiceDocument = HydratedDocument<BookingService>;

@Schema({ timestamps: true, autoIndex: true })
export class BookingService {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 1600, default: '' })
  description: string;

  @Prop({ default: 60, min: 15, max: 1440 })
  durationMinutes: number;

  @Prop({ default: 0, min: 0 })
  price: number;

  @Prop({ default: 'USD', uppercase: true, trim: true })
  currency: string;

  @Prop({ trim: true, maxlength: 240, default: '' })
  location: string;

  @Prop({ type: [String], default: [] })
  coworkerIds: string[];

  @Prop({ default: true, index: true })
  active: boolean;
}

export const BookingServiceSchema = SchemaFactory.createForClass(BookingService);
BookingServiceSchema.index({ userId: 1, active: 1, createdAt: 1 });

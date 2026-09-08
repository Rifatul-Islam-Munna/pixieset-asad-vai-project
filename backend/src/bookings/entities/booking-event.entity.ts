import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingEventDocument = HydratedDocument<BookingEvent>;

@Schema({ timestamps: true, autoIndex: true })
export class BookingEvent {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true, maxlength: 180 })
  title: string;

  @Prop({ enum: ['booking', 'event'], default: 'event', index: true })
  kind: 'booking' | 'event';

  @Prop({ enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'confirmed', index: true })
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';

  @Prop({ required: true, index: true })
  startAt: Date;

  @Prop({ required: true, index: true })
  endAt: Date;

  @Prop({ default: false })
  allDay: boolean;

  @Prop({ trim: true, maxlength: 240, default: '' })
  location: string;

  @Prop({ trim: true, maxlength: 2000, default: '' })
  notes: string;

  @Prop({ trim: true, maxlength: 120, default: '' })
  clientName: string;

  @Prop({ trim: true, lowercase: true, maxlength: 180, default: '' })
  clientEmail: string;

  @Prop({ trim: true, maxlength: 60, default: '' })
  clientPhone: string;

  @Prop({ trim: true, default: '' })
  serviceId: string;

  @Prop({ trim: true, default: '' })
  serviceName: string;

  @Prop({ type: [String], default: [] })
  coworkerIds: string[];

  @Prop({ enum: ['dashboard', 'public'], default: 'dashboard' })
  source: 'dashboard' | 'public';
}

export const BookingEventSchema = SchemaFactory.createForClass(BookingEvent);
BookingEventSchema.index({ userId: 1, startAt: 1, endAt: 1 });
BookingEventSchema.index({ userId: 1, kind: 1, status: 1, startAt: 1 });

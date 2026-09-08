import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingSettingDocument = HydratedDocument<BookingSetting>;

export type BookingBusinessHour = {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
};

const DEFAULT_HOURS: BookingBusinessHour[] = [
  { day: 0, enabled: false, start: '09:00', end: '17:00' },
  { day: 1, enabled: true, start: '09:00', end: '17:00' },
  { day: 2, enabled: true, start: '09:00', end: '17:00' },
  { day: 3, enabled: true, start: '09:00', end: '17:00' },
  { day: 4, enabled: true, start: '09:00', end: '17:00' },
  { day: 5, enabled: true, start: '09:00', end: '17:00' },
  { day: 6, enabled: false, start: '09:00', end: '17:00' },
];

@Schema({ timestamps: true, autoIndex: true })
export class BookingSetting {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({ default: 24, min: 0, max: 720 })
  minNoticeHours: number;

  @Prop({ default: 90, min: 1, max: 730 })
  maxAdvanceDays: number;

  @Prop({ default: 30, min: 5, max: 240 })
  slotIntervalMinutes: number;

  @Prop({ default: true })
  autoConfirm: boolean;

  @Prop({ default: 'Thanks! Your booking request has been received.' })
  confirmationMessage: string;

  @Prop({ type: Array, default: DEFAULT_HOURS })
  businessHours: BookingBusinessHour[];
}

export const BookingSettingSchema = SchemaFactory.createForClass(BookingSetting);

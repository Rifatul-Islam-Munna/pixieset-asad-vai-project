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

  @Prop({ enum: ['full', 'mini'], default: 'full' })
  sessionStyle: 'full' | 'mini';

  @Prop({ trim: true, maxlength: 500, default: '' })
  coverImageUrl: string;

  @Prop({ type: String, enum: ['public', 'private'], default: 'public' })
  bookingVisibility: 'public' | 'private';

  @Prop({ type: String, enum: ['draft', 'published'], default: 'published', index: true })
  status: 'draft' | 'published';

  @Prop({ trim: true, default: '#16bfa5' })
  sessionColor: string;

  @Prop({ trim: true, default: 'UTC' })
  timezone: string;

  @Prop({ default: true })
  createProjectOnBooking: boolean;

  @Prop({ trim: true, default: 'inquiry' })
  projectStage: string;

  @Prop({ trim: true, default: 'portrait' })
  projectType: string;

  @Prop({ type: [Object], default: [] })
  availability: Array<{ day: number; enabled: boolean; start: string; end: string }>;

  @Prop({ type: [Object], default: [] })
  sessionDates: Array<{ date: string; start: string; end: string }>;

  @Prop({ type: [Object], default: [] })
  intakeFields: Array<{ name: string; label: string; type: string; required: boolean; options?: string }>;

  @Prop({ type: String, enum: ['manual', 'none'], default: 'none' })
  paymentPolicy: 'manual' | 'none';

  @Prop({ type: Object, default: {} })
  bookingRules: { minNoticeHours?: number; maxAdvanceDays?: number; slotIntervalMinutes?: number; autoConfirm?: boolean };

  @Prop({ trim: true, maxlength: 1000, default: '' })
  confirmationMessage: string;

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

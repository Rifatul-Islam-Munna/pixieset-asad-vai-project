import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MarketingEmailScheduleDocument = HydratedDocument<MarketingEmailSchedule>;
export type MarketingScheduleStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

@Schema({ timestamps: true, autoIndex: true, collection: 'marketing_email_schedules' })
export class MarketingEmailSchedule {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true, trim: true, maxlength: 160 }) name: string;
  @Prop({ required: true, enum: ['scheduled', 'sending', 'sent', 'failed', 'cancelled'], default: 'scheduled', index: true }) status: MarketingScheduleStatus;
  @Prop({ required: true, enum: ['contacts', 'category'] }) recipientMode: 'contacts' | 'category';
  @Prop({ type: [String], default: [] }) recipientEmails: string[];
  @Prop({ trim: true, maxlength: 180 }) recipientCategory?: string;
  @Prop({ required: true, trim: true, maxlength: 180 }) templateId: string;
  @Prop({ required: true, trim: true, maxlength: 180 }) templateName: string;
  @Prop({ required: true, trim: true, maxlength: 220 }) subject: string;
  @Prop({ default: '', maxlength: 500 }) previewText: string;
  @Prop({ default: '', maxlength: 12000 }) message: string;
  @Prop({ default: '', maxlength: 3000 }) footerText: string;
  @Prop({ default: '', maxlength: 160 }) eyebrowText: string;
  @Prop({ default: '', maxlength: 160 }) buttonText: string;
  @Prop({ default: '', maxlength: 1500 }) buttonLink: string;
  @Prop({ default: '#444444', maxlength: 30 }) buttonColor: string;
  @Prop({ default: '', maxlength: 1500 }) image: string;
  @Prop({ default: true }) showImage: boolean;
  @Prop({ trim: true }) collectionId?: string;
  @Prop({ trim: true }) collectionName?: string;
  @Prop({ required: true }) scheduledAt: Date;
  @Prop({ required: true, trim: true }) scheduledLocal: string;
  @Prop({ required: true, trim: true, maxlength: 120 }) timeZone: string;
  @Prop({ default: 0 }) recipientsCount: number;
  @Prop() sentAt?: Date;
  @Prop({ default: '', maxlength: 2000 }) lastError?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const MarketingEmailScheduleSchema = SchemaFactory.createForClass(MarketingEmailSchedule);
MarketingEmailScheduleSchema.index({ userId: 1, createdAt: -1 });
MarketingEmailScheduleSchema.index({ status: 1, scheduledAt: 1 });

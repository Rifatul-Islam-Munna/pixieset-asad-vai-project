import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MarketingEmailAutomationDocument = HydratedDocument<MarketingEmailAutomation>;

@Schema({ timestamps: true, autoIndex: true, collection: 'marketing_email_automations' })
export class MarketingEmailAutomation {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true, trim: true, maxlength: 160 }) name: string;
  @Prop({ default: true, index: true }) enabled: boolean;
  @Prop({ required: true, enum: ['new-subscriber', 'gallery-published', 'client-download', 'client-favorite'], default: 'new-subscriber', index: true })
  trigger: 'new-subscriber' | 'gallery-published' | 'client-download' | 'client-favorite';
  @Prop({ trim: true, maxlength: 180 }) recipientCategory?: string;
  @Prop({ default: 0, min: 0, max: 525600 }) delayMinutes: number;
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
  @Prop({ default: () => new Date(), index: true }) cursorUpdatedAt: Date;
  @Prop({ default: '', trim: true }) cursorContactId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const MarketingEmailAutomationSchema = SchemaFactory.createForClass(MarketingEmailAutomation);
MarketingEmailAutomationSchema.index({ userId: 1, createdAt: -1 });
MarketingEmailAutomationSchema.index({ enabled: 1, cursorUpdatedAt: 1 });

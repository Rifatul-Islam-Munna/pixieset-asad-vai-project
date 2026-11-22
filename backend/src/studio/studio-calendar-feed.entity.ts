import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StudioCalendarFeedDocument = HydratedDocument<StudioCalendarFeed>;

@Schema({ timestamps: true, versionKey: false })
export class StudioCalendarFeed {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ default: false })
  disabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const StudioCalendarFeedSchema = SchemaFactory.createForClass(StudioCalendarFeed);

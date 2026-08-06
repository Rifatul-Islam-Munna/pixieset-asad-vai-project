import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BlogDocument = HydratedDocument<Blog>;

@Schema({ timestamps: true, collection: 'blogs' })
export class Blog {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true }) slug: string;
  @Prop({ default: '' }) excerpt: string;
  @Prop({ default: '' }) content: string;
  @Prop({ default: '' }) thumbnailUrl: string;
  @Prop({ default: '' }) author: string;
  @Prop({ type: [String], default: [] }) keywords: string[];
  @Prop({ default: true, index: true }) published: boolean;
  @Prop({ type: Date, default: Date.now }) publishedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);
BlogSchema.index({ published: 1, publishedAt: -1 });

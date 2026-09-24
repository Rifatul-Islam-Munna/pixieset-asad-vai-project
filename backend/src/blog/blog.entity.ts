import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BlogDocument = HydratedDocument<Blog>;

@Schema({ _id: false })
export class BlogCtaButton {
  @Prop({ default: '' }) id: string;
  @Prop({ default: true }) enabled: boolean;
  @Prop({ default: '' }) label: string;
  @Prop({ default: '' }) url: string;
  @Prop({ default: 'primary' }) style: string;
  @Prop({ default: false }) newTab: boolean;
}
const BlogCtaButtonSchema = SchemaFactory.createForClass(BlogCtaButton);

@Schema({ timestamps: true, collection: 'blogs' })
export class Blog {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true }) slug: string;
  @Prop({ default: '' }) excerpt: string;
  @Prop({ default: '' }) content: string;
  @Prop({ default: '' }) thumbnailUrl: string;
  @Prop({ default: '' }) author: string;
  @Prop({ default: 'Guides', trim: true, index: true }) category: string;
  @Prop({ default: 'English', trim: true, index: true }) language: string;
  @Prop({ default: false, index: true }) featured: boolean;
  @Prop({ default: false }) ctaEnabled: boolean;
  @Prop({ default: '' }) ctaTitle: string;
  @Prop({ default: '' }) ctaText: string;
  @Prop({ type: [BlogCtaButtonSchema], default: [] }) ctaButtons: BlogCtaButton[];
  @Prop({ type: [String], default: [] }) keywords: string[];
  @Prop({ default: '' }) seoTitle: string;
  @Prop({ default: '' }) seoDescription: string;
  @Prop({ default: '' }) canonicalUrl: string;
  @Prop({ default: '' }) ogTitle: string;
  @Prop({ default: '' }) ogDescription: string;
  @Prop({ default: '' }) ogImageUrl: string;
  @Prop({ default: true }) robotsIndex: boolean;
  @Prop({ default: true }) robotsFollow: boolean;
  @Prop({ default: true, index: true }) published: boolean;
  @Prop({ type: Date, default: Date.now }) publishedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);
BlogSchema.index({ published: 1, featured: -1, publishedAt: -1 });

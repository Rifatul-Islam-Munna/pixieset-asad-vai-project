import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DynamicPageDocument = HydratedDocument<DynamicPage>;

@Schema({ _id: false })
export class DynamicPageColumn {
  @Prop({ default: '' }) eyebrow: string;
  @Prop({ default: '' }) title: string;
  @Prop({ default: '' }) body: string;
  @Prop({ default: '' }) imageUrl: string;
  @Prop({ default: '' }) linkLabel: string;
  @Prop({ default: '' }) linkUrl: string;
}
const DynamicPageColumnSchema = SchemaFactory.createForClass(DynamicPageColumn);

@Schema({ _id: false })
export class DynamicPageSectionItem {
  @Prop({ default: '' }) id: string;
  @Prop({ default: '' }) eyebrow: string;
  @Prop({ default: '' }) title: string;
  @Prop({ default: '' }) body: string;
  @Prop({ default: '' }) imageUrl: string;
  @Prop({ default: '' }) label: string;
  @Prop({ default: '' }) value: string;
  @Prop({ default: '' }) linkLabel: string;
  @Prop({ default: '' }) linkUrl: string;
}
const DynamicPageSectionItemSchema = SchemaFactory.createForClass(DynamicPageSectionItem);

@Schema({ _id: false })
export class DynamicPageButton {
  @Prop({ default: '' }) id: string;
  @Prop({ default: true }) enabled: boolean;
  @Prop({ default: '' }) label: string;
  @Prop({ default: '' }) url: string;
  @Prop({ default: 'primary' }) style: string;
  @Prop({ default: false }) newTab: boolean;
}
const DynamicPageButtonSchema = SchemaFactory.createForClass(DynamicPageButton);

@Schema({ _id: false })
export class DynamicPageSection {
  @Prop({ default: '' }) id: string;
  @Prop({
    default: 'split',
    enum: ['split', 'rich-text', 'feature-grid', 'gallery', 'stats', 'testimonial', 'cta', 'logo-strip', 'steps'],
  })
  type: string;
  @Prop({ default: true }) enabled: boolean;
  @Prop({ default: '' }) eyebrow: string;
  @Prop({ default: '' }) title: string;
  @Prop({ default: '' }) body: string;
  @Prop({ default: '' }) imageUrl: string;
  @Prop({ default: 'image-right' }) layout: string;
  @Prop({ default: 'light' }) tone: string;
  @Prop({ default: 'left' }) alignment: string;
  @Prop({ default: '' }) buttonLabel: string;
  @Prop({ default: '' }) buttonUrl: string;
  @Prop({ default: '' }) secondaryButtonLabel: string;
  @Prop({ default: '' }) secondaryButtonUrl: string;
  @Prop({ type: [DynamicPageButtonSchema], default: [] }) buttons: DynamicPageButton[];
  @Prop({ default: 3, min: 2, max: 4 }) columns: number;
  @Prop({ type: [DynamicPageSectionItemSchema], default: [] })
  items: DynamicPageSectionItem[];
}
const DynamicPageSectionSchema = SchemaFactory.createForClass(DynamicPageSection);

@Schema({ timestamps: true, collection: 'dynamic_pages' })
export class DynamicPage {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true }) slug: string;
  @Prop({ default: '' }) navLabel: string;
  @Prop({ default: '' }) navDescription: string;
  @Prop({ default: true, index: true }) showInNavbar: boolean;
  @Prop({ default: 0, index: true }) navOrder: number;
  @Prop({ default: '' }) eyebrow: string;
  @Prop({ default: '' }) heroTitle: string;
  @Prop({ default: '' }) heroDescription: string;
  @Prop({ default: '' }) heroImageUrl: string;
  @Prop({ default: true }) heroEnabled: boolean;
  @Prop({ default: 'split' }) heroLayout: string;
  @Prop({ default: 'soft' }) heroTone: string;
  @Prop({ default: '' }) heroPrimaryLabel: string;
  @Prop({ default: '' }) heroPrimaryUrl: string;
  @Prop({ default: '' }) heroSecondaryLabel: string;
  @Prop({ default: '' }) heroSecondaryUrl: string;
  @Prop({ type: [DynamicPageButtonSchema], default: [] }) heroButtons: DynamicPageButton[];
  @Prop({ type: [DynamicPageColumnSchema], default: [] }) columns: DynamicPageColumn[];
  @Prop({ default: 3, min: 3, max: 8 }) columnCount: number;
  @Prop({ default: true }) legacyGridEnabled: boolean;
  @Prop({ type: [DynamicPageSectionSchema], default: [] }) sections: DynamicPageSection[];
  @Prop({ default: '' }) seoTitle: string;
  @Prop({ default: '' }) seoDescription: string;
  @Prop({ type: [String], default: [] }) seoKeywords: string[];
  @Prop({ default: '' }) canonicalUrl: string;
  @Prop({ default: '' }) ogTitle: string;
  @Prop({ default: '' }) ogDescription: string;
  @Prop({ default: '' }) ogImageUrl: string;
  @Prop({ default: true }) robotsIndex: boolean;
  @Prop({ default: true }) robotsFollow: boolean;
  @Prop({ default: true, index: true }) published: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const DynamicPageSchema = SchemaFactory.createForClass(DynamicPage);
DynamicPageSchema.index({ published: 1, navOrder: 1, title: 1 });

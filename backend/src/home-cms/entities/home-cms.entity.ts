import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HomeLanguage = 'en' | 'gr';
export type HomeCmsDocument = HydratedDocument<HomeCms>;

@Schema({ collection: 'homecms', timestamps: true, versionKey: false })
export class HomeCms {
  @Prop({ type: String, required: true, unique: true, immutable: true, default: 'home' })
  key: string;

  @Prop({ type: Object, required: true, default: () => ({ en: {}, gr: {} }) })
  content: Record<HomeLanguage, Record<string, unknown>>;

  @Prop({ type: Object, required: true, default: () => ({}) })
  seo: Record<string, unknown>;

  @Prop({ type: Object, required: true, default: () => ({}) })
  auth: Record<string, unknown>;

  @Prop({ type: Object, required: true, default: () => ({}) })
  brand: Record<string, unknown>;

  @Prop({ type: [Object], required: true, default: () => [] })
  coverTemplates: Record<string, unknown>[];

  @Prop({ type: Object, required: true, default: () => ({ heroMediaType: 'image', heroMediaUrl: '' }) })
  media: { heroMediaType: 'image' | 'video'; heroMediaUrl: string };

  @Prop({ type: String, required: true, enum: ['en', 'gr'], default: 'en' })
  defaultLanguage: HomeLanguage;
}

export const HomeCmsSchema = SchemaFactory.createForClass(HomeCms);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HomeCmsDocument = HydratedDocument<HomeCms>;

@Schema({ timestamps: true, autoIndex: true })
export class HomeCms {
  @Prop({ required: true, unique: true, default: 'home' })
  key: string;

  @Prop({ type: Object, default: {} })
  content: Record<string, any>;

  @Prop({ type: Object, default: { heroMediaType: 'image', heroMediaUrl: '' } })
  media: {
    heroMediaType?: 'image' | 'video';
    heroMediaUrl?: string;
  };

  @Prop({ default: 'en', enum: ['en', 'gr'] })
  defaultLanguage: 'en' | 'gr';
}

export const HomeCmsSchema = SchemaFactory.createForClass(HomeCms);

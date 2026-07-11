import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HomepageDocument = HydratedDocument<Homepage>;

export type HomepageSocialLinks = {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
};

export type HomepageVisibility = {
  biography?: boolean;
  social?: boolean;
  website?: boolean;
  email?: boolean;
  phone?: boolean;
  address?: boolean;
};

@Schema({ timestamps: true, autoIndex: true })
export class Homepage {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
    maxlength: 63,
    match: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
  })
  slug: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop()
  passwordHash?: string;

  @Prop({ trim: true })
  brandName?: string;

  @Prop({ trim: true })
  logoUrl?: string;

  @Prop({ trim: true, maxlength: 500 })
  biography?: string;

  @Prop({ trim: true })
  website?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ type: Object, default: {} })
  socialLinks: HomepageSocialLinks;

  @Prop({
    type: Object,
    default: {
      biography: true,
      social: true,
      website: true,
      email: true,
      phone: true,
      address: true,
    },
  })
  show: HomepageVisibility;

  @Prop({ enum: ['newest', 'oldest', 'name'], default: 'newest' })
  sortOrder: 'newest' | 'oldest' | 'name';

  createdAt?: Date;
  updatedAt?: Date;
}

export const HomepageSchema = SchemaFactory.createForClass(Homepage);

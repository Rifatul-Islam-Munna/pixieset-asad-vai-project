import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreSettingDocument = HydratedDocument<StoreSetting>;

@Schema({ timestamps: true, autoIndex: true })
export class StoreSetting {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ default: false })
  globalStatus: boolean;

  @Prop({ default: 'BDT' })
  currency: string;

  @Prop({ default: '6 Hours' })
  orderDelay: string;

  @Prop({ default: true })
  maintainMarkup: boolean;

  @Prop({ default: '.00' })
  roundPricesUpTo: string;

  @Prop({ type: Object, default: {} })
  paymentMethods: {
    stripe?: { enabled: boolean; accountLink?: string; publishableKey?: string };
    paypal?: { enabled: boolean; accountLink?: string; merchantEmail?: string };
    offline?: { enabled: boolean; instructions?: string };
  };

  @Prop({ type: [{ label: String, url: String }], default: [] })
  links: { label: string; url: string }[];

  @Prop({ type: Object, default: {} })
  domain: { hostname?: string; dnsTarget?: string; verified?: boolean };

  @Prop({ default: '' })
  giftCardSharingEmail: string;

  @Prop({ default: '' })
  termsOfSale: string;

  @Prop({ default: '' })
  digitalImageLicense: string;
}

export const StoreSettingSchema = SchemaFactory.createForClass(StoreSetting);

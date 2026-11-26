import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FreePlanSettingDocument = HydratedDocument<FreePlanSetting>;

@Schema({ timestamps: true })
export class FreePlanSetting {
  @Prop({default:10,min:0}) studioContactLimit:number;
  @Prop({default:10,min:0}) studioProjectLimit:number;
  @Prop({default:3,min:0}) studioProductLimit:number;
  @Prop({default:3,min:0}) studioQuestionnaireLimit:number;
  @Prop({default:3,min:0}) studioQuoteLimit:number;
  @Prop({default:25,min:0}) studioMonthlyEmails:number;
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  @Prop({ required: true, default: 3, min: 0 })
  storageGb: number;

  @Prop({ required: true, default: 1, min: 0 })
  subdomainLimit: number;

  @Prop({ required: true, default: 1000, min: 0 })
  monthlyEmails: number;
}

export const FreePlanSettingSchema = SchemaFactory.createForClass(FreePlanSetting);

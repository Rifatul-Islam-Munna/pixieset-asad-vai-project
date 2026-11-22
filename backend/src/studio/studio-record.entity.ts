import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export const STUDIO_KINDS = [
  'contacts', 'projects', 'invoices', 'payment-links', 'transactions',
  'documents', 'templates', 'forms', 'messages', 'discounts',
  'settings',
] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number];
export type StudioRecordDocument = HydratedDocument<StudioRecord>;

@Schema({ timestamps: true, versionKey: false, autoIndex: true })
export class StudioRecord {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: String, required: true, enum: STUDIO_KINDS, index: true })
  kind: StudioKind;

  @Prop({ default: '', maxlength: 220 })
  title: string;

  @Prop({ default: '' })
  status: string;

  @Prop({ default: '' })
  type: string;

  @Prop({ default: '', index: true })
  contactId: string;

  @Prop({ default: '', index: true })
  projectId: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 0 })
  amount: number;

  @Prop({ default: 'EUR' })
  currency: string;

  @Prop({ type: Date })
  date?: Date;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ default: false })
  archived: boolean;

  @Prop({ index: true, sparse: true })
  token?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  details: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const StudioRecordSchema = SchemaFactory.createForClass(StudioRecord);
StudioRecordSchema.index({ userId: 1, kind: 1, createdAt: -1 });
StudioRecordSchema.index(
  { userId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { kind: 'settings' } },
);
StudioRecordSchema.index({ kind: 1, token: 1 }, { unique: true, partialFilterExpression: { token: { $type: 'string' } } });
StudioRecordSchema.index({ userId: 1, kind: 1, email: 1 });
StudioRecordSchema.index({userId:1,kind:1,'details.sourceQuoteId':1},{
  unique:true,partialFilterExpression:{kind:'invoices','details.sourceQuoteId':{$type:'string'}},
});
StudioRecordSchema.index(
  { userId: 1, kind: 1, 'details.siteSlug': 1, 'details.slug': 1 },
  { unique: true, partialFilterExpression: { kind: 'payment-links', 'details.slug': { $type: 'string' } } },
);
StudioRecordSchema.index(
  { userId: 1, kind: 1, 'details.sourcePaymentId': 1 },
  { unique: true, partialFilterExpression: { kind: 'projects', 'details.sourcePaymentId': { $type: 'string' } } },
);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionDownloadDeliveryDocument = HydratedDocument<CollectionDownloadDelivery>;
export type CollectionDownloadScope = 'single' | 'set' | 'favorites' | 'all';
export type CollectionDownloadDeliveryStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'expired';

@Schema({ timestamps: true, autoIndex: true, collection: 'collection_download_deliveries' })
export class CollectionDownloadDelivery {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true, index: true }) collectionId: string;
  @Prop({ required: true, trim: true, maxlength: 220 }) collectionName: string;
  @Prop({ required: true, trim: true, lowercase: true, index: true }) email: string;
  @Prop({ required: true, enum: ['single', 'set', 'favorites', 'all'] }) scope: CollectionDownloadScope;
  @Prop({ trim: true, maxlength: 180 }) setId?: string;
  @Prop({ type: [String], default: [] }) imageIds: string[];
  @Prop({ default: false }) preferThumbnails: boolean;
  @Prop({ required: true, unique: true, index: true }) token: string;
  @Prop({ required: true, enum: ['queued', 'processing', 'ready', 'failed', 'expired'], default: 'queued', index: true })
  status: CollectionDownloadDeliveryStatus;
  @Prop({ default: '', maxlength: 1600 }) fileUrl: string;
  @Prop({ required: true, trim: true, maxlength: 260 }) fileName: string;
  @Prop({ default: 0 }) fileCount: number;
  @Prop({ required: true, index: true }) expiresAt: Date;
  @Prop({ default: '', maxlength: 2000 }) lastError: string;
  @Prop() readyAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const CollectionDownloadDeliverySchema = SchemaFactory.createForClass(CollectionDownloadDelivery);
CollectionDownloadDeliverySchema.index({ status: 1, createdAt: 1 });
CollectionDownloadDeliverySchema.index({ status: 1, expiresAt: 1 });
CollectionDownloadDeliverySchema.index({ collectionId: 1, email: 1, createdAt: -1 });

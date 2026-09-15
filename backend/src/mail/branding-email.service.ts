import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DashboardSetting,
  DashboardSettingDocument,
  DashboardSettingType,
} from 'src/settings/entities/dashboard-setting.entity';
import { MailService, type GlobalMailAttachment } from './mail.service';
import {
  buildBrandedGalleryEmailHtml,
  type BrandingEmailData,
  type BrandingEmailPayload,
} from './email-layout';

export {
  buildBrandedGalleryEmailHtml,
  escapeBrandingEmailHtml,
  normalizeBlockOrder,
  EMAIL_BLOCK_IDS,
} from './email-layout';
export type {
  BrandingEmailBlockId,
  BrandingEmailData,
  BrandingEmailPayload,
  BrandingEmailPosition,
} from './email-layout';

@Injectable()
export class BrandingEmailService {
  constructor(
    @InjectModel(DashboardSetting.name)
    private readonly settingModel: Model<DashboardSettingDocument>,
    private readonly mailService: MailService,
  ) {}

  async loadBrandData(userId: string): Promise<BrandingEmailData> {
    const setting = await this.settingModel
      .findOne({ userId, type: DashboardSettingType.BRANDING, localId: 'branding' })
      .lean();
    return ((setting?.data ?? {}) as BrandingEmailData) || {};
  }

  senderName(brand: BrandingEmailData, fallback = 'Gallery sender') {
    return String(brand.brandText || brand.brandName || brand.name || fallback).trim().slice(0, 120) || fallback;
  }

  async send(payload: BrandingEmailPayload & {
    to: string | string[];
    subject: string;
    text?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: GlobalMailAttachment[];
  }) {
    const brand = await this.loadBrandData(payload.userId);
    const html = buildBrandedGalleryEmailHtml(payload, brand);
    return this.mailService.send({
      to: payload.to,
      ...(payload.cc ? { cc: payload.cc } : {}),
      ...(payload.bcc ? { bcc: payload.bcc } : {}),
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      subject: payload.subject,
      text: payload.text,
      html,
      fromName: this.senderName(brand),
      ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
    });
  }
}

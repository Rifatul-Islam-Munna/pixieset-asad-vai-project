import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { sanitizeEmailHtml } from './html-guard';

const LOGO_CID = 'gallery-logo';
const COVER_CID = 'gallery-cover';

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
    private readonly configService: ConfigService,
  ) {}

  async loadBrandData(userId: string): Promise<BrandingEmailData> {
    const setting = await this.settingModel
      .findOne({ userId, type: DashboardSettingType.BRANDING, localId: 'branding' })
      .lean();
    return ((setting?.data ?? {}) as BrandingEmailData) || {};
  }

  /** Uploaded assets are stored as `/uploads/...` and must become absolute. */
  private absoluteAssetUrl(value: string) {
    if (!value) return '';
    if (/^(https?:\/\/|data:image\/)/i.test(value)) return value;
    if (!value.startsWith('/')) return '';
    const base = String(
      this.configService.get<string>('PUBLIC_BASE_URL') ||
        this.configService.get<string>('NEXT_PUBLIC_BASE_URL') ||
        this.configService.get<string>('FRONTEND_URL') ||
        this.configService.get<string>('PUBLIC_API_URL') ||
        '',
    ).replace(/\/$/, '');
    return base ? `${base}${value}` : '';
  }

  senderName(brand: BrandingEmailData, fallback = 'Gallery sender') {
    return String(brand.brandText || brand.brandName || brand.name || fallback).trim().slice(0, 120) || fallback;
  }

  /**
   * Attaches the studio logo and hero image as CID parts and rewrites the HTML
   * to `cid:` sources. Email clients block `data:` images, and shipping base64
   * inside the body is what broke previously delivered emails.
   */
  async renderWithInlineAssets(payload: BrandingEmailPayload, brand: BrandingEmailData) {
    const attachments: GlobalMailAttachment[] = [];
    const resolve = async (value: unknown, cid: string) => {
      const url = this.absoluteAssetUrl(String(value ?? '').trim());
      if (!url) return '';
      const attachment = await this.mailService
        .fetchInlineImage(url, cid, cid)
        .catch(() => undefined);
      if (!attachment) return '';
      attachments.push(attachment);
      return `cid:${cid}`;
    };

    const logoSrc = await resolve(String(brand.logoUrl || brand.logo || ''), LOGO_CID);
    const imageSrc = await resolve(payload.imageUrl, COVER_CID);
    const html = buildBrandedGalleryEmailHtml(
      { ...payload, ...(imageSrc ? { imageUrl: imageSrc } : {}) },
      { ...brand, logoUrl: logoSrc, logo: undefined, brandImageUrl: undefined },
    );
    return { html: sanitizeEmailHtml(html), attachments };
  }

  /** Single entry point used by every backend email flow. */
  async sendBranded(
    payload: BrandingEmailPayload & {
      to: string | string[];
      subject: string;
      text?: string;
      cc?: string | string[];
      bcc?: string | string[];
      replyTo?: string;
    },
  ) {
    const brand = await this.loadBrandData(payload.userId);
    const { html, attachments } = await this.renderWithInlineAssets(payload, brand);
    return this.mailService.send({
      to: payload.to,
      ...(payload.cc ? { cc: payload.cc } : {}),
      ...(payload.bcc ? { bcc: payload.bcc } : {}),
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      subject: payload.subject,
      text: payload.text,
      html,
      fromName: this.senderName(brand),
      ...(attachments.length ? { attachments } : {}),
    });
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
    const { html, attachments } = await this.renderWithInlineAssets(payload, brand);
    return this.mailService.send({
      to: payload.to,
      ...(payload.cc ? { cc: payload.cc } : {}),
      ...(payload.bcc ? { bcc: payload.bcc } : {}),
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      subject: payload.subject,
      text: payload.text,
      html,
      fromName: this.senderName(brand),
      attachments: [...(payload.attachments ?? []), ...attachments],
    });
  }
}

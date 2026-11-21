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

/** From display name for a user: explicit override → brand name → undefined. */
export function resolveSenderName(
  override?: string,
  brand?: BrandingEmailData | null,
): string | undefined {
  const explicit = String(override ?? '').trim().slice(0, 120);
  if (explicit) return explicit;
  const name = String(
    brand?.brandText || brand?.brandName || brand?.name || '',
  )
    .trim()
    .slice(0, 120);
  return name || undefined;
}

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

  /** Resolve stored public assets against the host that actually serves them. */
  private absoluteAssetUrl(value: string) {
    if (!value) return '';
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const parsed = new URL(value);
      if (!parsed.pathname.startsWith('/uploads/')) return value;
      const apiBase = String(
        this.configService.get<string>('PUBLIC_API_URL') ||
        (this.configService.get<string>('NODE_ENV') === 'production'
          ? 'https://ai-photo-book-moment-backend.wrtsxa.easypanel.host'
          : 'http://localhost:4000'),
      ).trim();
      return apiBase.replace(/\/$/, '') + parsed.pathname + parsed.search;
    }
    if (!value.startsWith('/')) return '';
    const backendUpload = value.startsWith('/uploads/');
    const base = String(
      backendUpload
        ? this.configService.get<string>('PUBLIC_API_URL') ||
          (this.configService.get<string>('NODE_ENV') === 'production'
            ? 'https://ai-photo-book-moment-backend.wrtsxa.easypanel.host'
            : 'http://localhost:4000')
        : this.configService.get<string>('FRONTEND_URL') ||
          this.configService.get<string>('PUBLIC_BASE_URL') ||
          this.configService.get<string>('NEXT_PUBLIC_BASE_URL') ||
          '',
    ).replace(/\/$/, '');
    return base ? `${base}${value}` : '';
  }

  senderName(brand: BrandingEmailData, fallback = 'Gallery sender') {
    return String(brand.brandText || brand.brandName || brand.name || fallback).trim().slice(0, 120) || fallback;
  }

  /**
   * Keeps public HTTPS studio logos as normal image URLs, which Gmail renders
   * more reliably than a CID logo. Data-URI logos and cover images can still
   * use CID attachments; base64 is never embedded directly in the HTML body.
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

    const logoUrl = this.absoluteAssetUrl(String(brand.logoUrl || brand.logo || brand.brandImageUrl || '').trim());
    // Gmail is more reliable with a public HTTPS logo URL than a CID image part.
    // Keep CID handling only for data-URI logos, which email clients cannot load directly.
    const logoSrc = logoUrl.startsWith('data:image/') ? await resolve(logoUrl, LOGO_CID) : logoUrl;
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

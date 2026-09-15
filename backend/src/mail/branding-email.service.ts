import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DashboardSetting,
  DashboardSettingDocument,
  DashboardSettingType,
} from 'src/settings/entities/dashboard-setting.entity';
import { MailService, type GlobalMailAttachment } from './mail.service';

export type BrandingEmailPosition = 'top' | 'bottom';

export type BrandingEmailPayload = {
  userId: string;
  previewText?: string;
  eyebrowText?: string;
  title: string;
  message?: string;
  buttonText: string;
  buttonLink: string;
  buttonColor?: string;
  useBrandColor?: boolean;
  footerText?: string;
  imageUrl?: string;
  showImage?: boolean;
  showBranding?: boolean;
  brandingPosition?: BrandingEmailPosition;
};

export type BrandingEmailData = Record<string, any>;

const DEFAULT_BUTTON_COLOR = '#1f2937';

export function escapeBrandingEmailHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function emailLines(value: string) {
  return escapeBrandingEmailHtml(value).replace(/\r?\n/g, '<br>');
}

/**
 * Renders the exact same email layout as the frontend preview builder
 * (frontend/lib/gallery-email.ts -> buildGalleryEmailHtml) so the inbox
 * output is pixel-identical to what the user designed in the dashboard.
 */
export function buildBrandedGalleryEmailHtml(input: BrandingEmailPayload, brand: BrandingEmailData) {
  const showBranding = input.showBranding !== false;
  const showImage = input.showImage !== false;
  const brandingPosition: BrandingEmailPosition =
    input.brandingPosition === 'bottom' || brand.brandingPosition === 'bottom' ? 'bottom' : 'top';
  const logo = showBranding ? String(brand.logoUrl || brand.logo || '').trim() : '';
  const brandText = showBranding ? String(brand.brandText || brand.brandName || brand.name || '').trim() : '';
  const image = showImage ? String(input.imageUrl ?? '').trim() : '';
  const eyebrow = String(input.eyebrowText ?? '').trim();
  const previewText = String(input.previewText ?? '').trim();
  const title = String(input.title || 'Your photos').trim();
  const message = String(input.message ?? '').trim();
  const buttonText = String(input.buttonText || 'View Gallery').trim();
  const buttonLink = String(input.buttonLink || '#').trim();
  const accentColor = /^#[0-9a-f]{6}$/i.test(String(brand.accentColor || brand.buttonColor || ''))
    ? String(brand.accentColor || brand.buttonColor)
    : '';
  const useBrandColor = input.useBrandColor !== false;
  const buttonColor = useBrandColor
    ? (accentColor || (/^#[0-9a-f]{6}$/i.test(String(input.buttonColor || '')) ? String(input.buttonColor) : DEFAULT_BUTTON_COLOR))
    : (/^#[0-9a-f]{6}$/i.test(String(input.buttonColor || '')) ? String(input.buttonColor) : DEFAULT_BUTTON_COLOR);
  const footerText = String(input.footerText ?? '').trim();

  const brandingBlock =
    logo || brandText
      ? `<tr>
          <td align="center" style="padding:38px 36px 0">
            ${logo ? `<img src="${escapeBrandingEmailHtml(logo)}" alt="${escapeBrandingEmailHtml(brandText)}" style="display:block;width:auto;max-width:180px;max-height:56px;margin:0 auto;border:0;outline:none;text-decoration:none">` : ''}
            ${brandText ? `<div style="margin-top:${logo ? '16px' : '0'};font-size:11px;line-height:18px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#565656">${escapeBrandingEmailHtml(brandText)}</div>` : ''}
          </td>
        </tr>`
      : '';

  const imageBlock = image
    ? `<tr>
        <td style="padding:0">
          <img src="${escapeBrandingEmailHtml(image)}" alt="" width="680" style="display:block;width:100%;height:auto;max-height:520px;object-fit:cover;border:0;outline:none;text-decoration:none">
        </td>
      </tr>`
    : '';

  const headBlock = `
            <tr>
              <td align="center" style="padding:${brandingBlock ? '26px' : '42px'} 36px 38px">
                ${eyebrow ? `<div style="margin:0 0 16px;font-size:10px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#96918b">${escapeBrandingEmailHtml(eyebrow)}</div>` : ''}
                <h1 style="margin:0;font-size:28px;line-height:38px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:#2f2f2f">${escapeBrandingEmailHtml(title)}</h1>
              </td>
            </tr>`;

  const bodyBlock = `
            <tr>
              <td align="center" style="padding:42px 42px 36px">
                ${message ? `<div style="max-width:520px;margin:0 auto;font-size:15px;line-height:27px;color:#585858;text-align:left">${emailLines(message)}</div>` : ''}
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:${message ? '30px' : '0'} auto 0;border-collapse:collapse">
                  <tr>
                    <td align="center" bgcolor="${escapeBrandingEmailHtml(buttonColor)}" style="background:${escapeBrandingEmailHtml(buttonColor)}">
                      <a href="${escapeBrandingEmailHtml(buttonLink)}" style="display:inline-block;padding:15px 34px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeBrandingEmailHtml(buttonText)}</a>
                    </td>
                  </tr>
                </table>
                ${footerText ? `<div style="margin:34px 0 0;font-size:11px;line-height:19px;color:#7a7a7a">${emailLines(footerText)}</div>` : ''}
              </td>
            </tr>`;

  return `<div style="margin:0;background:#f3f2ef;padding:36px 16px;font-family:Arial,Helvetica,sans-serif;color:#202020">
    ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeBrandingEmailHtml(previewText)}</div>` : ''}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f3f2ef">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;border-collapse:collapse;background:#ffffff">
            ${brandingPosition === 'top' ? `${brandingBlock}${headBlock}` : headBlock}
            ${imageBlock}
            ${bodyBlock}
            ${brandingPosition === 'bottom' ? brandingBlock : ''}
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

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

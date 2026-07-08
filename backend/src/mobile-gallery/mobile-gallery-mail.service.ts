import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailService } from 'src/mail/mail.service';
import { MobileGalleryApp, MobileGalleryAppDocument } from './entities/mobile-gallery-app.entity';
import { MobileGallerySetting, MobileGallerySettingDocument } from './entities/mobile-gallery-setting.entity';

@Injectable()
export class MobileGalleryMailService {
  constructor(
    @InjectModel(MobileGalleryApp.name) private readonly appModel: Model<MobileGalleryAppDocument>,
    @InjectModel(MobileGallerySetting.name) private readonly settingModel: Model<MobileGallerySettingDocument>,
    private readonly mailService: MailService,
  ) {}

  async sendInvite(userId: string, appId: string, body: Record<string, any>) {
    const to = String(body.to ?? '').trim().toLowerCase();
    if (!this.isEmail(to)) throw new BadRequestException('A valid recipient email is required');

    const app = await this.appModel.findOne({ _id: appId, userId }).lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    if (app.status !== 'published') throw new BadRequestException('Publish the mobile gallery app before sharing it');

    const publicUrl = this.safeHttpUrl(String(body.link ?? ''));
    if (!publicUrl) throw new BadRequestException('A valid public gallery link is required');

    const profile = await this.settingModel.findOne({ userId }).lean();
    const subject = this.limitText(String(body.subject || `Your ${app.name} mobile app is ready!`), 180);
    const message = this.limitText(
      String(body.message || `Your ${app.name} mobile gallery app is ready to view and install.`),
      4000,
    );
    const templateTitle = this.limitText(String(body.templateTitle || 'Your Mobile Gallery App is Ready'), 180);
    const contactEmail = String(profile?.contactEmail || '').trim();
    const sendCopy = Boolean(body.sendCopy && this.isEmail(contactEmail) && contactEmail.toLowerCase() !== to);

    const result = await this.mailService.send({
      to,
      ...(sendCopy ? { cc: contactEmail } : {}),
      ...(this.isEmail(contactEmail) ? { replyTo: contactEmail } : {}),
      subject,
      text: `${message}\n\nOpen your gallery: ${publicUrl}`,
      html: this.inviteHtml({
        appName: app.name,
        templateTitle,
        message,
        publicUrl,
        iconUrl: this.safeHttpUrl(String(app.iconUrl || app.coverImage || '')),
        brandLogoUrl: this.safeHttpUrl(String(profile?.logoUrl || '')),
        footer: profile?.website || contactEmail || '',
      }),
    });

    return result;
  }

  private inviteHtml(input: {
    appName: string;
    templateTitle: string;
    message: string;
    publicUrl: string;
    iconUrl: string;
    brandLogoUrl: string;
    footer: string;
  }) {
    const brandLogo = input.brandLogoUrl
      ? `<img src="${this.escapeAttribute(input.brandLogoUrl)}" alt="Business logo" style="display:block;max-width:180px;max-height:52px;object-fit:contain;margin:0 auto 24px;" />`
      : '';
    const icon = input.iconUrl
      ? `<img src="${this.escapeAttribute(input.iconUrl)}" alt="" width="136" height="136" style="display:block;width:136px;height:136px;object-fit:cover;border-radius:28px;margin:0 auto 22px;" />`
      : '';

    return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#222;">
    <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #ececea;">
        <div style="padding:42px 28px;text-align:center;border-bottom:1px solid #eee;">
          ${brandLogo}
          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#777;">Mobile Gallery</div>
          <h1 style="font-size:31px;font-weight:400;line-height:1.25;margin:22px 0 0;">${this.escapeHtml(input.templateTitle)}</h1>
        </div>
        <div style="padding:42px 28px;text-align:center;">
          ${icon}
          <div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:24px;">${this.escapeHtml(input.appName)}</div>
          <p style="font-size:15px;line-height:1.8;color:#666;white-space:pre-line;margin:0 auto 30px;max-width:470px;">${this.escapeHtml(input.message)}</p>
          <a href="${this.escapeAttribute(input.publicUrl)}" style="display:inline-block;background:#18bfa6;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;">Install App</a>
        </div>
      </div>
      ${input.footer ? `<p style="text-align:center;color:#999;font-size:12px;margin:18px 0 0;">${this.escapeHtml(input.footer)}</p>` : ''}
    </div>
  </body>
</html>`;
  }

  private isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private safeHttpUrl(value: string) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch {
      return '';
    }
  }

  private limitText(value: string, max: number) {
    return value.trim().slice(0, max);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeAttribute(value: string) {
    return this.escapeHtml(value);
  }
}

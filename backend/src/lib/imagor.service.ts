import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export type ImagorWatermark = {
  type: 'text' | 'image';
  text?: string;
  font?: string;
  color?: string;
  scale?: number;
  opacity?: number;
  position?: { x?: number; y?: number };
  image?: string;
};

type VariantOptions = {
  width: number;
  height: number;
  quality: number;
};

@Injectable()
export class ImagorService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled() {
    return Boolean(this.baseUrl() && (this.secret() || this.unsafeEnabled()));
  }

  hasWatermark(watermark?: ImagorWatermark | null) {    if (!watermark) return false;
    if (watermark.type === 'image') {
      return Boolean(String(watermark.image ?? '').trim());
    }
    return Boolean(String(watermark.text ?? '').trim());
  }

  imageUrls(objectKey: string, watermark?: ImagorWatermark | null) {
    if (!this.isEnabled()) return null;
    const build = (variant: VariantOptions) =>
      this.buildUrl(objectKey, variant, watermark);
    return {
      thumbnailUrl: build({
        width: this.numberSetting('IMAGOR_GRID_WIDTH', 720, 240, 1600),
        height: this.numberSetting('IMAGOR_GRID_HEIGHT', 720, 240, 1600),
        quality: this.numberSetting('IMAGOR_GRID_QUALITY', 76, 40, 95),
      }),
      url: build({
        width: this.numberSetting('IMAGOR_VIEW_WIDTH', 2560, 1280, 5000),
        height: this.numberSetting('IMAGOR_VIEW_HEIGHT', 2560, 1280, 5000),
        quality: this.numberSetting('IMAGOR_VIEW_QUALITY', 84, 50, 100),
      }),
      responsive: {
        small: build({ width: 480, height: 480, quality: 72 }),
        medium: build({ width: 960, height: 960, quality: 76 }),
        large: build({ width: 1600, height: 1600, quality: 80 }),
      },
    };
  }
  private buildUrl(
    objectKey: string,
    variant: VariantOptions,
    watermark?: ImagorWatermark | null,
  ) {
    const filters = [`quality(${variant.quality})`, 'strip_exif()'];
    const watermarkFilter = this.watermarkFilter(watermark, variant);
    if (watermarkFilter) filters.push(watermarkFilter);

    const imagePath = this.objectKeyPath(objectKey);
    const path = [
      'fit-in',
      `${variant.width}x${variant.height}`,
      `filters:${filters.join(':')}`,
      imagePath,
    ].join('/');

    return `${this.baseUrl()}/${this.signPath(path)}`;
  }

  private watermarkFilter(
    watermark: ImagorWatermark | null | undefined,
    variant: VariantOptions,
  ) {
    if (!this.hasWatermark(watermark)) return '';

    const layout = this.watermarkLayout(watermark!);
    const alpha = 100 - this.percent(watermark?.opacity, 90);

    if (watermark?.type === 'image') {
      const source = this.watermarkImageSource(String(watermark.image ?? ''));
      if (!source) return '';
      const ratio = layout.widthPct;
      const x = this.percentToken(layout.x - ratio / 2);
      const y = this.percentToken(layout.y - layout.heightPct / 2);
      return `watermark(${source},${x},${y},${alpha},${ratio},${layout.heightPct})`;
    }

    const text = String(watermark?.text ?? '').trim();
    if (!text) return '';
    const encodedText = `b64:${Buffer.from(text, 'utf8').toString('base64url')}`;
    const color = this.safeColor(watermark?.color);
    const fontSize = Math.max(
      12,
      Math.round(
        Math.min(variant.width, variant.height) *
          (layout.fontPct / 100),
      ),
    );
    const font = this.safeFont(watermark?.font, fontSize);
    const x = this.percentToken(layout.x - layout.widthPct / 2);
    const y = this.percentToken(layout.y - layout.heightPct / 2);
    return `text(${encodedText},${x},${y},${font},${color},${alpha},,${layout.widthPct}p,center,0,none,0,72)`;
  }

  private watermarkLayout(watermark: ImagorWatermark) {
    const scale = this.clamp(Number(watermark.scale ?? 42), 5, 100);
    const text = String(watermark.text ?? 'Watermark');
    const isImage = watermark.type === 'image';
    const fontPct = this.clamp(scale * 0.12, 1.8, 12);
    const widthPct = isImage
      ? this.clamp(scale * 0.28, 4, 32)
      : this.clamp(text.length * fontPct * 0.55, 8, 90);
    const heightPct = isImage
      ? widthPct
      : this.clamp(fontPct * 1.5, 3, 20);
    const rawX = Number(watermark.position?.x ?? 15);
    const rawY = Number(watermark.position?.y ?? 85);
    const x = this.clamp(rawX, widthPct / 2, 100 - widthPct / 2);
    const y = this.clamp(rawY, heightPct / 2, 100 - heightPct / 2);
    return { x, y, widthPct, heightPct, fontPct };
  }

  private percentToken(value: number) {
    return `${this.clamp(value, 0, 100).toFixed(2)}p`;
  }
  private watermarkImageSource(value: string) {
    const raw = value.trim();
    if (!raw) return '';

    if (/^https?:\/\//i.test(raw)) {
      return `b64:${Buffer.from(raw, 'utf8').toString('base64url')}`;
    }

    if (raw.startsWith('/')) {
      const publicApi = this.publicApiUrl();
      if (!publicApi) return '';
      const absolute = `${publicApi}${raw}`;
      return `b64:${Buffer.from(absolute, 'utf8').toString('base64url')}`;
    }

    if (
      raw.startsWith('private-direct/') ||
      raw.startsWith('originals/') ||
      raw.startsWith('direct/')
    ) {
      return this.objectKeyPath(raw);
    }

    return `b64:${Buffer.from(raw, 'utf8').toString('base64url')}`;
  }

  private objectKeyPath(objectKey: string) {
    return String(objectKey || '')      .trim()
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');
  }

  private signPath(path: string) {
    if (this.unsafeEnabled()) return `unsafe/${path}`;

    const secret = this.secret();
    if (!secret) return `unsafe/${path}`;

    const signerType = this.signerType();
    let signature = createHmac(signerType, secret)
      .update(path)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const truncate = this.numberSetting('IMAGOR_SIGNER_TRUNCATE', 40, 0, 128);
    if (truncate > 0) signature = signature.slice(0, truncate);
    return `${signature}/${path}`;
  }

  private signerType(): 'sha1' | 'sha256' | 'sha512' {
    const raw = String(
      this.configService.get<string>('IMAGOR_SIGNER_TYPE') || 'sha256',    )
      .trim()
      .toLowerCase();
    if (raw === 'sha1' || raw === 'sha512') return raw;
    return 'sha256';
  }

  private safeFont(font: string | undefined, size: number) {
    const family = String(font || 'sans')
      .trim()
      .replace(/[^a-z0-9 _-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return `${family || 'sans'}-${size}`;
  }

  private safeColor(value?: string) {
    const raw = String(value || '#ffffff').trim().replace(/^#/, '');
    return /^[0-9a-f]{6}$/i.test(raw) ? raw : 'ffffff';
  }

  private percent(value: number | undefined, fallback: number) {
    return this.clamp(Math.round(Number(value ?? fallback)), 0, 100);
  }

  private publicApiUrl() {
    return String(
      this.configService.get<string>('PUBLIC_API_URL') ||
        this.configService.get<string>('PUBLIC_BASE_URL') ||
        this.configService.get<string>('BASE_URL') ||        '',
    )
      .trim()
      .replace(/\/+$/, '');
  }

  private baseUrl() {
    return String(this.configService.get<string>('IMAGOR_URL') || '')
      .trim()
      .replace(/\/+$/, '');
  }

  private secret() {
    return String(this.configService.get<string>('IMAGOR_SECRET') || '').trim();
  }

  private unsafeEnabled() {
    const raw = String(
      this.configService.get<string>('IMAGOR_UNSAFE') || '',
    )
      .trim()
      .toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(raw);
  }

  private numberSetting(
    key: string,
    fallback: number,
    min: number,
    max: number,  ) {
    const value = Number(this.configService.get<string>(key));
    return Math.round(
      this.clamp(Number.isFinite(value) ? value : fallback, min, max),
    );
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}

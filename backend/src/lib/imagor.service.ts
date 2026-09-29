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

type SourceDimensions = {
  width?: number;
  height?: number;
};

@Injectable()
export class ImagorService {
  private readonly dimensionCache = new Map<
    string,
    { width: number; height: number }
  >();
  private readonly dimensionInFlight = new Map<
    string,
    Promise<{ width: number; height: number } | undefined>
  >();

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

  async resolveSourceDimensions(
    objectKey: string,
    known?: SourceDimensions,
  ) {
    const knownWidth = Number(known?.width);
    const knownHeight = Number(known?.height);
    if (
      Number.isFinite(knownWidth) &&
      Number.isFinite(knownHeight) &&
      knownWidth > 0 &&
      knownHeight > 0
    ) {
      return { width: knownWidth, height: knownHeight };
    }

    const key = String(objectKey || '').trim();
    if (!key || !this.isEnabled()) return undefined;

    const cached = this.dimensionCache.get(key);
    if (cached) return cached;

    const running = this.dimensionInFlight.get(key);
    if (running) return running;

    const task = this.fetchSourceDimensions(key).finally(() => {
      this.dimensionInFlight.delete(key);
    });
    this.dimensionInFlight.set(key, task);
    return task;
  }

  watermarkPreviewUrl(watermark?: ImagorWatermark | null) {
    if (!this.isEnabled()) return null;

    const variant: VariantOptions = {
      width: 1400,
      height: 933,
      quality: 100,
    };
    const filters = ['format(png)'];
    const watermarkFilter = this.watermarkFilter(watermark, variant, {
      width: variant.width,
      height: variant.height,
    });
    if (watermarkFilter) filters.push(watermarkFilter);
    filters.push('preview()');

    // The editor overlays this transparent Imagor-rendered layer on its sample
    // photo. This means the visible preview watermark is rendered by the same
    // Pango/libvips pipeline as production, not approximated with browser text.
    const path = [
      `${variant.width}x${variant.height}`,
      `filters:${filters.join(':')}`,
      'color:none',
    ].join('/');

    return `${this.baseUrl()}/${this.signPath(path)}`;
  }

  imageUrls(
    objectKey: string,
    watermark?: ImagorWatermark | null,
    source?: SourceDimensions,
  ) {
    if (!this.isEnabled()) return null;
    const build = (variant: VariantOptions) =>
      this.buildUrl(objectKey, variant, watermark, source);
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
    source?: SourceDimensions,
  ) {
    const filters = [`quality(${variant.quality})`, 'strip_exif()'];
    const watermarkFilter = this.watermarkFilter(watermark, variant, source);
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
    sourceDimensions?: SourceDimensions,
  ) {
    if (!this.hasWatermark(watermark)) return '';

    const output = this.fitInOutputSize(variant, sourceDimensions);
    const layout = this.watermarkLayout(watermark!);
    const alpha = 100 - this.percent(watermark?.opacity, 90);

    if (watermark?.type === 'image') {
      const source = this.watermarkImageSource(String(watermark.image ?? ''));
      if (!source) return '';

      const boxWidth = Math.max(
        1,
        Math.round(output.width * (layout.widthPct / 100)),
      );
      const boxHeight = Math.max(
        1,
        Math.round(output.height * (layout.heightPct / 100)),
      );
      const position = this.centeredPixelPosition(
        watermark.position,
        output,
        boxWidth,
        boxHeight,
      );

      return `watermark(${source},${position.left},${position.top},${alpha},${layout.widthPct.toFixed(2)},${layout.heightPct.toFixed(2)})`;
    }

    const text = String(watermark?.text ?? '').trim();
    if (!text) return '';

    // Imagor fit-in does not upscale by default, so font size must be based on
    // the actual post-resize canvas rather than the requested 2560/1600/etc box.
    const fontSize = Math.max(
      8,
      Math.round(output.width * (layout.fontPct / 100)),
    );
    const textBoxWidth = Math.max(
      fontSize,
      Math.round(output.width * (layout.widthPct / 100)),
    );
    const textBoxHeight = Math.max(1, Math.round(fontSize * 1.1));
    const position = this.centeredPixelPosition(
      watermark?.position,
      output,
      textBoxWidth,
      textBoxHeight,
    );

    const encodedText = `b64:${Buffer.from(text, 'utf8').toString('base64url')}`;
    const color = this.safeColor(watermark?.color);
    const font = this.safeFont(watermark?.font, fontSize);

    return `text(${encodedText},${position.left},${position.top},${font},${color},${alpha},,${textBoxWidth},center,0,none,0,72)`;
  }

  private watermarkLayout(watermark: ImagorWatermark) {
    const scale = this.clamp(Number(watermark.scale ?? 42), 10, 120);
    const text = String(watermark.text ?? 'Watermark');
    const isImage = watermark.type === 'image';

    // One scale model is used by both the editor preview and Imagor. A value
    // around 50 should look like a watermark, not headline-sized text.
    const fontPct = this.clamp(scale * 0.075, 1.2, 8.5);
    const widthPct = isImage
      ? this.clamp(scale * 0.28, 4, 34)
      : this.clamp(text.length * fontPct * 0.55, 8, 72);
    const heightPct = isImage
      ? widthPct
      : this.clamp(fontPct * 1.65, 2, 16);

    return { widthPct, heightPct, fontPct };
  }

  private fitInOutputSize(
    variant: VariantOptions,
    source?: SourceDimensions,
  ) {
    const sourceWidth = Number(source?.width);
    const sourceHeight = Number(source?.height);
    if (
      Number.isFinite(sourceWidth) &&
      Number.isFinite(sourceHeight) &&
      sourceWidth > 0 &&
      sourceHeight > 0
    ) {
      const ratio = Math.min(
        1,
        variant.width / sourceWidth,
        variant.height / sourceHeight,
      );
      return {
        width: Math.max(1, Math.round(sourceWidth * ratio)),
        height: Math.max(1, Math.round(sourceHeight * ratio)),
      };
    }

    return { width: variant.width, height: variant.height };
  }

  private centeredPixelPosition(
    position: ImagorWatermark['position'],
    output: { width: number; height: number },
    boxWidth: number,
    boxHeight: number,
  ) {
    const halfWidthPct = (boxWidth / output.width) * 50;
    const halfHeightPct = (boxHeight / output.height) * 50;
    const centerX = this.clamp(
      Number(position?.x ?? 15),
      halfWidthPct,
      100 - halfWidthPct,
    );
    const centerY = this.clamp(
      Number(position?.y ?? 85),
      halfHeightPct,
      100 - halfHeightPct,
    );

    return {
      left: Math.max(
        0,
        Math.round((centerX / 100) * output.width - boxWidth / 2),
      ),
      top: Math.max(
        0,
        Math.round((centerY / 100) * output.height - boxHeight / 2),
      ),
    };
  }
  private async fetchSourceDimensions(objectKey: string) {
    const imagePath = this.objectKeyPath(objectKey);
    if (!imagePath) return undefined;

    const path = `meta/${imagePath}`;
    const url = `${this.internalBaseUrl()}/${this.signPath(path)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return undefined;

      const payload = (await response.json()) as {
        width?: number;
        height?: number;
      };
      const width = Number(payload?.width);
      const height = Number(payload?.height);
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        return undefined;
      }

      const dimensions = {
        width: Math.round(width),
        height: Math.round(height),
      };
      this.dimensionCache.set(objectKey, dimensions);
      if (this.dimensionCache.size > 5000) {
        const firstKey = this.dimensionCache.keys().next().value;
        if (firstKey) this.dimensionCache.delete(firstKey);
      }
      return dimensions;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
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

  private internalBaseUrl() {
    return String(
      this.configService.get<string>('IMAGOR_INTERNAL_URL') || this.baseUrl(),
    )
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

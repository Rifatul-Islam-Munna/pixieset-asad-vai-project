import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MinioService } from './minio.service';
import {
  WatermarkRenderService,
  type WatermarkSpec,
} from './watermark-render.service';

export type ImgproxyWatermark = WatermarkSpec;

type VariantOptions = {
  width: number;
  height: number;
  quality: number;
};

@Injectable()
export class ImgproxyService {
  constructor(
    private readonly configService: ConfigService,
    private readonly minioService: MinioService,
    private readonly watermarkRenderService: WatermarkRenderService,
  ) {}
  isEnabled() {
    return Boolean(this.baseUrl());
  }

  hasWatermark(watermark?: ImgproxyWatermark) {
    return this.watermarkRenderService.hasWatermark(watermark);
  }

  imageUrls(objectKey: string, _watermark?: ImgproxyWatermark) {
    if (!this.isEnabled()) return null;
    const direct = (variant: VariantOptions) =>
      this.buildUrl(objectKey, variant);
    return {
      thumbnailUrl: direct({
        width: this.numberSetting('IMGPROXY_GRID_WIDTH', 720, 240, 1600),
        height: this.numberSetting('IMGPROXY_GRID_HEIGHT', 720, 240, 1600),
        quality: this.numberSetting('IMGPROXY_GRID_QUALITY', 76, 40, 95),
      }),
      url: direct({
        width: this.numberSetting('IMGPROXY_VIEW_WIDTH', 2560, 1280, 5000),
        height: this.numberSetting('IMGPROXY_VIEW_HEIGHT', 2560, 1280, 5000),
        quality: this.numberSetting('IMGPROXY_VIEW_QUALITY', 84, 50, 100),
      }),
      responsive: {
        small: direct({ width: 480, height: 480, quality: 72 }),
        medium: direct({ width: 960, height: 960, quality: 76 }),
        large: direct({ width: 1600, height: 1600, quality: 80 }),
      },
    };
  }

  watermarkUrl(sourceUrl: string, watermark?: ImgproxyWatermark) {
    return this.watermarkRenderService.wrap(sourceUrl, watermark);
  }

  prewarmWatermark(url: string) {
    this.watermarkRenderService.prewarm(url);
  }

  private buildUrl(
    objectKey: string,
    variant: VariantOptions,
  ) {
    const sourceUrl = this.minioService.imgproxySourceUrl(objectKey);
    const encodedSource = Buffer.from(sourceUrl, 'utf8').toString('base64url');
    const options = [
      `rs:fit:${variant.width}:${variant.height}:0:0`,
      `q:${variant.quality}`,
      'ar:1',
    ];
    const path = `/${options.join('/')}/${encodedSource}`;
    const signature = this.signature(path);
    return `${this.baseUrl()}/${signature}${path}`;
  }

  private signature(path: string) {
    const key = this.hexBuffer('IMGPROXY_KEY');
    const salt = this.hexBuffer('IMGPROXY_SALT');
    if (!key.length || !salt.length) return 'unsafe';
    return createHmac('sha256', key)
      .update(Buffer.concat([salt, Buffer.from(path)]))
      .digest('base64url');
  }

  private baseUrl() {
    return String(
      this.configService.get<string>('IMGPROXY_URL') ||
        this.configService.get<string>('IMGPROXY_BASE_URL') ||
        '',
    )
      .trim()
      .replace(/\/+$/, '');
  }

  private hexBuffer(key: string) {
    const raw = String(this.configService.get<string>(key) || '')
      .trim()
      .replace(/^0x/i, '');
    if (!raw || raw.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(raw)) {
      return Buffer.alloc(0);
    }
    return Buffer.from(raw, 'hex');
  }

  private numberSetting(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(this.configService.get<string>(key));
    return Math.round(
      this.clamp(Number.isFinite(parsed) ? parsed : fallback, min, max),
    );
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}

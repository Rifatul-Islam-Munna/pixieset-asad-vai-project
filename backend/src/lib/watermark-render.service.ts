import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  createHash,
  timingSafeEqual,
} from 'crypto';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { cwd } from 'process';
import sharp from 'sharp';

export type WatermarkSpec = {
  type: 'text' | 'image';
  text?: string;
  font?: string;
  color?: string;
  scale?: number;
  opacity?: number;
  position?: { x?: number; y?: number };
  image?: string;
};

type RenderPayload = {
  v: 1;
  source: string;
  watermark: WatermarkSpec;
};

type RenderResult = {
  buffer?: Buffer;
  contentType?: string;
  redirect?: string;
  cacheable: boolean;
};
type CacheEntry = {
  buffer: Buffer;
  contentType: string;
  bytes: number;
  expiresAt: number;
  usedAt: number;
};

type AssetCacheEntry = {
  buffer: Buffer;
  expiresAt: number;
};

type OverlayCacheEntry = {
  buffer: Buffer;
  width: number;
  height: number;
  expiresAt: number;
};

@Injectable()
export class WatermarkRenderService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<RenderResult>>();
  private readonly assetCache = new Map<string, AssetCacheEntry>();
  private readonly overlayCache = new Map<string, OverlayCacheEntry>();
  private readonly prewarmQueue: string[] = [];
  private readonly prewarmQueued = new Set<string>();
  private readonly failedUntil = new Map<string, number>();
  private cacheBytes = 0;
  private activeRenders = 0;
  private activePrewarms = 0;
  private prewarmPumpScheduled = false;

  constructor(private readonly configService: ConfigService) {}

  hasWatermark(watermark?: WatermarkSpec | null) {
    if (!watermark) return false;
    if (watermark.type === 'image') return Boolean(String(watermark.image ?? '').trim());
    return Boolean(String(watermark.text ?? '').trim());
  }

  wrap(sourceUrl: string, watermark?: WatermarkSpec | null) {
    if (!this.hasWatermark(watermark)) return sourceUrl;
    const payload = this.normalizePayload(sourceUrl, watermark!);
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.sign(body);
    return `${this.publicBaseUrl()}/public/media/watermark/${body}.${signature}`;
  }
  prewarm(url: string) {
    this.enqueueToken(this.tokenFromUrl(url));
  }

  async render(token: string): Promise<RenderResult> {
    const payload = this.parseToken(token);
    if (!payload) return { cacheable: false };
    if (!this.hasWatermark(payload.watermark)) {
      return { redirect: payload.source, cacheable: false };
    }
    if (!this.isAllowedSource(payload.source)) {
      return { cacheable: false };
    }

    const cached = this.getCached(token);
    if (cached) {
      return {
        buffer: cached.buffer,
        contentType: cached.contentType,
        cacheable: true,
      };
    }

    this.enqueueToken(token);
    return { redirect: payload.source, cacheable: false };
  }

  private enqueueToken(token: string) {
    if (!token || this.prewarmQueued.has(token) || this.cache.has(token)) return;
    const failedUntil = this.failedUntil.get(token) ?? 0;
    if (failedUntil > Date.now()) return;
    if (failedUntil) this.failedUntil.delete(token);
    if (this.prewarmQueue.length >= this.prewarmQueueMax()) return;
    this.prewarmQueued.add(token);
    this.prewarmQueue.push(token);
    this.schedulePrewarmPump();
  }

  private schedulePrewarmPump() {
    if (this.prewarmPumpScheduled) return;
    this.prewarmPumpScheduled = true;
    queueMicrotask(() => {
      this.prewarmPumpScheduled = false;
      this.pumpPrewarmQueue();
    });
  }

  private async renderForPrewarm(token: string) {
    const payload = this.parseToken(token);
    if (
      !payload ||
      !this.hasWatermark(payload.watermark) ||
      !this.isAllowedSource(payload.source) ||
      this.cache.has(token)
    ) {
      return;
    }

    const running = this.inFlight.get(token);
    if (running) {
      await running.catch(() => undefined);
      return;
    }
    if (this.activeRenders >= this.renderConcurrency()) return;

    const task = this.renderOnce(token, payload);
    this.inFlight.set(token, task);
    try {
      await task;
    } finally {
      this.inFlight.delete(token);
    }
  }
  private async renderOnce(
    token: string,
    payload: RenderPayload,
  ): Promise<RenderResult> {
    this.activeRenders += 1;
    try {
      const source = await this.fetchImage(payload.source);
      if (!source) {
        this.markFailed(token);
        return { redirect: payload.source, cacheable: false };
      }

      const rendered = await this.applyWatermark(
        source.buffer,
        source.contentType,
        payload.watermark,
      ).catch(() => null);

      if (!rendered) {
        this.markFailed(token);
        return { redirect: payload.source, cacheable: false };
      }

      this.failedUntil.delete(token);
      this.putCached(token, rendered.buffer, rendered.contentType);
      return {
        buffer: rendered.buffer,
        contentType: rendered.contentType,
        cacheable: true,
      };
    } finally {
      this.activeRenders = Math.max(0, this.activeRenders - 1);
    }
  }

  private async fetchImage(url: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs());
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*' },
      });
      if (!response.ok) return null;
      const contentType = String(response.headers.get('content-type') || 'image/jpeg');
      if (!contentType.startsWith('image/')) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > this.maxSourceBytes()) return null;
      return { buffer, contentType };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  private async applyWatermark(
    input: Buffer,
    contentType: string,
    watermark: WatermarkSpec,
  ) {
    const image = sharp(input, { failOn: 'none' }).timeout({
      seconds: Math.max(2, Math.ceil(this.renderTimeoutMs() / 1000)),
    });
    const meta = await image.metadata();
    const width = Math.max(1, Number(meta.width ?? 1200));
    const height = Math.max(1, Number(meta.height ?? 800));
    const position = watermark.position ?? { x: 15, y: 85 };
    const opacity = this.clamp(Number(watermark.opacity ?? 90) / 100, 0, 1);

    if (watermark.type === 'text') {
      const overlay = this.textOverlay(width, height, watermark, opacity);
      const result = await image
        .composite([{ input: overlay, left: 0, top: 0 }])
        .toBuffer({ resolveWithObject: true });
      return {
        buffer: result.data,
        contentType: this.contentTypeForFormat(result.info.format, contentType),
      };
    }

    const assetSource = String(watermark.image ?? '').trim();
    const asset = await this.watermarkAsset(assetSource);
    if (!asset) return null;
    const overlayWidth = Math.max(
      40,
      Math.round(
        width *
          (this.clamp(Number(watermark.scale ?? 42), 1, 100) / 100) *
          0.28,
      ),
    );
    const overlay = await this.watermarkOverlay(
      assetSource,
      asset,
      overlayWidth,
      opacity,
    );
    if (!overlay) return null;
    const left = this.positionPixel(position.x, width, overlay.width);
    const top = this.positionPixel(position.y, height, overlay.height);
    const result = await image
      .composite([{ input: overlay.buffer, left, top }])
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: result.data,
      contentType: this.contentTypeForFormat(result.info.format, contentType),
    };
  }

  private textOverlay(
    width: number,
    height: number,
    watermark: WatermarkSpec,
    opacity: number,
  ) {
    const text = this.escapeXml(String(watermark.text ?? 'Watermark'));
    const font = this.escapeXml(String(watermark.font ?? 'sans-serif'));
    const color = this.safeColor(watermark.color);
    const fontSize = Math.max(
      18,
      Math.round(
        width *
          (this.clamp(Number(watermark.scale ?? 42), 1, 100) / 100) *
          0.2,
      ),
    );
    const x = this.clamp(Number(watermark.position?.x ?? 15), 0, 100);
    const y = this.clamp(Number(watermark.position?.y ?? 85), 0, 100);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
      '<text x="' + x + '%" y="' + y + '%" text-anchor="middle" dominant-baseline="middle" ' +
      'font-family="' + font + '" font-size="' + fontSize + '" fill="' + color + '" fill-opacity="' + opacity + '">' +
      text + '</text></svg>';
    return Buffer.from(svg, 'utf8');
  }
  private async watermarkAsset(value: string) {
    const source = value.trim();
    if (!source) return null;
    const cached = this.assetCache.get(source);
    if (cached && cached.expiresAt > Date.now()) return cached.buffer;

    let buffer: Buffer | null = null;
    if (source.startsWith('/uploads/')) {
      const localPath = join(cwd(), source.replace(/^\/+/, ''));
      if (existsSync(localPath)) buffer = await readFile(localPath).catch(() => null);
    } else if (/^https?:\/\//i.test(source)) {
      const fetched = await this.fetchImage(source);
      buffer = fetched?.buffer ?? null;
    } else if (existsSync(source)) {
      buffer = await readFile(source).catch(() => null);
    }

    if (!buffer?.length) return null;
    this.assetCache.set(source, {
      buffer,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    if (this.assetCache.size > 64) {
      const first = this.assetCache.keys().next().value;
      if (first) this.assetCache.delete(first);
    }
    return buffer;
  }

  private async watermarkOverlay(
    source: string,
    asset: Buffer,
    width: number,
    opacity: number,
  ) {
    const key = [
      source,
      Math.max(1, Math.round(width)),
      this.clamp(opacity, 0, 1).toFixed(3),
    ].join('|');
    const cached = this.overlayCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached;
    if (cached) this.overlayCache.delete(key);

    const rendered = await sharp(asset, { failOn: 'none' })
      .timeout({
        seconds: Math.max(2, Math.ceil(this.renderTimeoutMs() / 1000)),
      })
      .resize({
        width: Math.max(1, Math.round(width)),
        withoutEnlargement: true,
      })
      .ensureAlpha(this.clamp(opacity, 0, 1))
      .toBuffer({ resolveWithObject: true });

    const entry: OverlayCacheEntry = {
      buffer: rendered.data,
      width: Math.max(1, Number(rendered.info.width ?? width)),
      height: Math.max(1, Number(rendered.info.height ?? width)),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    this.overlayCache.set(key, entry);
    if (this.overlayCache.size > 128) {
      const first = this.overlayCache.keys().next().value;
      if (first) this.overlayCache.delete(first);
    }
    return entry;
  }
  private normalizePayload(source: string, watermark: WatermarkSpec): RenderPayload {
    return {
      v: 1,
      source,
      watermark: {
        type: watermark.type,
        text: String(watermark.text ?? '').slice(0, 240),
        font: String(watermark.font ?? 'sans-serif').slice(0, 80),
        color: this.safeColor(watermark.color),
        scale: this.clamp(Number(watermark.scale ?? 42), 1, 100),
        opacity: this.clamp(Number(watermark.opacity ?? 90), 0, 100),
        position: {
          x: this.clamp(Number(watermark.position?.x ?? 15), 0, 100),
          y: this.clamp(Number(watermark.position?.y ?? 85), 0, 100),
        },
        image: watermark.type === 'image' ? String(watermark.image ?? '').slice(0, 1200) : '',
      },
    };
  }

  private parseToken(token: string): RenderPayload | null {
    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;
    const body = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    if (!this.safeEqual(signature, this.sign(body))) return null;
    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as RenderPayload;
      return parsed?.v === 1 && typeof parsed.source === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }
  private sign(body: string) {
    return createHmac('sha256', this.signingSecret())
      .update(body)
      .digest('base64url');
  }

  private safeEqual(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private signingSecret() {
    const configured = String(
      this.configService.get<string>('WATERMARK_RENDER_SECRET') ||
        this.configService.get<string>('ACCESS_TOKEN') ||
        this.configService.get<string>('IMGPROXY_KEY') ||
        'change-me-watermark-secret',
    );
    return createHash('sha256').update(configured).digest();
  }

  private tokenFromUrl(url: string) {
    const marker = '/public/media/watermark/';
    const index = url.indexOf(marker);
    return index >= 0 ? url.slice(index + marker.length).split(/[?#]/)[0] : '';
  }

  private isAllowedSource(url: string) {
    const base = String(
      this.configService.get<string>('IMGPROXY_URL') ||
        this.configService.get<string>('IMGPROXY_BASE_URL') ||
        '',
    ).replace(/\/+$/, '');
    return Boolean(base && url.startsWith(`${base}/`));
  }
  private publicBaseUrl() {
    return String(
      this.configService.get<string>('PUBLIC_API_URL') ||
        this.configService.get<string>('PUBLIC_BASE_URL') ||
        this.configService.get<string>('BASE_URL') ||
        '',
    ).replace(/\/$/, '');
  }

  private getCached(token: string) {
    const cached = this.cache.get(token);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(token);
      this.cacheBytes = Math.max(0, this.cacheBytes - cached.bytes);
      return null;
    }
    cached.usedAt = Date.now();
    return cached;
  }

  private putCached(token: string, buffer: Buffer, contentType: string) {
    const bytes = buffer.length;
    if (!bytes || bytes > this.cacheMaxBytes()) return;
    this.cache.set(token, {
      buffer,
      contentType,
      bytes,
      expiresAt: Date.now() + this.cacheTtlMs(),
      usedAt: Date.now(),
    });
    this.cacheBytes += bytes;
    this.trimCache();
  }
  private trimCache() {
    const max = this.cacheMaxBytes();
    if (this.cacheBytes <= max) return;
    const entries = [...this.cache.entries()].sort(
      (a, b) => a[1].usedAt - b[1].usedAt,
    );
    for (const [key, entry] of entries) {
      this.cache.delete(key);
      this.cacheBytes = Math.max(0, this.cacheBytes - entry.bytes);
      if (this.cacheBytes <= max) break;
    }
  }

  private markFailed(token: string) {
    this.failedUntil.set(token, Date.now() + this.failureCooldownMs());
    if (this.failedUntil.size > 5000) {
      const now = Date.now();
      for (const [key, until] of this.failedUntil) {
        if (until <= now) this.failedUntil.delete(key);
        if (this.failedUntil.size <= 4000) break;
      }
    }
  }

  private pumpPrewarmQueue() {
    const limit = this.prewarmConcurrency();
    while (this.activePrewarms < limit && this.prewarmQueue.length) {
      const token = this.prewarmQueue.shift();
      if (!token) break;
      this.prewarmQueued.delete(token);
      this.activePrewarms += 1;
      void this.renderForPrewarm(token)
        .catch(() => undefined)
        .finally(() => {
          this.activePrewarms = Math.max(0, this.activePrewarms - 1);
          this.pumpPrewarmQueue();
        });
    }
  }

  private positionPixel(percent: number | undefined, size: number, overlay: number) {
    const center = (this.clamp(Number(percent ?? 50), 0, 100) / 100) * size;
    return Math.max(0, Math.min(size - overlay, Math.round(center - overlay / 2)));
  }
  private contentTypeForFormat(format: string, fallback: string) {
    if (format === 'jpeg' || format === 'jpg') return 'image/jpeg';
    if (format === 'png') return 'image/png';
    if (format === 'webp') return 'image/webp';
    if (format === 'avif' || format === 'heif') return 'image/avif';
    if (format === 'gif') return 'image/gif';
    return fallback.startsWith('image/') ? fallback : 'image/jpeg';
  }

  private safeColor(value?: string) {
    const raw = String(value || '#ffffff').trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw : '#ffffff';
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  }

  private numberSetting(key: string, fallback: number, min: number, max: number) {
    const value = Number(this.configService.get<string>(key));
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
  }
  private renderConcurrency() {
    return Math.floor(
      this.numberSetting('WATERMARK_RENDER_CONCURRENCY', 2, 1, 4),
    );
  }

  private prewarmConcurrency() {
    return Math.floor(
      this.numberSetting('WATERMARK_PREWARM_CONCURRENCY', 1, 1, 2),
    );
  }

  private prewarmQueueMax() {
    return Math.floor(this.numberSetting('WATERMARK_PREWARM_QUEUE_MAX', 5000, 100, 20000));
  }

  private fetchTimeoutMs() {
    return this.numberSetting('WATERMARK_FETCH_TIMEOUT_MS', 6000, 1000, 15000);
  }

  private renderTimeoutMs() {
    return this.numberSetting('WATERMARK_RENDER_TIMEOUT_MS', 6000, 1000, 15000);
  }

  private maxSourceBytes() {
    return Math.floor(this.numberSetting('WATERMARK_MAX_SOURCE_BYTES', 16 * 1024 * 1024, 1024 * 1024, 64 * 1024 * 1024));
  }

  private cacheTtlMs() {
    return this.numberSetting(
      'WATERMARK_CACHE_TTL_MS',
      60 * 60 * 1000,
      60_000,
      24 * 60 * 60 * 1000,
    );
  }

  private failureCooldownMs() {
    return this.numberSetting(
      'WATERMARK_FAILURE_COOLDOWN_MS',
      5 * 60 * 1000,
      30_000,
      60 * 60 * 1000,
    );
  }

  private cacheMaxBytes() {
    const mb = this.numberSetting('WATERMARK_CACHE_MAX_MB', 128, 16, 512);
    return Math.floor(mb * 1024 * 1024);
  }
}
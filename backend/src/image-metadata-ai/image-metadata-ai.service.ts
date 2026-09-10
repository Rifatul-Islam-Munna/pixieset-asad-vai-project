import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import { MinioService } from 'src/lib/minio.service';
import { User, UserDocument } from 'src/user/entities/user.entity';
import {
  CollectionImage,
  CollectionImageDocument,
} from 'src/collections/entities/collection-image.entity';
import {
  ImageMetadataJob,
  ImageMetadataJobDocument,
} from './entities/image-metadata-job.entity';
import {
  ImageMetadataWorkerLock,
  ImageMetadataWorkerLockDocument,
} from './entities/image-metadata-worker-lock.entity';

const LOCK_KEY = 'gemini-image-metadata';
const LOCK_LEASE_MS = 90_000;
const API_GAP_MS = 1_500;
const IDLE_BACKOFF_MS = 15_000;
const DIRECT_AI_IMAGE_MAX_BYTES = 1_500_000;
const MAX_ATTEMPTS = 5;

const summarySchema = z.object({
  title: z.string().min(2).max(100),
  caption: z.string().min(4).max(280),
  genre: z.string().max(60),
  objectName: z.string().max(120),
  cityCountry: z.string().max(120),
  keywords: z.array(z.string().max(40)).max(10),
});

type QueueableImage = {
  _id?: unknown;
  userId?: string;
  collectionId?: string;
  mediaType?: string;
};

@Injectable()
export class ImageMetadataAiService implements OnModuleInit {
  private readonly logger = new Logger(ImageMetadataAiService.name);
  private readonly workerId = randomUUID();
  private processing = false;
  private idleUntil = 0;

  constructor(
    @InjectModel(ImageMetadataJob.name)
    private readonly jobModel: Model<ImageMetadataJobDocument>,
    @InjectModel(ImageMetadataWorkerLock.name)
    private readonly lockModel: Model<ImageMetadataWorkerLockDocument>,
    @InjectModel(CollectionImage.name)
    private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.lockModel
      .updateOne(
        { key: LOCK_KEY },
        { $setOnInsert: { key: LOCK_KEY, ownerId: '', lockedUntil: new Date(0) } },
        { upsert: true },
      )
      .catch((error: any) => {
        if (error?.code !== 11000) throw error;
      });

    if (!this.apiKey()) {
      this.logger.warn(
        'GEMINI_API_KEY is not set; image AI metadata jobs will stay queued.',
      );
    } else {
      await this.requeueRetiredModelFailures();
    }
  }

  private async requeueRetiredModelFailures() {
    const now = new Date();
    const result = await this.jobModel.updateMany(
      {
        status: 'failed',
        lastError: /gemini-2\.5-flash.*no longer available/i,
      },
      {
        $set: { status: 'queued', attempts: 0, nextAttemptAt: now },
        $unset: { leaseUntil: '', lastError: '' },
      },
    );
    if (result.modifiedCount > 0) {
      this.logger.log(
        `Requeued ${result.modifiedCount} metadata job(s) after Gemini model upgrade.`,
      );
    }
  }

  async enqueueMany(images: QueueableImage[]) {
    const rows = images
      .filter((image) => image?.mediaType !== 'video')
      .map((image) => ({
        imageId: String(image?._id ?? ''),
        userId: String(image?.userId ?? ''),
        collectionId: String(image?.collectionId ?? ''),
      }))
      .filter((row) => row.imageId && row.userId && row.collectionId);
    if (!rows.length) return;
    this.idleUntil = 0;

    const now = new Date();
    const firstAttemptAt = new Date(now.getTime() + 15_000);
    const model = this.modelName();
    const usageKey = this.currentMonthKey();
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const [users, pendingCounts] = await Promise.all([
      this.userModel
        .find({ _id: { $in: userIds } })
        .select('planFeatures aiImageMetadataLimit aiImageMetadataUsed aiImageMetadataUsageKey')
        .lean(),
      this.jobModel.aggregate([
        { $match: { userId: { $in: userIds }, status: { $in: ['queued', 'processing'] } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
    ]);
    const userMap = new Map(users.map((user: any) => [String(user._id), user]));
    const pendingMap = new Map(pendingCounts.map((item: any) => [String(item._id), Number(item.count ?? 0)]));
    const groupedRows = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = groupedRows.get(row.userId) ?? [];
      group.push(row);
      groupedRows.set(row.userId, group);
    }

    const queueRows: typeof rows = [];
    const skippedRows: Array<(typeof rows)[number] & { reason: string }> = [];
    for (const [userId, userRows] of groupedRows) {
      const user = userMap.get(userId) as any;
      const enabled = Boolean(user?.planFeatures?.aiImageMetadata);
      const limit = Math.max(0, Number(user?.aiImageMetadataLimit ?? 0));
      const used = user?.aiImageMetadataUsageKey === usageKey
        ? Math.max(0, Number(user?.aiImageMetadataUsed ?? 0))
        : 0;
      const pending = Math.max(0, pendingMap.get(userId) ?? 0);
      let available = enabled
        ? limit === 0 ? Number.POSITIVE_INFINITY : Math.max(0, limit - used - pending)
        : 0;
      for (const row of userRows) {
        if (available > 0) {
          queueRows.push(row);
          if (Number.isFinite(available)) available -= 1;
        } else {
          skippedRows.push({ ...row, reason: enabled ? 'limit_reached' : 'not_in_plan' });
        }
      }
    }

    if (queueRows.length) {
      await this.jobModel.bulkWrite(
        queueRows.map((row) => ({
          updateOne: {
            filter: { imageId: row.imageId },
            update: {
              $setOnInsert: {
                ...row,
                status: 'queued',
                attempts: 0,
                nextAttemptAt: firstAttemptAt,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );

      await this.imageModel.bulkWrite(
        queueRows.map((row) => ({
          updateOne: {
            filter: { _id: row.imageId, userId: row.userId },
            update: {
              $set: {
                'metadata.ai': {
                  status: 'queued',
                  provider: 'google',
                  model,
                  queuedAt: now.toISOString(),
                  nextAttemptAt: firstAttemptAt.toISOString(),
                },
              },
            },
          },
        })),
        { ordered: false },
      );
    }

    if (skippedRows.length) {
      await this.imageModel.bulkWrite(
        skippedRows.map((row) => ({
          updateOne: {
            filter: { _id: row.imageId, userId: row.userId },
            update: {
              $set: {
                'metadata.ai': {
                  status: 'skipped',
                  provider: 'google',
                  model,
                  reason: row.reason,
                  skippedAt: now.toISOString(),
                },
              },
            },
          },
        })),
        { ordered: false },
      );
    }
  }

  @Interval(3_000)
  async processNextQueuedImage() {
    if (
      this.processing ||
      !this.apiKey() ||
      Date.now() < this.idleUntil
    )
      return;
    this.processing = true;
    let locked = false;
    let processed = false;
    try {
      locked = await this.acquireLock();
      if (!locked) return;
      const job = await this.claimNextJob();
      if (!job) {
        this.idleUntil = Date.now() + IDLE_BACKOFF_MS;
        return;
      }
      processed = true;
      await this.processJob(job);
    } catch (error) {
      this.logger.error(
        `Image metadata worker error: ${this.errorMessage(error)}`,
      );
    } finally {
      if (locked) await this.releaseLock(processed).catch(() => undefined);
      this.processing = false;
    }
  }

  private async acquireLock() {
    const now = new Date();
    const lock = await this.lockModel
      .findOneAndUpdate(
        { key: LOCK_KEY, lockedUntil: { $lte: now } },
        {
          $set: {
            ownerId: this.workerId,
            lockedUntil: new Date(now.getTime() + LOCK_LEASE_MS),
          },
        },
        { returnDocument: 'after' },
      )
      .lean();
    return lock?.ownerId === this.workerId;
  }

  private async releaseLock(processed: boolean) {
    const next = new Date(Date.now() + (processed ? API_GAP_MS : 0));
    await this.lockModel.updateOne(
      { key: LOCK_KEY, ownerId: this.workerId },
      { $set: { ownerId: '', lockedUntil: next } },
    );
  }

  private async claimNextJob() {
    const now = new Date();
    return this.jobModel
      .findOneAndUpdate(
        {
          $or: [
            { status: 'queued', nextAttemptAt: { $lte: now } },
            { status: 'processing', leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            status: 'processing',
            leaseUntil: new Date(now.getTime() + LOCK_LEASE_MS),
          },
          $inc: { attempts: 1 },
        },
        {
          sort: { nextAttemptAt: 1, createdAt: 1 },
          returnDocument: 'after',
        },
      )
      .lean();
  }

  private async processJob(job: ImageMetadataJobDocument | any) {
    const image = await this.imageModel
      .findOne({ _id: job.imageId, userId: job.userId })
      .lean();
    if (!image) {
      await this.jobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'completed', lastError: 'image_deleted' }, $unset: { leaseUntil: '' } },
      );
      return;
    }
    const existingMetadata = (image.metadata ?? {}) as Record<string, any>;
    if (existingMetadata.ai?.status === 'completed') {
      await this.jobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'completed' }, $unset: { leaseUntil: '', lastError: '' } },
      );
      return;
    }

    const quota = await this.reserveAiMetadataSlot(String(image.userId));
    if (!quota.allowed) {
      await this.skipForPlan(job, image, quota.reason ?? 'not_in_plan');
      return;
    }

    await this.imageModel.updateOne(
      { _id: image._id },
      {
        $set: {
          'metadata.ai.status': 'processing',
          'metadata.ai.attempts': Number(job.attempts ?? 1),
        },
      },
    );

    try {
      const aiImage = await this.prepareAiImage(
        String(image.thumbnailUrl || image.url || ''),
      );
      const generated = await this.generateSummary(image, aiImage);
      await this.applyGeneratedMetadata(image, generated, job);
    } catch (error) {
      await this.releaseAiMetadataSlot(String(image.userId), quota.usageKey);
      await this.handleFailure(job, error);
    }
  }

  private async reserveAiMetadataSlot(userId: string): Promise<{
    allowed: boolean;
    usageKey: string;
    reason?: 'not_in_plan' | 'limit_reached';
  }> {
    const usageKey = this.currentMonthKey();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const user = await this.userModel
        .findById(userId)
        .select('planFeatures aiImageMetadataLimit aiImageMetadataUsed aiImageMetadataUsageKey')
        .lean();
      if (!user || !Boolean(user.planFeatures?.aiImageMetadata)) {
        return { allowed: false, usageKey, reason: 'not_in_plan' };
      }

      if (user.aiImageMetadataUsageKey !== usageKey) {
        await this.userModel.updateOne(
          { _id: userId, aiImageMetadataUsageKey: { $ne: usageKey } },
          { $set: { aiImageMetadataUsageKey: usageKey, aiImageMetadataUsed: 0 } },
        );
        continue;
      }

      const limit = Math.max(0, Number(user.aiImageMetadataLimit ?? 0));
      const used = Math.max(0, Number(user.aiImageMetadataUsed ?? 0));
      if (limit > 0 && used >= limit) {
        return { allowed: false, usageKey, reason: 'limit_reached' };
      }

      const filter: Record<string, any> = {
        _id: userId,
        aiImageMetadataUsageKey: usageKey,
        'planFeatures.aiImageMetadata': true,
      };
      if (limit === 0) {
        filter.$or = [
          { aiImageMetadataLimit: 0 },
          { aiImageMetadataLimit: { $exists: false } },
        ];
      } else {
        filter.aiImageMetadataLimit = limit;
        filter.aiImageMetadataUsed = { $lt: limit };
      }

      const reserved = await this.userModel
        .findOneAndUpdate(
          filter,
          { $inc: { aiImageMetadataUsed: 1 } },
          { returnDocument: 'after' },
        )
        .lean();
      if (reserved) return { allowed: true, usageKey };
    }
    return { allowed: false, usageKey, reason: 'limit_reached' };
  }

  private async releaseAiMetadataSlot(userId: string, usageKey: string) {
    await this.userModel.updateOne(
      { _id: userId, aiImageMetadataUsageKey: usageKey, aiImageMetadataUsed: { $gt: 0 } },
      { $inc: { aiImageMetadataUsed: -1 } },
    );
  }

  private async skipForPlan(job: any, image: any, reason: string) {
    const skippedAt = new Date().toISOString();
    await Promise.all([
      this.jobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'completed', lastError: reason }, $unset: { leaseUntil: '' } },
      ),
      this.imageModel.updateOne(
        { _id: image._id, userId: image.userId },
        {
          $set: {
            'metadata.ai.status': 'skipped',
            'metadata.ai.provider': 'google',
            'metadata.ai.model': this.modelName(),
            'metadata.ai.reason': reason,
            'metadata.ai.skippedAt': skippedAt,
          },
          $unset: { 'metadata.ai.nextAttemptAt': '', 'metadata.ai.error': '' },
        },
      ),
    ]);
  }

  private currentMonthKey() {
    return new Date().toISOString().slice(0, 7);
  }

  private async prepareAiImage(
    reference: string,
  ): Promise<{
    buffer: Buffer;
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  }> {
    if (!reference) throw new Error('Image file is unavailable');
    const source = await this.minioService.openReadStream(reference);
    const sourceType = String(source.contentType || '').toLowerCase();
    const directMediaType:
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp'
      | null = sourceType.includes('jpeg') || sourceType.includes('jpg')
      ? 'image/jpeg'
      : sourceType.includes('png')
        ? 'image/png'
        : sourceType.includes('webp')
          ? 'image/webp'
          : null;

    if (
      directMediaType &&
      source.contentLength > 0 &&
      source.contentLength <= DIRECT_AI_IMAGE_MAX_BYTES
    ) {
      const chunks: Buffer[] = [];
      for await (const chunk of source.body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      if (!buffer.length) throw new Error('Image preview is empty');
      return { buffer, mediaType: directMediaType };
    }

    const transformer = sharp({ sequentialRead: true })
      .rotate()
      .resize({
        width: 512,
        height: 512,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 62, mozjpeg: true });
    source.body.pipe(transformer);
    const chunks: Buffer[] = [];
    for await (const chunk of transformer) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) throw new Error('Image preview is empty');
    return { buffer, mediaType: 'image/jpeg' };
  }

  private async generateSummary(
    image: any,
    aiImage: {
      buffer: Buffer;
      mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
    },
  ) {
    const metadata = (image.metadata ?? {}) as Record<string, any>;
    const provider = createGoogleGenerativeAI({ apiKey: this.apiKey() });
    const context = this.promptMetadataContext(image, metadata);
    const prompt = [
      'Create concise professional photo metadata from this single image.',
      'Be factual and newsroom-safe. Do not identify a person by name unless the supplied metadata already names them.',
      'Do not guess an exact event, date, city, country, organization, or relationship from appearance alone.',
      'If a location is not supported by supplied metadata or unmistakable visible evidence, return an empty cityCountry.',
      'title: 3-10 useful words, natural title case, no filename.',
      'caption: one factual sentence, preferably under 220 characters. This is the canonical human-readable description for the photo.',
      'genre: a broad category such as Wedding, Portrait, Event, Travel, Sports, Nature, Product, Architecture, or Documentary.',
      'objectName: a short subject/object label suitable for photo metadata.',
      'keywords: 3-8 short search terms; no speculative names.',
      `Existing trusted metadata: ${JSON.stringify(context)}`,
    ].join('\n');

    const result = await generateText({
      model: provider(this.modelName()),
      output: Output.object({ schema: summarySchema }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'file', data: aiImage.buffer, mediaType: aiImage.mediaType },
          ],
        },
      ],
      temperature: 0.2,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(35_000),
    });
    return result.output;
  }

  private async applyGeneratedMetadata(
    image: any,
    generated: z.infer<typeof summarySchema>,
    job: any,
  ) {
    const metadata = { ...((image.metadata ?? {}) as Record<string, any>) };
    const title = this.cleanText(generated.title, 100);
    const caption = this.cleanText(generated.caption, 280);
    const existingKeywords = this.keywordList(
      metadata.keywords ?? metadata.keyword,
    );
    const keywords = [...new Set([
      ...existingKeywords,
      ...generated.keywords.map((item) => this.cleanText(item, 40)),
    ].filter(Boolean))].slice(0, 12);
    const completedAt = new Date().toISOString();

    const nextMetadata = {
      ...metadata,
      title,
      fileTitle: title,
      // AI caption is canonical. Keep description mirrored for old clients/searches.
      description: caption,
      caption,
      headline: this.cleanText(metadata.headline, 200) || title,
      genre: this.cleanText(metadata.genre, 80) || this.cleanText(generated.genre, 60),
      objectName:
        this.cleanText(metadata.objectName, 160) ||
        this.cleanText(generated.objectName, 120) || title,
      cityCountry:
        this.cleanText(metadata.cityCountry, 160) ||
        this.cleanText(generated.cityCountry, 120),
      keyword: keywords,
      keywords,
      ai: {
        status: 'completed',
        provider: 'google',
        model: this.modelName(),
        attempts: Number(job.attempts ?? 1),
        completedAt,
      },
    };

    await this.imageModel.updateOne(
      { _id: image._id, userId: image.userId },
      { $set: { metadata: nextMetadata } },
    );
    await this.jobModel.updateOne(
      { _id: job._id },
      {
        $set: { status: 'completed' },
        $unset: { leaseUntil: '', lastError: '' },
      },
    );
  }

  private async handleFailure(job: any, error: unknown) {
    const attempts = Math.max(1, Number(job.attempts ?? 1));
    const finalFailure = attempts >= MAX_ATTEMPTS;
    const message = this.errorMessage(error);
    const retryDelay = Math.min(15 * 60_000, 30_000 * 2 ** (attempts - 1));
    const nextAttemptAt = new Date(Date.now() + retryDelay);

    await this.jobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: finalFailure ? 'failed' : 'queued',
          lastError: message,
          nextAttemptAt,
        },
        $unset: { leaseUntil: '' },
      },
    );
    const imageUpdate: Record<string, any> = {
      $set: {
        'metadata.ai.status': finalFailure ? 'failed' : 'queued',
        'metadata.ai.attempts': attempts,
        'metadata.ai.error': message,
      },
    };
    if (finalFailure) {
      imageUpdate.$unset = { 'metadata.ai.nextAttemptAt': '' };
    } else {
      imageUpdate.$set['metadata.ai.nextAttemptAt'] = nextAttemptAt.toISOString();
    }
    await this.imageModel.updateOne(
      { _id: job.imageId, userId: job.userId },
      imageUpdate,
    );

    this.logger.warn(
      `AI metadata ${finalFailure ? 'failed' : 'will retry'} for image ${job.imageId}: ${message}`,
    );
  }

  private promptMetadataContext(image: any, metadata: Record<string, any>) {
    return {
      fileName: String(image.originalName ?? ''),
      photographer: this.cleanText(metadata.photographer, 120),
      dateTaken: this.cleanText(metadata.dateTaken ?? metadata.eventDate, 80),
      city: this.cleanText(metadata.city, 100),
      country: this.cleanText(metadata.country, 100),
      cityCountry: this.cleanText(metadata.cityCountry, 160),
      headline: this.cleanText(metadata.headline, 200),
      caption: this.cleanText(metadata.caption, 400),
      objectName: this.cleanText(metadata.objectName, 160),
      genre: this.cleanText(metadata.genre, 80),
      keywords: this.keywordList(metadata.keywords ?? metadata.keyword).slice(0, 12),
    };
  }

  private keywordList(value: unknown) {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.cleanText(item, 40))
        .filter(Boolean);
    }
    const text = this.cleanText(value, 400);
    return text
      ? text.split(/[,;|]/).map((item) => this.cleanText(item, 40)).filter(Boolean)
      : [];
  }

  private cleanText(value: unknown, maxLength: number) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  private errorMessage(error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown AI error');
    return this.cleanText(message, 500) || 'Unknown AI error';
  }

  private apiKey() {
    return String(this.configService.get<string>('GEMINI_API_KEY') ?? '').trim();
  }

  private modelName() {
    const configured = String(
      this.configService.get<string>('GEMINI_MODEL') ?? '',
    ).trim().replace(/^models\//, '');
    // Gemini 2.5 Flash is no longer available to new users. Transparently
    // upgrade stale local/server config so queued jobs recover after deploy.
    if (!configured || configured === 'gemini-2.5-flash') {
      return 'gemini-3.6-flash';
    }
    return configured;
  }
}

import { BadRequestException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { ZipArchive } from 'archiver';
import { randomBytes, randomUUID } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rm, stat } from 'fs/promises';
import { Model, Types } from 'mongoose';
import { basename, extname, join } from 'path';
import { cwd } from 'process';
import { Readable } from 'stream';
import { finished, pipeline } from 'stream/promises';
import { MinioService } from 'src/lib/minio.service';
import { MailService } from 'src/mail/mail.service';
import { MarketingScheduleService } from 'src/marketing-schedule/marketing-schedule.service';
import { DashboardSetting, DashboardSettingDocument, DashboardSettingType } from 'src/settings/entities/dashboard-setting.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { Homepage, HomepageDocument } from 'src/homepage/entities/homepage.entity';
import { Collection, CollectionDocument } from './entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from './entities/collection-image.entity';
import { CollectionImageFavorite, CollectionImageFavoriteDocument } from './entities/collection-image-favorite.entity';
import { CollectionPrivatePhoto, CollectionPrivatePhotoDocument } from './entities/collection-private-photo.entity';
import { CollectionDownloadActivity, CollectionDownloadActivityDocument } from './entities/collection-download-activity.entity';
import { CollectionDownloadDelivery, CollectionDownloadDeliveryDocument, type CollectionDownloadScope } from './entities/collection-download-delivery.entity';

const LINK_LIFETIME_MS = 30 * 60 * 60 * 1000;

type DownloadRequest = {
  email?: string;
  scope?: CollectionDownloadScope;
  setId?: string;
  imageIds?: string[];
  pin?: string;
};

@Injectable()
export class CollectionDownloadDeliveryService {
  private readonly logger = new Logger(CollectionDownloadDeliveryService.name);
  private processing = false;
  private lastCleanupAt = 0;
  constructor(
    @InjectModel(CollectionDownloadDelivery.name) private readonly deliveryModel: Model<CollectionDownloadDeliveryDocument>,
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(CollectionImageFavorite.name) private readonly favoriteModel: Model<CollectionImageFavoriteDocument>,
    @InjectModel(CollectionPrivatePhoto.name) private readonly privatePhotoModel: Model<CollectionPrivatePhotoDocument>,
    @InjectModel(CollectionDownloadActivity.name) private readonly activityModel: Model<CollectionDownloadActivityDocument>,
    @InjectModel(DashboardSetting.name) private readonly settingModel: Model<DashboardSettingDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Homepage.name) private readonly homepageModel: Model<HomepageDocument>,
    private readonly minioService: MinioService,
    private readonly marketingScheduleService: MarketingScheduleService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async request(identifier: string, body: DownloadRequest, siteSlug?: string) {
    const email = this.cleanEmail(body.email);
    if (!email) throw new BadRequestException('Enter a valid email address for the download link');
    const scope = this.scope(body.scope);
    const collection = await this.findPublicCollection(identifier, siteSlug);
    const owner = await this.userModel.findById(collection.userId).select('planFeatures').lean();
    if (!owner?.planFeatures?.downloads) throw new BadRequestException('Downloads are not available on this plan');

    const settings = await this.downloadAndAccessSettings(collection);
    this.assertGalleryAccess(collection, settings, email, body.pin);
    const resolvedImages = await this.resolveRequestedImages(collection, settings.download, scope, body, email);
    const images = await this.applyDownloadLimit(collection, settings.download, scope, resolvedImages, email, body);
    if (!images.length) throw new BadRequestException('No downloadable files matched this request');

    const token = randomBytes(32).toString('hex');
    const fileName = this.archiveName(collection.name, scope, body.setId);
    const job = await this.deliveryModel.create({
      userId: String(collection.userId),
      collectionId: String(collection._id),
      collectionName: collection.name,
      email,
      scope,
      setId: scope === 'set' ? String(body.setId || '') : undefined,
      imageIds: images.map((image) => String(image._id)),
      preferThumbnails: scope === 'single' && this.bool(settings.download.restrictedSinglePhotoDownloadSize),
      token,
      status: 'queued',
      fileName,
      fileCount: images.length,
      expiresAt: new Date(Date.now() + LINK_LIFETIME_MS),
      lastError: '',
    });
    await this.recordActivity(collection, email, images, scope);
    setTimeout(() => void this.processQueue(), 25);
    return {
      requestId: String(job._id),
      status: 'queued',
      fileCount: images.length,
      expiresInHours: 30,
      message: 'Your files are being prepared. A secure 30-hour download link will be emailed when ready.',
    };
  }

  async open(token: string) {
    const cleanToken = String(token || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(cleanToken)) throw new NotFoundException('Download link not found');
    const job = await this.deliveryModel.findOne({ token: cleanToken }).lean();
    if (!job) throw new NotFoundException('Download link not found');
    if (new Date(job.expiresAt).getTime() <= Date.now()) {
      await this.expireJob(job);
      throw new GoneException('This download link expired after 30 hours');
    }
    if (job.status === 'failed') throw new GoneException('This download could not be prepared. Please request it again.');
    if (job.status !== 'ready' || !job.fileUrl) throw new BadRequestException('Your download is still being prepared. Please try the email link again shortly.');
    return {
      ...await this.minioService.openReadStream(job.fileUrl),
      fileName: job.fileName,
    };
  }

  @Interval(3000)
  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      if (Date.now() - this.lastCleanupAt > 10 * 60 * 1000) {
        this.lastCleanupAt = Date.now();
        await this.cleanupExpired();
      }
      const job = await this.deliveryModel.findOneAndUpdate(
        { status: 'queued' },
        { $set: { status: 'processing', lastError: '' } },
        { new: true, sort: { createdAt: 1 } },
      );
      if (job) await this.prepare(job);
    } finally {
      this.processing = false;
    }
  }

  private async prepare(job: CollectionDownloadDeliveryDocument) {
    const tempDir = join(cwd(), 'uploads', 'download-jobs', String(job._id));
    const sourceDir = join(tempDir, 'files');
    const zipPath = join(tempDir, job.fileName);
    try {
      await mkdir(sourceDir, { recursive: true });
      const rawImages = await this.imageModel.find({
        collectionId: job.collectionId,
        _id: { $in: job.imageIds.filter((id) => Types.ObjectId.isValid(id)) },
      }).lean();      const byId = new Map(rawImages.map((image) => [String(image._id), image]));
      const images = job.imageIds.map((id) => byId.get(id)).filter(Boolean) as any[];
      if (!images.length) throw new Error('Requested photos are no longer available');

      const localFiles: Array<{ path: string; name: string }> = [];
      const usedNames = new Set<string>();
      for (const [index, image] of images.entries()) {
        const rawName = String(image.originalName || image.filename || `photo-${index + 1}`);
        const name = this.uniqueArchiveName(rawName, index, usedNames);
        const extension = extname(name) || extname(String(image.url || '')) || '.jpg';
        const localPath = join(sourceDir, `${String(index + 1).padStart(5, '0')}${extension}`);
        const source = job.preferThumbnails && image.thumbnailUrl ? String(image.thumbnailUrl) : String(image.url || '');
        if (!source) continue;
        await this.downloadToDisk(source, localPath);
        localFiles.push({ path: localPath, name });
      }
      if (!localFiles.length) throw new Error('Requested files could not be read from storage');

      const output = createWriteStream(zipPath);
      const outputDone = finished(output);
      const archive = new ZipArchive({ store: true });
      archive.on('warning', (warning) => this.logger.warn(`Download ZIP warning: ${warning.message}`));
      archive.pipe(output);
      for (const file of localFiles) archive.file(file.path, { name: file.name });
      await archive.finalize();
      await outputDone;

      const zipStat = await stat(zipPath);
      const fileUrl = await this.minioService.uploadFile({
        path: zipPath,
        filename: `download-deliveries/${randomUUID()}.zip`,
        originalname: job.fileName,
        mimetype: 'application/zip',
        size: zipStat.size,
      } as Express.Multer.File);
      const readyAt = new Date();
      const expiresAt = new Date(readyAt.getTime() + LINK_LIFETIME_MS);
      await this.deliveryModel.updateOne(
        { _id: job._id, status: 'processing' },
        { $set: { status: 'ready', fileUrl, fileCount: localFiles.length, readyAt, expiresAt, lastError: '' } },
      );
      await this.sendReadyEmail(job, expiresAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Download delivery ${job._id} failed: ${message}`);
      await this.deliveryModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', lastError: message.slice(0, 2000) } },
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async sendReadyEmail(job: CollectionDownloadDeliveryDocument, expiresAt: Date) {
    const buttonLink = this.deliveryLink(job.token);
    const queued = await this.marketingScheduleService.queueLifecycleEvent({
      userId: job.userId,
      trigger: 'client-download',
      recipientEmails: [job.email],
      collectionId: job.collectionId,
      collectionName: job.collectionName,
      buttonLink,
      eventId: String(job._id),
    }).catch(() => ({ queued: 0 }));
    if (queued.queued > 0) return;

    const expiresText = expiresAt.toLocaleString();
    const text = `Your download from ${job.collectionName} is ready.\n\nDownload: ${buttonLink}\n\nThis secure link expires in 30 hours (${expiresText}).`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px;color:#202326"><h1>Your photos are ready</h1><p>Your requested files from <strong>${escapeHtml(job.collectionName)}</strong> are ready.</p><p style="margin:28px 0"><a href="${escapeHtml(buttonLink)}" style="display:inline-block;background:#6337d8;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700">Download photos</a></p><p style="font-size:13px;color:#777">This secure link expires in 30 hours.</p></div>`;
    const result = await this.mailService.send({ to: job.email, subject: `Your download from ${job.collectionName} is ready`, text, html });
    if (!result.sent) {
      await this.deliveryModel.updateOne({ _id: job._id }, { $set: { lastError: result.reason === 'SMTP_NOT_CONFIGURED' ? 'Archive is ready, but SMTP is not configured' : 'Archive is ready, but email delivery failed' } });
    }
  }
  private async downloadToDisk(source: string, destination: string) {
    if (source.startsWith('/uploads/')) {
      const localPath = join(cwd(), source.split(/[?#]/)[0].replace(/^\/+/, ''));
      await pipeline(createReadStream(localPath), createWriteStream(destination));
      return;
    }
    try {
      const object = await this.minioService.openReadStream(source);
      await pipeline(object.body, createWriteStream(destination));
      return;
    } catch {
      // Non-MinIO legacy/external URLs are streamed over HTTP below.
    }
    const response = await fetch(source, { signal: AbortSignal.timeout(60_000), cache: 'no-store' });
    if (!response.ok || !response.body) throw new Error(`Could not read ${basename(source.split(/[?#]/)[0]) || 'photo'}`);
    await pipeline(Readable.fromWeb(response.body as any), createWriteStream(destination));
  }

  private async cleanupExpired() {
    await this.deliveryModel.updateMany(
      {
        status: 'processing',
        updatedAt: { $lte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      { $set: { status: 'queued', lastError: 'Recovered after an interrupted download worker' } },
    );
    const rows = await this.deliveryModel.find({
      status: 'ready',
      expiresAt: { $lte: new Date() },
    }).sort({ expiresAt: 1 }).limit(50).lean();
    for (const row of rows) await this.expireJob(row);
  }

  private async expireJob(job: { _id: unknown; fileUrl?: string }) {
    if (job.fileUrl) await this.minioService.deleteService(job.fileUrl).catch(() => undefined);
    await this.deliveryModel.updateOne(
      { _id: job._id as any },
      { $set: { status: 'expired', fileUrl: '', lastError: 'Secure download link expired after 30 hours' } },
    );
  }

  private deliveryLink(token: string) {
    const base = String(
      this.configService.get<string>('PUBLIC_API_URL') ||
      this.configService.get<string>('PUBLIC_BASE_URL') ||
      this.configService.get<string>('BASE_URL') ||
      `http://localhost:${this.configService.get<string>('PORT') || '4000'}`,
    ).replace(/\/$/, '');
    return `${base}/public/collections/download-deliveries/${encodeURIComponent(token)}`;
  }
  private async findPublicCollection(identifier: string, siteSlug?: string) {
    const query: Record<string, string>[] = [{ slug: identifier }, { name: identifier }];
    if (/^[a-f\d]{24}$/i.test(identifier)) query.unshift({ _id: identifier });
    const owner = siteSlug
      ? await this.homepageModel.findOne({ slug: siteSlug.toLowerCase(), enabled: true }).select('userId').lean()
      : null;
    if (siteSlug && !owner) throw new NotFoundException('Collection not found');
    const collection = await this.collectionModel.findOne({
      $or: query,
      ...(owner ? { userId: owner.userId } : {}),
    }).sort({ createdAt: -1 }).lean();
    if (!collection || collection.status !== 'published') throw new NotFoundException('Collection not found');
    if (collection.expiresAt) {
      const expiresAt = new Date(collection.expiresAt);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date()) throw new NotFoundException('Collection not found');
    }
    return collection;
  }

  private async downloadAndAccessSettings(collection: any) {
    const preset = collection.presetId
      ? await this.settingModel.findOne({
          userId: collection.userId,
          type: DashboardSettingType.PRESET,
          localId: collection.presetId,
        }).lean()
      : null;
    const presetData = preset?.data as any;
    const own = (collection.settings as any) ?? {};
    const ownAccess = own.access ?? {};
    return {
      general: { ...(presetData?.general ?? presetData?.presetGeneral ?? {}), ...(own.general ?? {}) },
      download: { ...(presetData?.download ?? presetData?.presetDownload ?? {}), ...(own.download ?? {}) },
      access: {
        ...ownAccess,
        allowedEmails: this.cleanEmailList([
          ...(Array.isArray(ownAccess.allowedEmails) ? ownAccess.allowedEmails : []),
          ...(Array.isArray(collection.clientEmails) ? collection.clientEmails : []),
        ]),
      },
    };
  }
  private assertGalleryAccess(collection: any, settings: any, email: string, pin?: string) {
    const access = settings.access ?? {};
    if (this.bool(access.pinEnabled)) {
      if (!String(pin || '').trim() || String(pin || '').trim() !== String(access.pinCode || '').trim()) {
        throw new BadRequestException('Gallery PIN is required before requesting downloads');
      }
      return;
    }
    if (!this.bool(settings.general?.emailRegistration)) return;
    const allowed = this.cleanEmailList(access.allowedEmails);
    const approved = Array.isArray(access.requests) && access.requests.some((request: any) =>
      request?.status === 'approved' && this.cleanEmail(request?.email) === email,
    );
    if (!allowed.includes(email) && !approved) {
      throw new BadRequestException('This email does not have access to the gallery');
    }
  }

  private async resolveRequestedImages(collection: any, download: any, scope: CollectionDownloadScope, body: DownloadRequest, email: string) {
    const collectionId = String(collection._id);
    const hidden = await this.privatePhotoModel.find({ collectionId, status: 'approved' }).select('imageId').lean();
    const hiddenIds = hidden.map((item) => item.imageId).filter(Boolean);
    const validRequestedIds = [...new Set((Array.isArray(body.imageIds) ? body.imageIds : [])
      .map((id) => String(id))
      .filter((id) => Types.ObjectId.isValid(id)))];

    if (scope === 'single') {
      if (validRequestedIds.length !== 1) throw new BadRequestException('Choose one file to download');
      const image = await this.imageModel.findOne({
        _id: validRequestedIds[0], collectionId,
        ...(hiddenIds.length ? { _id: { $eq: validRequestedIds[0], $nin: hiddenIds } } : {}),
      }).lean();
      if (!image) throw new NotFoundException('Photo not found');
      const allowed = image.mediaType === 'video'
        ? this.bool(download.videoDownload)
        : this.bool(download.photoDownload) && this.bool(download.singlePhotoDownload);
      if (!allowed) throw new BadRequestException('This file is not available for download');
      return [image];
    }

    if (!this.bool(download.photoDownload) || !this.bool(download.galleryDownload)) {
      throw new BadRequestException('Gallery downloads are disabled');
    }
    const query: Record<string, any> = { collectionId, mediaType: { $ne: 'video' } };
    if (hiddenIds.length) query._id = { $nin: hiddenIds };

    if (scope === 'set') {
      const setId = String(body.setId || '').trim();
      if (!setId || !Array.isArray(collection.sets) || !collection.sets.some((set: any) => set.id === setId)) {
        throw new BadRequestException('Choose a valid photo set');
      }
      query.setId = setId;
    }
    if (scope === 'favorites') {
      const favoriteRows = await this.favoriteModel.find({ collectionId, userId: email }).select('imageId').lean();
      const favoriteIds = favoriteRows.map((item) => String(item.imageId)).filter((id) => Types.ObjectId.isValid(id));
      if (!favoriteIds.length) throw new BadRequestException('No favorites were found for this email');
      const requested = validRequestedIds.length
        ? validRequestedIds.filter((id) => favoriteIds.includes(id))
        : favoriteIds;
      if (!requested.length || (validRequestedIds.length && requested.length !== validRequestedIds.length)) {
        throw new BadRequestException('One or more requested photos are not in this client favorite list');
      }
      query._id = hiddenIds.length ? { $in: requested, $nin: hiddenIds } : { $in: requested };
    }

    const images = await this.imageModel.find(query).sort({ order: 1, createdAt: -1 }).lean();
    if (scope === 'favorites' && validRequestedIds.length) {
      const byId = new Map(images.map((image) => [String(image._id), image]));
      return validRequestedIds.map((id) => byId.get(id)).filter(Boolean) as any[];
    }
    return images;
  }

  private async applyDownloadLimit(collection: any, download: any, scope: CollectionDownloadScope, images: any[], email: string, body: DownloadRequest) {
    if (!this.bool(download.limitDownloads)) return images;
    const max = Math.max(0, Number(download.limitPinUsage) || 0);
    if (!max) return images;
    const totals = await this.activityModel.aggregate<{ total: number }>([
      { $match: { collectionId: String(collection._id), email } },
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]);
    const used = Math.max(0, Number(totals[0]?.total ?? 0));
    const remaining = Math.max(0, max - used);
    if (!remaining) throw new BadRequestException(`This email has reached the ${max}-photo download limit for this gallery`);
    if (scope === 'single') return images.slice(0, 1);
    if (scope === 'favorites' && Array.isArray(body.imageIds) && body.imageIds.length > remaining) {
      throw new BadRequestException(`Only ${remaining} photo${remaining === 1 ? '' : 's'} remain in this gallery's download limit`);
    }
    return images.slice(0, remaining);
  }

  private async recordActivity(collection: any, email: string, images: any[], scope: CollectionDownloadScope) {
    const collectionId = String(collection._id);
    const downloadType: 'single' | 'all' = scope === 'single' ? 'single' : 'all';
    const operations = images.map((image, index) => ({
      updateOne: {
        filter: {
          collectionId,
          email,
          imageId: String(image._id),
          imageName: String(image.originalName || image.filename || `photo-${index + 1}`),
          downloadType,
        },
        update: {
          $set: {
            collectionId,
            email,
            imageId: String(image._id),
            imageName: String(image.originalName || image.filename || `photo-${index + 1}`),
            imageUrl: String(image.url || ''),
            downloadType,
          },
          $inc: { count: 1 },
        },
        upsert: true,
      },
    }));
    for (let offset = 0; offset < operations.length; offset += 200) {
      await this.activityModel.bulkWrite(operations.slice(offset, offset + 200), { ordered: false });
    }
  }
  private archiveName(collectionName: string, scope: CollectionDownloadScope, setId?: string) {
    const base = this.safeName(collectionName) || 'gallery';
    const suffix = scope === 'single' ? 'photo' : scope === 'favorites' ? 'favorites' : scope === 'set' ? this.safeName(setId || 'set') : 'gallery';
    return `${base}-${suffix}.zip`;
  }

  private uniqueArchiveName(raw: string, index: number, used: Set<string>) {
    const cleaned = this.safeName(basename(raw)) || `photo-${index + 1}`;
    const extension = extname(cleaned);
    const stem = extension ? cleaned.slice(0, -extension.length) : cleaned;
    let candidate = cleaned;
    let counter = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${stem}-${counter++}${extension}`;
    used.add(candidate.toLowerCase());
    return candidate;
  }

  private safeName(value: string) {
    return String(value || '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^\.+|\.+$/g, '')
      .trim()
      .slice(0, 180);
  }

  private scope(value: unknown): CollectionDownloadScope {
    return ['single', 'set', 'favorites', 'all'].includes(String(value))
      ? String(value) as CollectionDownloadScope
      : 'all';
  }

  private bool(value: unknown) {
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value ?? '').trim().toLowerCase());
  }

  private cleanEmail(value: unknown) {
    const email = String(value ?? '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  }

  private cleanEmailList(values: unknown) {
    const list = Array.isArray(values) ? values : [];
    return [...new Set(list.map((value) => this.cleanEmail(value)).filter(Boolean))];
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

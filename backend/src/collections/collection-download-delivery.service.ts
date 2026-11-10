import { randomBytes } from 'crypto';
import { BadRequestException, GoneException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { MinioService } from 'src/lib/minio.service';
import { backgroundWorkerEnabled } from 'src/lib/runtime-role';
import { BrandingEmailService } from 'src/mail/branding-email.service';
import { DashboardSetting, DashboardSettingDocument, DashboardSettingType } from 'src/settings/entities/dashboard-setting.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { Homepage, HomepageDocument } from 'src/homepage/entities/homepage.entity';
import { Collection, CollectionDocument } from './entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from './entities/collection-image.entity';
import { CollectionImageFavorite, CollectionImageFavoriteDocument } from './entities/collection-image-favorite.entity';
import { CollectionPrivatePhoto, CollectionPrivatePhotoDocument } from './entities/collection-private-photo.entity';
import { CollectionDownloadActivity, CollectionDownloadActivityDocument } from './entities/collection-download-activity.entity';
import { CollectionDownloadDelivery, CollectionDownloadDeliveryDocument, type CollectionDownloadScope } from './entities/collection-download-delivery.entity';

const IMAGE_FIELDS = '_id originalName filename url thumbnailUrl mediaType';

const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

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
    private readonly brandingEmailService: BrandingEmailService,
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
    const downloadUrl = this.deliveryLink(token);
    const fileName = this.downloadName(collection.name, scope, body.setId);
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
      status: 'ready',
      readyAt: new Date(),
      emailAttempts: 0,
      emailNextAttemptAt: new Date(),
      fileName,
      fileCount: images.length,
      expiresAt: new Date(Date.now() + LINK_LIFETIME_MS),
      lastError: '',
    });
    await this.recordActivity(collection, email, images, scope);
    setTimeout(() => void this.processQueue(), 25);
    return {
      requestId: String(job._id),
      status: 'ready',
      downloadUrl,
      fileCount: images.length,
      expiresInHours: 24,
      message: 'Your photos are ready. Open the download link now; we will also email it. The link expires in 24 hours.',
    };
  }

  private async activeDelivery(token: string) {
    const cleanToken = String(token || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(cleanToken)) throw new NotFoundException('Download link not found');
    const job = await this.deliveryModel.findOne({ token: cleanToken }).lean();
    if (!job) throw new NotFoundException('Download link not found');
    if (job.status === 'expired' || new Date(job.expiresAt).getTime() <= Date.now()) {
      throw new GoneException('This download link expired after 24 hours');
    }
    if (job.status !== 'ready') throw new BadRequestException('Please request a new download link');
    return job;
  }

  async open(token: string, page = 0) {
    const job = await this.activeDelivery(token);
    const pageIndex = Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0;
    const ids = job.imageIds.slice(pageIndex * 100, (pageIndex + 1) * 100);
    const images = await this.imageModel.find({ collectionId: job.collectionId, _id: { $in: ids } })
      .select(IMAGE_FIELDS).lean();
    const byId = new Map(images.map((image) => [String(image._id), image]));
    const base = this.deliveryLink(job.token);
    const links = ids.flatMap((id) => {
      const image = byId.get(id);
      return image ? [`<li><a href="${escapeHtml(base)}/files/${id}" rel="noreferrer">${escapeHtml(image.originalName || image.filename || 'Photo')}</a></li>`] : [];
    }).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Download photos</title><style>body{font:17px system-ui;max-width:760px;margin:48px auto;padding:0 24px;color:#222}a{color:#087b68}li{padding:12px 0;overflow-wrap:anywhere}nav{display:flex;gap:24px}</style></head><body><h1>${escapeHtml(job.collectionName)}</h1><p>Your photos are ready. Choose a photo to download directly from storage.</p><p>Link expires ${escapeHtml(new Date(job.expiresAt).toISOString())}. No ZIP needed.</p><ul>${links || '<li>No photos on this page.</li>'}</ul><nav>${pageIndex > 0 ? `<a href="${escapeHtml(base)}?page=${pageIndex - 1}">Previous</a>` : ''}${(pageIndex + 1) * 100 < job.imageIds.length ? `<a href="${escapeHtml(base)}?page=${pageIndex + 1}">Next</a>` : ''}</nav></body></html>`;
  }

  async fileLink(token: string, imageId: string) {
    const job = await this.activeDelivery(token);
    if (!Types.ObjectId.isValid(imageId) || !job.imageIds.includes(imageId)) throw new NotFoundException('Photo not found');
    const hidden = await this.privatePhotoModel.exists({ collectionId: job.collectionId, imageId, status: 'approved' });
    if (hidden) throw new NotFoundException('Photo not found');
    const image = await this.imageModel.findOne({ _id: imageId, collectionId: job.collectionId })
      .select(`${IMAGE_FIELDS} +originalObjectKey +originalFilename metadata.imageCache.urls.small`).lean();
    if (!image) throw new NotFoundException('Photo not found');
    const expiresIn = Math.floor((new Date(job.expiresAt).getTime() - Date.now()) / 1000);
    if (expiresIn < 1) throw new GoneException('This download link expired');
    const filename = image.originalFilename || image.originalName || image.filename || 'photo';
    if (!job.preferThumbnails && image.originalObjectKey) {
      return this.minioService.createDownloadUrl(image.originalObjectKey, filename, expiresIn, !image.originalObjectKey.startsWith('direct/'));
    }
    const cachedSmall = (image.metadata?.imageCache as { urls?: { small?: string } } | undefined)?.urls?.small;
    const source = job.preferThumbnails ? cachedSmall || image.thumbnailUrl || image.url : image.url;
    // Cached variants can be AVIF even when the original was JPEG.
    const extension = String(source).split(/[?#]/)[0].match(/\.(avif|webp|png|jpe?g)$/i)?.[0];
    const downloadName = job.preferThumbnails && extension ? filename.replace(/\.[^.]+$/, '') + extension : filename;
    return this.minioService.createDownloadUrl(source, downloadName, expiresIn);
  }

  @Interval(3000)
  async processQueue() {
    if (!backgroundWorkerEnabled() || this.processing) return;
    this.processing = true;
    try {
      if (Date.now() - this.lastCleanupAt > 10 * 60 * 1000) {
        this.lastCleanupAt = Date.now();
        await this.cleanupExpired();
      }
      // Migrate interrupted ZIP requests to immediate direct-download pages.
      await this.deliveryModel.updateMany(
        { status: { $in: ['queued', 'processing', 'failed'] }, expiresAt: { $gt: new Date() } },
        { $set: { status: 'ready', readyAt: new Date(), expiresAt: new Date(Date.now() + LINK_LIFETIME_MS), emailNextAttemptAt: new Date(), emailAttempts: 0, lastError: '' } },
      );
      for (let count = 0; count < 10; count++) {
        const now = new Date();
        const job = await this.deliveryModel.findOneAndUpdate(
          { status: 'ready', expiresAt: { $gt: now }, emailSentAt: null, emailNextAttemptAt: { $lte: now }, emailAttempts: { $lt: 5 } },
          { $set: { emailNextAttemptAt: new Date(Date.now() + 5 * 60 * 1000) }, $inc: { emailAttempts: 1 } },
          { returnDocument: 'after', sort: { emailNextAttemptAt: 1 } },
        );
        if (!job) break;
        await this.sendReadyEmail(job);
      }
    } catch (error) {
      this.logger.error(`Download email queue failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.processing = false;
    }
  }

  private async sendReadyEmail(job: CollectionDownloadDeliveryDocument) {
    try {
      const buttonLink = this.deliveryLink(job.token);
      const result = await this.brandingEmailService.sendBranded({
        userId: String(job.userId), to: job.email,
        subject: `Your photos from ${job.collectionName} are ready`,
        text: `Your photos are ready.\n\nDownload: ${buttonLink}\n\nThis link expires in 24 hours (${new Date(job.expiresAt).toISOString()}).`,
        previewText: 'Download your photos directly from storage.',
        eyebrowText: 'Photos ready', title: 'Your photos are ready',
        message: `Your requested photos from ${job.collectionName} are ready. Open the link to download each photo directly from storage.`,
        buttonText: 'Download photos', buttonLink,
        footerText: 'This secure link expires in 24 hours.',
      });
      if (!result.sent) throw new Error(result.reason || 'SMTP_SEND_FAILED');
      await this.deliveryModel.updateOne({ _id: job._id }, { $set: { emailSentAt: new Date(), lastError: '' }, $unset: { emailNextAttemptAt: 1 } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Download email ${job._id} failed (attempt ${job.emailAttempts}/5): ${message}`);
      await this.deliveryModel.updateOne({ _id: job._id }, { $set: {
        lastError: message.slice(0, 2000),
        emailNextAttemptAt: new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, job.emailAttempts - 1))),
      } });
    }
  }

  private async cleanupExpired() {
    // Retry legacy archives whose email failed before retry metadata existed.
    await this.deliveryModel.updateMany({
      status: 'ready', expiresAt: { $gt: new Date() },
      emailNextAttemptAt: { $exists: false }, emailSentAt: { $exists: false },
      lastError: { $regex: 'SMTP|email delivery', $options: 'i' },
    }, { $set: { emailAttempts: 0, emailNextAttemptAt: new Date() } });
    const rows = await this.deliveryModel.find({ status: 'ready', expiresAt: { $lte: new Date() } })
      .select('_id fileUrl').limit(50).lean();
    for (const row of rows) {
      // Only legacy jobs have an archive. Never delete original photos.
      if (row.fileUrl) await this.minioService.deleteService(row.fileUrl);
      await this.deliveryModel.updateOne({ _id: row._id }, { $set: { status: 'expired', fileUrl: '' } });
    }
  }

  private deliveryLink(token: string) {
    const base = String(
      this.configService.get<string>('PUBLIC_API_URL') ||
      this.configService.get<string>('PUBLIC_BASE_URL') ||
      this.configService.get<string>('BASE_URL') ||
      `http://localhost:${this.configService.get<string>('PORT') || '4000'}`,
    ).trim().replace(/\/$/, '');
    let parsed: URL;
    try {
      parsed = new URL(base);
    } catch {
      throw new ServiceUnavailableException('Gallery download links require a valid PUBLIC_API_URL in the backend environment');
    }
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
        (this.configService.get<string>('NODE_ENV') === 'production' && localHosts.includes(parsed.hostname.toLowerCase()))) {
      throw new ServiceUnavailableException('Gallery download links require PUBLIC_API_URL set to the accessible public backend URL');
    }
    return `${base}/public/collections/download-deliveries/${encodeURIComponent(token)}`;
  }
  private async findPublicCollection(identifier: string, siteSlug?: string) {
    const query: Record<string, string>[] = [{ slug: identifier }, { name: identifier }];
    if (/^[a-f\d]{24}$/i.test(identifier)) query.unshift({ _id: identifier });
    const requestedSiteSlug = String(siteSlug ?? '').trim().toLowerCase();
    const owner = requestedSiteSlug
      ? await this.homepageModel.findOne({
          enabled: true,
          $or: [
            { slug: requestedSiteSlug },
            { subdomains: { $elemMatch: { slug: requestedSiteSlug, enabled: { $ne: false } } } },
          ],
        }).select('userId slug subdomains').lean()
      : null;
    if (requestedSiteSlug && !owner) throw new NotFoundException('Collection not found');
    const collection = await this.collectionModel.findOne({
      $or: query,
      ...(owner ? { userId: owner.userId } : {}),
    }).sort({ createdAt: -1 }).lean();
    if (!collection || collection.status !== 'published') throw new NotFoundException('Collection not found');
    if (owner) {
      const siteId = String(owner.slug) === requestedSiteSlug
        ? 'main'
        : String((owner.subdomains ?? []).find((site: any) => String(site.slug) === requestedSiteSlug)?.id ?? '');
      const assigned = Array.isArray((collection as any).homepageSiteIds)
        ? (collection as any).homepageSiteIds.map((value: unknown) => String(value)).filter(Boolean)
        : [];
      const allowed = siteId === 'main' ? assigned.length === 0 || assigned.includes('main') : assigned.includes(siteId);
      if (!siteId || !allowed) throw new NotFoundException('Collection not found');
    }
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
      }).select(IMAGE_FIELDS).lean();
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

    const images = await this.imageModel.find(query).select(IMAGE_FIELDS).sort({ order: 1, createdAt: -1 }).lean();
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
  private downloadName(collectionName: string, scope: CollectionDownloadScope, setId?: string) {
    const base = this.safeName(collectionName) || 'gallery';
    const suffix = scope === 'single' ? 'photo' : scope === 'favorites' ? 'favorites' : scope === 'set' ? this.safeName(setId || 'set') : 'gallery';
    return `${base}-${suffix}`;
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
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

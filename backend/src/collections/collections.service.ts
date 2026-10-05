import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { Model, Types } from 'mongoose';
import { extname, join } from 'path';
import { cwd } from 'process';
import sharp, { type Metadata, type Sharp } from 'sharp';
import * as exifr from 'exifr';
import { setTimeout as delay } from 'timers/promises';
import { MinioService } from 'src/lib/minio.service';
import { backgroundWorkerEnabled } from 'src/lib/runtime-role';
import {
  ImagorService,
  type ImagorWatermark,
} from 'src/lib/imagor.service';
import { MailService, type GlobalMailAttachment } from 'src/mail/mail.service';
import { BrandingEmailService } from 'src/mail/branding-email.service';
import {
  buildSystemNotificationEmail,
  formatNotificationTime,
} from 'src/mail/system-notification-email';
import { MarketingScheduleService } from 'src/marketing-schedule/marketing-schedule.service';
import { FaceSearchService } from 'src/face-search/face-search.service';
import { ImageMetadataAiService } from 'src/image-metadata-ai/image-metadata-ai.service';
import {
  MobileGalleryImage,
  MobileGalleryImageDocument,
} from 'src/mobile-gallery/entities/mobile-gallery-image.entity';
import {
  DashboardSetting,
  DashboardSettingDocument,
  DashboardSettingType,
} from 'src/settings/entities/dashboard-setting.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import {
  Homepage,
  HomepageDocument,
} from 'src/homepage/entities/homepage.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { Collection, CollectionDocument } from './entities/collection.entity';
import {
  CollectionImage,
  CollectionImageDocument,
} from './entities/collection-image.entity';
import {
  CollectionImageProcessingJob,
  CollectionImageProcessingJobDocument,
} from './entities/collection-image-processing-job.entity';
import {
  CollectionImageDeleteJob,
  CollectionImageDeleteJobDocument,
} from './entities/collection-image-delete-job.entity';
import {
  CollectionFavorite,
  CollectionFavoriteDocument,
} from './entities/collection-favorite.entity';
import {
  CollectionImageFavorite,
  CollectionImageFavoriteDocument,
} from './entities/collection-image-favorite.entity';
import {
  CollectionDownloadActivity,
  CollectionDownloadActivityDocument,
} from './entities/collection-download-activity.entity';
import {
  CollectionEmailRegistration,
  CollectionEmailRegistrationDocument,
} from './entities/collection-email-registration.entity';
import {
  CollectionPrivatePhoto,
  CollectionPrivatePhotoDocument,
} from './entities/collection-private-photo.entity';
import {
  CollectionView,
  CollectionViewDocument,
} from './entities/collection-view.entity';
import {
  StoreOrder,
  StoreOrderDocument,
} from 'src/store/entities/store-order.entity';

type WatermarkData = {
  id: string;
  name: string;
  type: 'text' | 'image';
  text?: string;
  font?: string;
  color?: string;
  scale?: number;
  opacity?: number;
  position?: { x: number; y: number };
  image?: string;
  applyDownloads?: boolean;
};

type DirectUploadFile = {
  objectKey: string;
  name: string;
  type: string;
  size: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  uploadId?: string;
  parts?: Array<{ partNumber: number; etag: string }>;
};

type ImageMetadataDefaults = {
  photographer?: string;
  credit?: string;
  source?: string;
  directUploadObjectKey?: string;
};

type FaceIndexQueueImage = Pick<
  CollectionImage,
  | 'userId'
  | 'collectionId'
  | 'url'
  | 'thumbnailUrl'
  | 'originalObjectKey'
  | 'metadata'
  | 'width'
  | 'height'
> & { _id?: unknown };

const IMAGE_CACHE_VERSION = 3;

@Injectable()
export class CollectionsService implements OnModuleInit {
  constructor(
    @InjectModel(Collection.name)
    private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name)
    private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(CollectionImageProcessingJob.name)
    private readonly imageProcessingJobModel: Model<CollectionImageProcessingJobDocument>,
    @InjectModel(CollectionImageDeleteJob.name)
    private readonly imageDeleteJobModel: Model<CollectionImageDeleteJobDocument>,
    @InjectModel(CollectionFavorite.name)
    private readonly favoriteModel: Model<CollectionFavoriteDocument>,
    @InjectModel(CollectionImageFavorite.name)
    private readonly imageFavoriteModel: Model<CollectionImageFavoriteDocument>,
    @InjectModel(CollectionDownloadActivity.name)
    private readonly downloadActivityModel: Model<CollectionDownloadActivityDocument>,
    @InjectModel(CollectionEmailRegistration.name)
    private readonly emailRegistrationModel: Model<CollectionEmailRegistrationDocument>,
    @InjectModel(CollectionPrivatePhoto.name)
    private readonly privatePhotoModel: Model<CollectionPrivatePhotoDocument>,
    @InjectModel(CollectionView.name)
    private readonly viewModel: Model<CollectionViewDocument>,
    @InjectModel(StoreOrder.name)
    private readonly orderModel: Model<StoreOrderDocument>,
    @InjectModel(DashboardSetting.name)
    private readonly settingModel: Model<DashboardSettingDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(MobileGalleryImage.name)
    private readonly mobileGalleryImageModel: Model<MobileGalleryImageDocument>,
    @InjectModel(Homepage.name)
    private readonly homepageModel: Model<HomepageDocument>,
    private readonly minioService: MinioService,
    private readonly imagorService: ImagorService,
    private readonly faceSearchService: FaceSearchService,
    private readonly imageMetadataAiService: ImageMetadataAiService,
    private readonly mailService: MailService,
    private readonly brandingEmailService: BrandingEmailService,
    private readonly marketingScheduleService: MarketingScheduleService,
    private readonly configService: ConfigService,
  ) {}

  private directImageWorkerRunning = false;
  private readonly directImagorSaveLocks = new Map<string, Promise<any>>();
  private lastDirectImageRecoveryAt = 0;
  private lastDirectUploadDiscoveryAt = 0;
  private imageDeleteWorkerRunning = false;
  private lastImageDeleteRecoveryAt = 0;

  onModuleInit() {
    const sharpThreads = Number(
      this.configService.get<string>('SHARP_BACKGROUND_CONCURRENCY') ?? 1,
    );
    sharp.concurrency(
      Math.max(
        1,
        Math.min(
          2,
          Number.isFinite(sharpThreads) ? Math.floor(sharpThreads) : 1,
        ),
      ),
    );

    const cacheMemoryMb = Number(
      this.configService.get<string>('SHARP_CACHE_MEMORY_MB') ?? 32,
    );
    sharp.cache({
      memory: Math.max(
        0,
        Math.min(
          128,
          Number.isFinite(cacheMemoryMb) ? Math.floor(cacheMemoryMb) : 32,
        ),
      ),
      files: 20,
      items: 50,
    });
  }

  async create(userId: string, dto: CreateCollectionDto) {
    const owner = await this.userModel
      .findById(userId)
      .select('galleryLimit email name businessName')
      .lean();
    const galleryLimit = Number(owner?.galleryLimit ?? 10);
    if (galleryLimit > 0) {
      const galleryCount = await this.collectionModel.countDocuments({ userId });
      if (galleryCount >= galleryLimit) {
        throw new BadRequestException(`Your current plan allows ${galleryLimit} galleries.`);
      }
    }
    const safeDto = await this.sanitizeCollectionCapabilities(userId, dto);
    const publishRecipients = this.cleanEmailList(safeDto.clientEmails);
    const incomingSettings = ((safeDto.settings ?? {}) as Record<string, any>);
    const incomingAccess = ((incomingSettings.access ?? {}) as Record<string, any>);
    const collection = await this.collectionModel.create({
      userId,
      name: safeDto.name,
      slug: await this.uniqueSlug(userId, safeDto.name),
      eventDate: safeDto.eventDate ? new Date(safeDto.eventDate) : undefined,
      presetId: safeDto.presetId,
      tags: [...new Set((safeDto.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20),
      clientEmails: publishRecipients,
      status: safeDto.status ?? 'draft',
      design: safeDto.design ?? {},
      settings: {
        ...incomingSettings,
        access: {
          ...incomingAccess,
          allowedEmails: this.cleanEmailList([
            ...(Array.isArray(incomingAccess.allowedEmails) ? incomingAccess.allowedEmails : []),
            ...publishRecipients,
          ]),
          publishRecipientEmails: publishRecipients,
        },
      },
      sets: [{ id: 'highlights', name: 'Featured', createdAt: new Date() }],
      imageCount: 0,
    });

    if (collection.status === 'published') {
      await this.queuePublishedCollection(collection).catch(() => undefined);
    }

    if (owner?.email) {
      const websiteBrand = await this.mailService.getWebsiteBranding();
      const brand = websiteBrand.brandText;
      const email = buildSystemNotificationEmail({
        brand,
        logoUrl: websiteBrand.logoUrl,
        subject: `New gallery created - ${collection.name}`,
        heading: 'New gallery created',
        intro: `A new gallery was created in your ${brand} account.`,
        details: [
          { label: 'Gallery', value: collection.name },
          { label: 'Status', value: collection.status },
          { label: 'Time', value: formatNotificationTime(new Date()) },
        ],
        warning:
          'If you did not create this gallery, review your account activity and change your password immediately.',
      });
      void this.mailService.send({
        to: owner.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    }

    return collection.toObject();
  }

  async dashboardOverview(userId: string) {
    const analyticsOwner = await this.userModel.findById(userId).select('planFeatures').lean();
    if (!analyticsOwner?.planFeatures?.basicAnalytics) {
      throw new BadRequestException('Current plan does not allow Basic Gallery & Sales Analytics.');
    }
    const now = new Date();
    const periodStart = new Date(now.getTime() - 30 * 86400000);
    const previousStart = new Date(now.getTime() - 60 * 86400000);
    const [
      collections,
      views,
      previousViews,
      orders,
      previousOrders,
      registrations,
      user,
    ] = await Promise.all([
      this.collectionModel.find({ userId }).sort({ createdAt: -1 }).lean(),
      this.viewModel
        .find({ ownerId: userId, createdAt: { $gte: periodStart } })
        .sort({ createdAt: -1 })
        .lean(),
      this.viewModel.countDocuments({
        ownerId: userId,
        createdAt: { $gte: previousStart, $lt: periodStart },
      }),
      this.orderModel
        .find({ userId, createdAt: { $gte: periodStart } })
        .sort({ createdAt: -1 })
        .lean(),
      this.orderModel
        .find({ userId, createdAt: { $gte: previousStart, $lt: periodStart } })
        .lean(),
      this.emailRegistrationModel
        .find({ ownerId: userId })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      this.userModel
        .findById(userId)
        .select('name businessName storageUsedBytes storageLimitGb')
        .lean(),
    ]);
    const ids = collections.map((item) => item._id.toString());
    const [allDownloads, viewGroups, salesGroups, imageCountGroups] =
      await Promise.all([
      this.downloadActivityModel
        .find({ collectionId: { $in: ids } })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      this.viewModel.aggregate([
        { $match: { ownerId: userId } },
        { $group: { _id: '$collectionId', views: { $sum: 1 } } },
      ]),
      this.orderModel.aggregate([
        {
          $match: {
            userId,
            paymentStatus: 'paid',
            status: { $ne: 'cancelled' },
          },
        },
        { $unwind: '$items' },
        { $match: { 'items.collectionId': { $in: ids } } },
        {
          $group: {
            _id: '$items.collectionId',
            sales: { $sum: '$items.total' },
          },
        },
      ]),
      this.imageModel.aggregate([
        { $match: { collectionId: { $in: ids } } },
        {
          $group: {
            _id: {
              collectionId: '$collectionId',
              logicalId: {
                $ifNull: ['$metadata.directUploadObjectKey', { $toString: '$_id' }],
              },
            },
          },
        },
        { $group: { _id: '$_id.collectionId', count: { $sum: 1 } } },
      ]),
    ]);
    const paid = orders.filter(
      (o) => o.paymentStatus === 'paid' && o.status !== 'cancelled',
    );
    const previousPaid = previousOrders.filter(
      (o) => o.paymentStatus === 'paid' && o.status !== 'cancelled',
    );
    const revenue = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const previousRevenue = previousPaid.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0,
    );
    const conversionRate = views.length
      ? (paid.length / views.length) * 100
      : 0;
    const previousConversionRate = previousViews
      ? (previousPaid.length / previousViews) * 100
      : 0;
    const change = (value: number, previous: number) =>
      previous > 0
        ? ((value - previous) / previous) * 100
        : value > 0
          ? 100
          : 0;
    const viewMap = new Map(
      viewGroups.map((x: any) => [String(x._id), Number(x.views || 0)]),
    );
    const salesMap = new Map(
      salesGroups.map((x: any) => [String(x._id), Number(x.sales || 0)]),
    );
    const imageCountMap = new Map(
      imageCountGroups.map((x: any) => [String(x._id), Number(x.count || 0)]),
    );
    const dayKeys = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getTime() - (13 - i) * 86400000);
      return d.toISOString().slice(0, 10);
    });
    const series = dayKeys.map((date) => ({
      date,
      views: views.filter(
        (v: any) => new Date(v.createdAt).toISOString().slice(0, 10) === date,
      ).length,
      orders: orders.filter(
        (o: any) => new Date(o.createdAt).toISOString().slice(0, 10) === date,
      ).length,
      revenue: paid
        .filter(
          (o: any) => new Date(o.createdAt).toISOString().slice(0, 10) === date,
        )
        .reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
    }));
    const recentGalleries = collections.slice(0, 6).map((c: any) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      coverImage: c.coverImage,
      imageCount: imageCountMap.get(c._id.toString()) || 0,
      status: c.status || 'draft',
      views: viewMap.get(c._id.toString()) || 0,
      sales: salesMap.get(c._id.toString()) || 0,
      updatedAt: c.updatedAt || c.createdAt,
    }));
    const activity: any[] = [
      ...orders.slice(0, 10).map((o: any) => ({
        type: o.paymentStatus === 'paid' ? 'payment' : 'order',
        title:
          o.paymentStatus === 'paid'
            ? 'Payment received'
            : 'New order received',
        detail: `${o.orderNumber} \u00B7 \u20AC${Number(o.total || 0).toFixed(2)}`,
        createdAt: o.createdAt,
      })),
      ...allDownloads.slice(0, 10).map((d: any) => ({
        type: 'download',
        title: 'Photos downloaded',
        detail: d.imageName || 'Gallery download',
        createdAt: d.updatedAt || d.createdAt,
      })),
      ...registrations.slice(0, 10).map((r: any) => ({
        type: 'client',
        title: 'New client registered',
        detail: r.email,
        createdAt: r.updatedAt || r.createdAt,
      })),
    ]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 8);
    return {
      user: {
        name: (user as any)?.businessName || (user as any)?.name || 'there',
        storageUsedBytes: Number((user as any)?.storageUsedBytes || 0),
        storageLimitGb: Number((user as any)?.storageLimitGb || 0),
      },
      metrics: {
        revenue,
        revenueChange: change(revenue, previousRevenue),
        orders: orders.length,
        ordersChange: change(orders.length, previousOrders.length),
        views: views.length,
        viewsChange: change(views.length, previousViews),
        conversionRate,
        conversionChange: change(conversionRate, previousConversionRate),
      },
      recentGalleries,
      activity,
      series,
      topGalleries: [...recentGalleries]
        .sort((a, b) => b.views - a.views)
        .slice(0, 5),
    };
  }

  async findAll(userId: string) {
    const collections = await this.collectionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const ids = collections.map((collection) => collection._id.toString());
    const imageCounts = await this.imageModel.aggregate([
      { $match: { collectionId: { $in: ids } } },
      {
        $group: {
          _id: {
            collectionId: '$collectionId',
            logicalId: {
              $ifNull: ['$metadata.directUploadObjectKey', { $toString: '$_id' }],
            },
          },
        },
      },
      { $group: { _id: '$_id.collectionId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(imageCounts.map((item) => [item._id, item.count]));
    const currentCovers = await Promise.all(
      collections.map((collection) => this.currentCollectionCover(collection)),
    );
    if (collections.length) {
      void this.collectionModel
        .bulkWrite(
          collections.map((collection) => ({
            updateOne: {
              filter: { _id: collection._id, userId },
              update: {
                $set: {
                  imageCount:
                    countMap.get(collection._id.toString()) ?? 0,
                },
              },
            },
          })),
          { ordered: false },
        )
        .catch(() => undefined);
    }

    return collections.map((collection, index) => ({
      ...collection,
      coverImage: currentCovers[index] || collection.coverImage,
      imageCount: countMap.get(collection._id.toString()) ?? 0,
    }));
  }

  async findOne(userId: string, id: string, limit?: string, offset?: string) {
    const collection = await this.collectionModel
      .findOne({ _id: id, userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const [imagesPage, setCountRows] = await Promise.all([
      this.findImages(userId, id, limit, offset),
      this.imageModel.aggregate<{ _id: string; count: number }>([
        { $match: { collectionId: id, userId } },
        {
          $group: {
            _id: {
              setId: { $ifNull: ['$setId', 'highlights'] },
              logicalId: {
                $ifNull: ['$metadata.directUploadObjectKey', { $toString: '$_id' }],
              },
            },
          },
        },
        { $group: { _id: '$_id.setId', count: { $sum: 1 } } },
      ]),
    ]);
    const setImageCounts = Object.fromEntries(
      setCountRows.map((row) => [String(row._id || 'highlights'), Number(row.count || 0)]),
    );
    const imageCount = Object.values(setImageCounts).reduce(
      (sum, count) => sum + Number(count || 0),
      0,
    );
    void this.collectionModel
      .updateOne({ _id: id, userId }, { $set: { imageCount } })
      .catch(() => undefined);
    void this.ensureCollectionPreviews(id);
    const coverImage = await this.currentCollectionCover(collection);

    return {
      ...collection,
      coverImage: coverImage || collection.coverImage,
      imageCount,
      setImageCounts,
      images: imagesPage.items,
      imagesPage,
    };
  }

  async findPublic(
    identifier: string,
    email?: string,
    pin?: string,
    limit?: string,
    offset?: string,
    siteSlug?: string,
    allowUnpublished = false,
    setId?: string,
  ) {
    const collection = await this.findCollectionByIdentifier(
      identifier,
      siteSlug,
    );
    if (!allowUnpublished && !this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');
    const preset = collection.presetId
      ? await this.settingModel
          .findOne({
            userId: collection.userId,
            type: DashboardSettingType.PRESET,
            localId: collection.presetId,
          })
          .lean()
      : null;
    const presetData = preset?.data as any;
    const collectionAccess = ((collection.settings as any)?.access ?? {}) as Record<string, any>;
    const accessSourceSettings = {
      ...((collection.settings as any) ?? {}),
      general: {
        ...(presetData?.general ?? presetData?.presetGeneral ?? {}),
        ...((collection.settings as any)?.general ?? {}),
      },
      access: {
        ...collectionAccess,
        allowedEmails: this.cleanEmailList([
          ...(Array.isArray(collectionAccess.allowedEmails) ? collectionAccess.allowedEmails : []),
          ...(Array.isArray(collection.clientEmails) ? collection.clientEmails : []),
        ]),
      },
    };
    const accessRaw = (accessSourceSettings as any)?.access ?? {};
    const pinRequired = this.boolSetting(accessRaw.pinEnabled);
    const pinAuthorized = !pinRequired || (String(pin ?? '').trim() && String(pin ?? '').trim() === String(accessRaw.pinCode ?? '').trim());
    const emailAccess = pinRequired
      ? { required: false, authorized: true, status: 'pin-mode', email: '' }
      : this.resolveEmailAccess(accessSourceSettings, email);
    const galleryAuthorized = pinAuthorized && emailAccess.authorized;
    if (emailAccess.required && galleryAuthorized && emailAccess.email) {
      await this.saveEmailRegistration(
        collection,
        emailAccess.email,
        false,
        'email-registration',
      );
    }
    const requestedSetId =
      String(setId ?? '').trim() === '__all__'
        ? ''
        : String(setId || collection.sets?.[0]?.id || 'highlights').trim();
    const imagesPagePromise = galleryAuthorized
      ? allowUnpublished
        ? this.findImagesPage(
            this.withSetFilter(
              {
                // Owner preview has already verified collection ownership before
                // allowUnpublished=true is used. Legacy galleries can contain
                // image rows created before userId was consistently persisted,
                // so filtering those rows by userId made preview show only a
                // handful of newer photos while the normal public gallery worked.
                collectionId: collection._id.toString(),
              },
              requestedSetId,
            ),
            limit,
            offset,
          )
        : this.findVisiblePublicImagesPage(
            collection._id.toString(),
            limit,
            offset,
            requestedSetId,
          )
      : Promise.resolve({
          items: [],
          total: 0,
          limit: this.pageLimit(limit),
          offset: this.pageOffset(offset),
          hasMore: false,
        });

    if (galleryAuthorized)
      void this.ensureCollectionPreviews(collection._id.toString());

    const [
      imagesPage,
      branding,
      preferences,
      integrations,
      marketing,
      owner,
      coverImage,
    ] = await Promise.all([
      imagesPagePromise,
      this.settingModel
        .findOne({
          userId: collection.userId,
          type: DashboardSettingType.BRANDING,
          localId: 'branding',
        })
        .lean(),
      this.settingModel
        .findOne({
          userId: collection.userId,
          type: DashboardSettingType.PREFERENCE,
          localId: 'preferences',
        })
        .lean(),
      this.settingModel
        .findOne({
          userId: collection.userId,
          type: DashboardSettingType.INTEGRATION,
          localId: 'google-analytics',
        })
        .lean(),
      this.settingModel
        .findOne({
          userId: collection.userId,
          type: DashboardSettingType.MARKETING,
          localId: 'gallery-marketing',
        })
        .lean(),
      this.userModel.findById(collection.userId).select('planFeatures').lean(),
      this.currentCollectionCover(collection),
    ]);
    const ownerFeatures = owner?.planFeatures ?? {};

    const mergedFavoriteSettings = {
      ...(presetData?.favorite ?? presetData?.presetFavorite ?? {}),
      ...((collection.settings as any)?.favorite ?? {}),
    } as Record<string, any>;
    const { printShopEmail: _hiddenPrintShopEmail, ...publicFavoriteSettings } = mergedFavoriteSettings;
    publicFavoriteSettings.autoShareToPrintShop =
      this.boolSetting(mergedFavoriteSettings.autoShareToPrintShop) &&
      Boolean(this.cleanEmail(mergedFavoriteSettings.printShopEmail));

    const mergedSettings = {
      general: {
        ...(presetData?.general ?? presetData?.presetGeneral ?? {}),
        ...((collection.settings as any)?.general ?? {}),
      },
      download: {
        ...(presetData?.download ?? presetData?.presetDownload ?? {}),
        ...((collection.settings as any)?.download ?? {}),
      },
      favorite: publicFavoriteSettings,
      store: {
        ...(presetData?.store ?? presetData?.presetStore ?? {}),
        ...((collection.settings as any)?.store ?? {}),
      },
      access: {
        emailRequired: emailAccess.required,
        emailAuthorized: emailAccess.authorized,
        emailStatus: emailAccess.status,
        email: emailAccess.email,
        pinRequired,
        pinAuthorized: Boolean(pinAuthorized),
      },
    };

    if (!ownerFeatures.downloads) {
      mergedSettings.download = {
        ...mergedSettings.download,
        enabled: false,
        allowDownload: false,
        allowDownloads: false,
        photoDownload: false,
        galleryDownload: false,
        singlePhotoDownload: false,
        videoDownload: false,
      };
    }
    if (!ownerFeatures.store) {
      mergedSettings.store = {
        ...mergedSettings.store,
        enabled: false,
        storeStatus: false,
        showPrintStoreNav: false,
        showBuyPhotoButton: false,
      };
    }

    const { clientEmails: _hiddenClientEmails, ...publicCollection } = collection as any;
    return {
      ...publicCollection,
      coverImage: coverImage || publicCollection.coverImage,
      planCapabilities: {
        aiFaceSearch: Boolean(ownerFeatures.aiFaceSearch),
        advancedFaceSearch: Boolean(ownerFeatures.advancedFaceSearch),
        downloads: Boolean(ownerFeatures.downloads),
        store: Boolean(ownerFeatures.store),
        multipleGalleryStores: Boolean(ownerFeatures.multipleGalleryStores),
      },
      design: {
        ...(presetData?.design ?? presetData?.presetDesign ?? {}),
        ...(collection.design ?? {}),
      },
      settings: mergedSettings,
      preferences: {
        ...((preferences?.data as any) ?? {}),
        ...(((collection.settings as any)?.preferences as any) ?? {}),
      },
      integrations: {
        googleAnalytics: (integrations?.data as any) ?? {},
      },
      marketing: (marketing?.data as any) ?? {},
      branding: (branding?.data as any) ?? {},
      images: imagesPage.items,
      imagesPage,
    };
  }

  async findOwnerPreview(
    userId: string,
    id: string,
    limit?: string,
    offset?: string,
    setId?: string,
  ) {
    await this.findOne(userId, id, '1', '0');

    // Self-heal old image rows in the background. The owner check above makes
    // this safe, and future dashboard queries no longer lose legacy photos.
    void this.imageModel
      .updateMany(
        {
          collectionId: id,
          $or: [
            { userId: { $exists: false } },
            { userId: { $ne: userId } },
          ],
        },
        { $set: { userId } },
      )
      .catch(() => undefined);

    const publicCollection = await this.findPublic(
      id,
      undefined,
      undefined,
      limit,
      offset,
      undefined,
      true,
      setId,
    );

    return {
      ...publicCollection,
      ownerPreview: true,
      settings: {
        ...(publicCollection.settings ?? {}),
        access: {
          emailRequired: false,
          emailAuthorized: true,
          emailStatus: 'owner-preview',
        },
      },
      images: publicCollection.images,
      imagesPage: publicCollection.imagesPage,
    };
  }

  async recordPublicView(
    identifier: string,
    body: { viewToken?: string; source?: string },
    siteSlug?: string,
  ) {
    const collection = await this.findCollectionByIdentifier(
      identifier,
      siteSlug,
    );
    if (!this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');

    const viewToken = String(body?.viewToken ?? '')
      .trim()
      .slice(0, 120);
    if (!viewToken) throw new BadRequestException('View token is required');

    try {
      const result = await this.viewModel.updateOne(
        { viewToken },
        {
          $setOnInsert: {
            collectionId: collection._id.toString(),
            ownerId: collection.userId,
            visitorKey: '',
            source: String(body?.source ?? 'gallery').slice(0, 50),
            viewToken,
          },
        },
        { upsert: true },
      );

      return {
        recorded: Boolean(result.upsertedCount),
        collectionId: collection._id.toString(),
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          recorded: false,
          collectionId: collection._id.toString(),
        };
      }
      throw error;
    }
  }

  async findImages(
    userId: string,
    id: string,
    limit?: string,
    offset?: string,
    setId?: string,
  ) {
    const collection = await this.collectionModel
      .findOne({ _id: id, userId })
      .select('_id')
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const query: Record<string, unknown> = { collectionId: id, userId };
    const normalizedSetId = String(setId ?? '').trim();
    if (normalizedSetId) {
      if (normalizedSetId === 'highlights') {
        query.$or = [
          { setId: 'highlights' },
          { setId: { $exists: false } },
          { setId: null },
          { setId: '' },
        ];
      } else {
        query.setId = normalizedSetId;
      }
    }

    return this.findImagesPage(query, limit, offset);
  }

  async findImageMetadata(userId: string, collectionId: string, imageId: string) {
    if (!Types.ObjectId.isValid(imageId))
      throw new BadRequestException('Image is required');
    const select =
      '_id userId collectionId setId originalName filename mimetype mediaType sizeBytes width height metadata updatedAt';
    const image = await this.imageModel
      .findOne({ _id: imageId, collectionId, userId })
      .select(select)
      .lean();
    if (!image) throw new NotFoundException('Image not found');

    const aiStatus = String((image.metadata as any)?.ai?.status ?? '');
    if (
      image.mediaType !== 'video' &&
      (!aiStatus || aiStatus === 'skipped' || aiStatus === 'failed')
    ) {
      await this.imageMetadataAiService.ensureQueued(image as any).catch(
        (error) => {
          console.warn(
            'Could not re-check AI metadata eligibility:',
            error?.message ?? error,
          );
        },
      );
      return (
        (await this.imageModel
          .findOne({ _id: imageId, collectionId, userId })
          .select(select)
          .lean()) ?? image
      );
    }

    return image;
  }

  async findPublicImages(
    identifier: string,
    email?: string,
    pin?: string,
    limit?: string,
    offset?: string,
    siteSlug?: string,
    setId?: string,
  ) {
    const collection = await this.findCollectionByIdentifier(
      identifier,
      siteSlug,
    );
    if (!this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');
    const preset = collection.presetId
      ? await this.settingModel
          .findOne({
            userId: collection.userId,
            type: DashboardSettingType.PRESET,
            localId: collection.presetId,
          })
          .lean()
      : null;
    const presetData = preset?.data as any;
    const collectionAccess = ((collection.settings as any)?.access ?? {}) as Record<string, any>;
    const accessSourceSettings = {
      ...((collection.settings as any) ?? {}),
      general: {
        ...(presetData?.general ?? presetData?.presetGeneral ?? {}),
        ...((collection.settings as any)?.general ?? {}),
      },
      access: {
        ...collectionAccess,
        allowedEmails: this.cleanEmailList([
          ...(Array.isArray(collectionAccess.allowedEmails) ? collectionAccess.allowedEmails : []),
          ...(Array.isArray(collection.clientEmails) ? collection.clientEmails : []),
        ]),
      },
    };
    const accessRaw = (accessSourceSettings as any)?.access ?? {};
    const pinRequired = this.boolSetting(accessRaw.pinEnabled);
    const pinAuthorized = !pinRequired || (String(pin ?? '').trim() && String(pin ?? '').trim() === String(accessRaw.pinCode ?? '').trim());
    const emailAccess = pinRequired
      ? { required: false, authorized: true, status: 'pin-mode', email: '' }
      : this.resolveEmailAccess(accessSourceSettings, email);
    if (!pinAuthorized || !emailAccess.authorized) {
      return {
        items: [],
        total: 0,
        limit: this.pageLimit(limit),
        offset: this.pageOffset(offset),
        hasMore: false,
      };
    }
    void this.ensureCollectionPreviews(collection._id.toString());
    return this.findVisiblePublicImagesPage(
      collection._id.toString(),
      limit,
      offset,
      setId,
    );
  }

  async requestPublicAccess(
    identifier: string,
    body: { email?: string; reason?: string },
    siteSlug?: string,
  ) {
    const collection = await this.findCollectionByIdentifier(
      identifier,
      siteSlug,
    );
    if (!this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');
    const email = this.cleanEmail(body.email);
    if (!email) throw new BadRequestException('Email is required');
    const reason = String(body.reason ?? '')
      .trim()
      .slice(0, 1000);
    const settings = (collection.settings as any) ?? {};
    const access = settings.access ?? {};
    const requests = Array.isArray(access.requests) ? access.requests : [];
    const existingIndex = requests.findIndex(
      (request: any) => this.cleanEmail(request.email) === email,
    );
    const nextRequest = {
      id: existingIndex >= 0 ? requests[existingIndex].id : `req-${Date.now()}`,
      email,
      reason,
      status: 'pending',
      createdAt:
        existingIndex >= 0
          ? requests[existingIndex].createdAt
          : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nextRequests =
      existingIndex >= 0
        ? requests.map((request: any, index: number) =>
            index === existingIndex ? nextRequest : request,
          )
        : [nextRequest, ...requests];
    await this.collectionModel.updateOne(
      { _id: collection._id },
      {
        $set: {
          settings: {
            ...settings,
            access: { ...access, requests: nextRequests },
          },
        },
      },
    );
    return { requested: true, email };
  }

  async recordPublicEmailRegistration(
    identifier: string,
    body: { email?: string; marketingOptIn?: boolean; source?: string },
    siteSlug?: string,
  ) {
    const collection = await this.findCollectionByIdentifier(
      identifier,
      siteSlug,
    );
    if (!this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');
    const email = this.cleanEmail(body.email);
    if (!email) throw new BadRequestException('Email is required');
    const source = this.registrationSource(body.source);
    await this.saveEmailRegistration(
      collection,
      email,
      Boolean(body.marketingOptIn),
      source,
    );
    return {
      registered: true,
      authorized: true,
      email,
      marketingOptIn: Boolean(body.marketingOptIn),
    };
  }

  async togglePublicPrivateImage(
    identifier: string,
    imageId: string,
    body: { email?: string },
    siteSlug?: string,
  ) {
    const collection = await this.findCollectionByIdentifier(
      identifier,
      siteSlug,
    );
    if (!this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');
    const email = this.cleanEmail(body.email);
    if (!email) throw new BadRequestException('Email is required');
    if (!Types.ObjectId.isValid(imageId))
      throw new BadRequestException('Photo is required');
    const collectionId = collection._id.toString();
    const image = await this.imageModel
      .findOne({ _id: imageId, collectionId })
      .select('_id')
      .lean();
    if (!image) throw new NotFoundException('Image not found');

    const existing = await this.privatePhotoModel
      .findOne({ collectionId, email, imageId })
      .lean();
    if (existing) {
      if (existing.status === 'pending') {
        await this.privatePhotoModel.deleteOne({ _id: existing._id });
        return {
          private: false,
          requested: false,
          status: 'cancelled',
          collectionId,
          imageId,
          email,
        };
      }
      if (existing.status === 'approved') {
        return {
          private: true,
          requested: true,
          status: 'approved',
          collectionId,
          imageId,
          email,
        };
      }
      await this.privatePhotoModel.updateOne(
        { _id: existing._id },
        { $set: { status: 'pending' } },
      );
      return {
        private: false,
        requested: true,
        status: 'pending',
        collectionId,
        imageId,
        email,
      };
    }

    await this.privatePhotoModel.updateOne(
      { collectionId, email, imageId },
      { $setOnInsert: { collectionId, email, imageId, status: 'pending' } },
      { upsert: true },
    );
    return {
      private: false,
      requested: true,
      status: 'pending',
      collectionId,
      imageId,
      email,
    };
  }

  async listMarketingContacts(userId: string) {
    const contacts = await this.emailRegistrationModel
      .find({ ownerId: userId, marketingOptIn: true })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return contacts.map((contact) => ({
      _id: contact._id,
      email: contact.email,
      collectionId: contact.collectionId,
      collectionName: contact.collectionName,
      source: contact.lastSource,
      sources: contact.sources ?? [],
      marketingOptIn: contact.marketingOptIn,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    }));
  }

  async listClientContacts(userId: string) {
    const [registrations, collections] = await Promise.all([
      this.emailRegistrationModel
        .find({ ownerId: userId })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean(),
      this.collectionModel
        .find({ userId, clientEmails: { $exists: true, $ne: [] } })
        .select('name clientEmails')
        .lean(),
    ]);
    type ClientContactRow = {
      email: string;
      collectionName?: string;
      source?: string;
      marketingOptIn?: boolean;
      categories: string[];
    };
    const rows = new Map<string, ClientContactRow>();
    const mergeContact = (email: string, category?: string, source?: string, marketingOptIn = false) => {
      const existing = rows.get(email);
      const cleanCategory = String(category ?? '').trim();
      const categories = [...new Set([
        ...(existing?.categories ?? []),
        ...(cleanCategory ? [cleanCategory] : []),
      ])];
      const preferIncoming = String(source ?? '').startsWith('manual-');
      rows.set(email, {
        email,
        collectionName: preferIncoming ? cleanCategory : existing?.collectionName || cleanCategory,
        source: preferIncoming ? source : existing?.source || source,
        marketingOptIn: Boolean(existing?.marketingOptIn || marketingOptIn),
        categories,
      });
    };
    for (const contact of registrations) {
      const email = this.cleanEmail(contact.email);
      if (!email) continue;
      mergeContact(email, contact.collectionName, contact.lastSource, Boolean(contact.marketingOptIn));
    }
    for (const collection of collections) {
      for (const email of this.cleanEmailList(collection.clientEmails))
        mergeContact(email, collection.name, 'publish-recipient');
    }
    return [...rows.values()].sort((left, right) => left.email.localeCompare(right.email));
  }

  async addMarketingContacts(
    userId: string,
    body: {
      email?: string;
      category?: string;
      contacts?: { email?: string; category?: string }[];
    },
  ) {
    const incoming =
      Array.isArray(body.contacts) && body.contacts.length
        ? body.contacts
        : [{ email: body.email, category: body.category }];
    const clean = incoming
      .map((item) => ({
        email: String(item.email ?? '')
          .trim()
          .toLowerCase(),
        category:
          String(item.category ?? 'Manual Contacts').trim() ||
          'Manual Contacts',
      }))
      .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email));
    if (!clean.length) throw new BadRequestException('Valid email is required');

    let added = 0;
    for (const item of clean) {
      const source = `manual-${
        item.category
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'contacts'
      }`;
      const existing = await this.emailRegistrationModel
        .findOne({ collectionId: source, email: item.email })
        .select('marketingOptIn marketingOptedInAt')
        .lean();
      await this.emailRegistrationModel.updateOne(
        { collectionId: source, email: item.email },
        {
          $set: {
            ownerId: userId,
            collectionName: item.category,
            email: item.email,
            lastSource: source,
            marketingOptIn: true,
            ...(!existing?.marketingOptIn ? { marketingOptedInAt: new Date() } : {}),
          },
          $setOnInsert: { collectionId: source },
          $addToSet: { sources: source },
        },
        { upsert: true },
      );
      added += 1;
    }
    return { added };
  }

  async listFavoriteCollections(userId: string) {
    const favorites = await this.favoriteModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    const collectionIds = favorites.map((favorite) => favorite.collectionId);
    const collections = collectionIds.length
      ? await this.collectionModel.find({ _id: { $in: collectionIds } }).lean()
      : [];
    const collectionMap = new Map(
      collections.map((collection) => [collection._id.toString(), collection]),
    );

    return favorites
      .map((favorite) => {
        const collection = collectionMap.get(favorite.collectionId);
        if (!collection) return null;
        return {
          _id: favorite._id,
          collectionId: collection._id.toString(),
          name: collection.name,
          slug: collection.slug,
          coverImage: collection.coverImage,
          eventDate: collection.eventDate,
          url: `/collection/${encodeURIComponent(collection.name)}/${encodeURIComponent(collection.slug ?? collection._id.toString())}`,
          createdAt: favorite.createdAt,
        };
      })
      .filter(Boolean);
  }

  async listFavoriteImages(userId: string) {
    const favorites = await this.imageFavoriteModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    const imageIds = favorites.map((favorite) => favorite.imageId);
    const images = imageIds.length
      ? await this.imageModel.find({ _id: { $in: imageIds } }).lean()
      : [];
    const imageMap = new Map(
      images.map((image) => [image._id.toString(), image]),
    );
    const collectionIds = [
      ...new Set(images.map((image) => image.collectionId)),
    ];
    const collections = collectionIds.length
      ? await this.collectionModel
          .find({ _id: { $in: collectionIds } })
          .select('_id name slug')
          .lean()
      : [];
    const collectionMap = new Map(
      collections.map((collection) => [collection._id.toString(), collection]),
    );

    return favorites
      .map((favorite) => {
        const image = imageMap.get(favorite.imageId);
        if (!image) return null;
        const collection = collectionMap.get(image.collectionId);
        return {
          _id: favorite._id,
          imageId: image._id.toString(),
          collectionId: image.collectionId,
          url: image.url,
          thumbnailUrl: image.thumbnailUrl,
          blurDataUrl: image.blurDataUrl,
          originalName: image.originalName,
          metadata: image.metadata,
          collectionName: collection?.name ?? 'Collection',
          collectionSlug: collection?.slug,
          galleryUrl: collection
            ? `/collection/${encodeURIComponent(collection.name)}/${encodeURIComponent(collection.slug ?? collection._id.toString())}`
            : '',
          createdAt: favorite.createdAt,
        };
      })
      .filter(Boolean);
  }

  async toggleFavoriteCollection(userId: string, identifier: string) {
    const collection = await this.findCollectionByIdentifier(identifier);
    const collectionId = collection._id.toString();
    const existing = await this.favoriteModel
      .findOne({ userId, collectionId })
      .lean();
    if (existing) {
      await this.favoriteModel.deleteOne({ _id: existing._id });
      return { favorited: false, collectionId };
    }

    await this.favoriteModel.updateOne(
      { userId, collectionId },
      { $setOnInsert: { userId, collectionId } },
      { upsert: true },
    );
    return { favorited: true, collectionId };
  }

  async toggleFavoriteImage(userId: string, imageId: string) {
    if (!Types.ObjectId.isValid(imageId))
      throw new BadRequestException('Photo is required');
    const image = await this.imageModel.findOne({ _id: imageId }).lean();
    if (!image) throw new NotFoundException('Image not found');
    const existing = await this.imageFavoriteModel
      .findOne({ userId, imageId })
      .lean();
    if (existing) {
      await this.imageFavoriteModel.deleteOne({ _id: existing._id });
      return { favorited: false, imageId, collectionId: image.collectionId };
    }

    const collection = await this.collectionModel
      .findById(image.collectionId)
      .select('settings')
      .lean();
    const maxFavorites = Number(
      (collection?.settings as any)?.favorite?.maxFavorites || 0,
    );
    if (maxFavorites > 0) {
      const currentCount = await this.imageFavoriteModel.countDocuments({
        userId,
        collectionId: image.collectionId,
      });
      if (currentCount >= maxFavorites) {
        throw new BadRequestException(
          `Favorite limit reached (${maxFavorites})`,
        );
      }
    }

    await this.imageFavoriteModel.updateOne(
      { userId, imageId },
      { $setOnInsert: { userId, imageId, collectionId: image.collectionId } },
      { upsert: true },
    );
    return { favorited: true, imageId, collectionId: image.collectionId };
  }

  async togglePublicFavoriteImage(
    identifier: string,
    imageId: string,
    body: { email?: string },
    siteSlug?: string,
  ) {
    const email = this.cleanEmail(body?.email);
    if (!email) throw new BadRequestException('Email is required');
    if (!Types.ObjectId.isValid(imageId))
      throw new BadRequestException('Photo is required');
    const collection = await this.findCollectionByIdentifier(
      identifier,
      siteSlug,
    );
    if (!this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');
    const collectionId = collection._id.toString();
    const image = await this.imageModel
      .findOne({ _id: imageId, collectionId })
      .select('_id collectionId')
      .lean();
    if (!image) throw new NotFoundException('Image not found');
    const existing = await this.imageFavoriteModel
      .findOne({ userId: email, imageId })
      .lean();
    if (existing) {
      await this.imageFavoriteModel.deleteOne({ _id: existing._id });
      return { favorited: false, imageId, collectionId };
    }

    const favoriteSettings = (collection.settings as any)?.favorite ?? {};
    const maxFavorites = Number(favoriteSettings.maxFavorites || 0);
    if (maxFavorites > 0) {
      const currentCount = await this.imageFavoriteModel.countDocuments({
        userId: email,
        collectionId,
      });
      if (currentCount >= maxFavorites) {
        throw new BadRequestException(
          `Favorite limit reached (${maxFavorites})`,
        );
      }
    }

    await this.imageFavoriteModel.updateOne(
      { userId: email, imageId },
      { $setOnInsert: { userId: email, imageId, collectionId } },
      { upsert: true },
    );
    await this.queueCollectionLifecycle(collection, 'client-favorite', [email], siteSlug).catch(() => undefined);
    return { favorited: true, imageId, collectionId };
  }

  async submitPublicFavoriteSelection(
    identifier: string,
    body: { email?: string; imageIds?: string[] },
    siteSlug?: string,
  ) {
    const email = this.cleanEmail(body?.email);
    if (!email) throw new BadRequestException('Email is required');
    const collection = await this.findCollectionByIdentifier(identifier, siteSlug);
    if (!this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');

    const favoriteSettings = await this.mergedFavoriteSettings(collection);
    if (!this.boolSetting(favoriteSettings.autoShareToPrintShop)) {
      throw new BadRequestException('Print shop handoff is not enabled for this gallery');
    }
    const recipient = this.cleanEmail(favoriteSettings.printShopEmail);
    if (!recipient) throw new BadRequestException('Print shop email is not configured');

    const collectionId = collection._id.toString();
    const favorites = await this.imageFavoriteModel
      .find({ collectionId, userId: email })
      .select('imageId')
      .lean();
    const favoriteIds = new Set(favorites.map((item) => String(item.imageId)));
    const requestedIds = [...new Set((Array.isArray(body?.imageIds) ? body.imageIds : [])
      .map((value) => String(value))
      .filter((value) => Types.ObjectId.isValid(value)))];
    if (!requestedIds.length)
      throw new BadRequestException('No favorite photos are selected');
    if (requestedIds.some((imageId) => !favoriteIds.has(imageId))) {
      throw new BadRequestException('Favorite selection is still syncing. Please try again.');
    }
    const finalIds = requestedIds;

    const images = await this.imageModel
      .find({ collectionId, _id: { $in: finalIds } })
      .select('_id url originalName filename mimetype mediaType sizeBytes order metadata')
      .sort({ order: 1, createdAt: 1 })
      .lean();
    if (!images.length) throw new BadRequestException('Favorite files were not found');

    const attachmentBudget = Math.max(
      0,
      Number(this.configService.get<string>('PRINT_SHOP_EMAIL_ATTACHMENT_MAX_BYTES') || 12 * 1024 * 1024),
    );
    let remainingBytes = attachmentBudget;
    const attachments: GlobalMailAttachment[] = [];
    for (const image of images) {
      if (image.mediaType === 'video' || remainingBytes <= 0) continue;
      const declaredSize = Math.max(0, Number(image.sizeBytes ?? 0));
      if (declaredSize && declaredSize > remainingBytes) continue;
      const attachment = await this.loadPrintShopAttachment(image).catch(() => null);
      if (!attachment || attachment.content.byteLength > remainingBytes) continue;
      attachments.push(attachment);
      remainingBytes -= attachment.content.byteLength;
    }

    const rows = images.map((image, index) => {
      const fileName = this.imageDisplayName(image, `photo-${index + 1}`);
      return {
        number: index + 1,
        fileName,
        url: this.publicPrintShopFileUrl(String(image.url || '')),
      };
    });
    const text = [
      `New completed favorite selection`,
      `Collection: ${collection.name}`,
      `Client: ${email}`,
      `Requested photos: ${rows.length}`,
      `Files attached to this email: ${attachments.length}`,
      '',
      'Requested photo numbers / filenames:',
      ...rows.map((row) => `${row.number}. ${row.fileName}`),
      '',
      'Download links:',
      ...rows.map((row) => `${row.number}. ${row.fileName} - ${row.url}`),
      '',
      attachments.length < rows.length
        ? 'Some files were not attached because of email attachment size limits. Use the download links above for every requested file.'
        : 'All requested photo files are attached.',
    ].join('\n');
    const htmlRows = rows
      .map((row) => `<li><strong>${escapeEmailHtml(row.fileName)}</strong> - <a href="${escapeEmailHtml(row.url)}">download file</a></li>`)
      .join('');
    const html = [
      '<h1>Completed favorite selection</h1>',
      `<p><strong>Collection:</strong> ${escapeEmailHtml(collection.name)}</p>`,
      `<p><strong>Client:</strong> ${escapeEmailHtml(email)}</p>`,
      `<p><strong>Requested photos:</strong> ${rows.length}<br/><strong>Attached files:</strong> ${attachments.length}</p>`,
      '<h2>Requested photo numbers / files</h2>',
      `<ol>${htmlRows}</ol>`,
      attachments.length < rows.length
        ? '<p>Some files were not attached because of email attachment size limits. Every requested file is available from the links above.</p>'
        : '<p>All requested photo files are attached to this email.</p>',
    ].join('');

    const brand = await this.brandingEmailService.loadBrandData(String(collection.userId));
    const brandedHtml = `<div style="font-family:Arial,sans-serif">${html}</div>`;

    const result = await this.mailService.send({
      to: recipient,
      replyTo: email,
      subject: `Print request - ${collection.name} - ${email}`,
      text,
      html: brandedHtml,
      fromName: this.brandingEmailService.senderName(brand),
      attachments,
    });
    return {
      ...result,
      requestedCount: rows.length,
      attachedCount: attachments.length,
      linkedCount: rows.length,
    };
  }

  private async mergedFavoriteSettings(collection: any) {
    const preset = collection.presetId
      ? await this.settingModel.findOne({
          userId: collection.userId,
          type: DashboardSettingType.PRESET,
          localId: collection.presetId,
        }).lean()
      : null;
    const presetData = preset?.data as any;
    return {
      ...(presetData?.favorite ?? presetData?.presetFavorite ?? {}),
      ...((collection.settings as any)?.favorite ?? {}),
    } as Record<string, any>;
  }

  private async loadPrintShopAttachment(image: any): Promise<GlobalMailAttachment | null> {
    const rawUrl = String(image?.url ?? '').trim();
    if (!rawUrl) return null;
    const filename = String(image?.originalName || image?.filename || `photo-${image?._id || 'file'}`);
    const contentType = String(image?.mimetype || '').trim() || undefined;
    if (rawUrl.startsWith('/uploads/')) {
      const relative = rawUrl.split(/[?#]/)[0].replace(/^\/+/, '');
      const content = await readFile(join(cwd(), relative));
      return { filename, content, contentType };
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return null;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const response = await fetch(parsed, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    }).catch(() => null);
    if (!response?.ok) return null;
    const content = new Uint8Array(await response.arrayBuffer());
    return {
      filename,
      content,
      contentType: contentType || response.headers.get('content-type') || undefined,
    };
  }

  private publicPrintShopFileUrl(rawUrl: string) {
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    const base =
      this.configService.get<string>('PUBLIC_BASE_URL') ||
      this.configService.get<string>('BASE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_BASE_URL') ||
      `http://localhost:${this.configService.get<string>('PORT') || '4000'}`;
    try {
      return new URL(rawUrl, base).toString();
    } catch {
      return rawUrl;
    }
  }

  async getCollectionActivity(userId: string, collectionId: string) {
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const [
      collectionFavorites,
      imageFavorites,
      downloads,
      images,
      emailRegistrations,
      privatePhotos,
    ] = await Promise.all([
      this.favoriteModel.find({ collectionId }).sort({ createdAt: -1 }).lean(),
      this.imageFavoriteModel
        .find({ collectionId })
        .sort({ createdAt: -1 })
        .lean(),
      this.downloadActivityModel
        .find({ collectionId })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean(),
      this.imageModel
        .find({ collectionId })
        .select('_id originalName url thumbnailUrl metadata')
        .lean(),
      this.emailRegistrationModel
        .find({ collectionId })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean(),
      this.privatePhotoModel
        .find({ collectionId })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean(),
    ]);

    const userIds = [
      ...new Set([
        ...collectionFavorites.map((favorite) => favorite.userId),
        ...imageFavorites.map((favorite) => favorite.userId),
      ]),
    ];
    const accountUserIds = userIds.filter((id) => Types.ObjectId.isValid(id));
    const users = accountUserIds.length
      ? await this.userModel
          .find({ _id: { $in: accountUserIds } })
          .select('_id email name')
          .lean()
      : [];
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const imageMap = new Map(
      images.map((image) => [image._id.toString(), image]),
    );
    const imageFavoritesByUser = new Map<string, any[]>();

    for (const favorite of imageFavorites) {
      imageFavoritesByUser.set(favorite.userId, [
        ...(imageFavoritesByUser.get(favorite.userId) ?? []),
        favorite,
      ]);
    }

    const favoriteUserIds = [
      ...new Set([
        ...collectionFavorites.map((favorite) => favorite.userId),
        ...imageFavorites.map((favorite) => favorite.userId),
      ]),
    ];
    const favoriteLists = favoriteUserIds.map((favoriteUserId) => {
      const user = userMap.get(favoriteUserId);
      const listImages = imageFavoritesByUser.get(favoriteUserId) ?? [];
      const collectionFavorite = collectionFavorites.find(
        (favorite) => favorite.userId === favoriteUserId,
      );
      const createdDates = [
        collectionFavorite?.createdAt,
        ...listImages.map((favorite) => favorite.createdAt),
      ].filter(Boolean) as Date[];
      const updatedDates = [
        collectionFavorite?.updatedAt,
        ...listImages.map((favorite: any) => favorite.updatedAt),
      ].filter(Boolean) as Date[];

      return {
        id: favoriteUserId,
        email: user?.email || user?.name || favoriteUserId,
        name: 'My Favorites',
        photos: listImages.length,
        filenames: listImages.map(
          (favorite) =>
            this.imageDisplayName(imageMap.get(favorite.imageId), favorite.imageId),
        ),
        images: listImages.map((favorite) => {
          const image = imageMap.get(favorite.imageId);
          return {
            imageId: favorite.imageId,
            name: this.imageDisplayName(image, favorite.imageId),
            url: image?.url || '',
          };
        }),
        createdAt: minDate(createdDates),
        updatedAt: maxDate(updatedDates) ?? minDate(createdDates),
      };
    });

    return {
      favoriteLists,
      downloads: downloads.map((download) => ({
        _id: download._id,
        email: download.email || 'Unknown',
        imageId: download.imageId,
        imageName: download.imageName,
        imageUrl: download.imageUrl,
        downloadType: download.downloadType,
        count: download.count ?? 1,
        createdAt: download.createdAt,
        updatedAt: download.updatedAt,
      })),
      emailRegistrations: emailRegistrations.map((registration) => ({
        _id: registration._id,
        email: registration.email,
        collectionId: registration.collectionId,
        collectionName: registration.collectionName,
        source: registration.lastSource,
        sources: registration.sources ?? [],
        marketingOptIn: registration.marketingOptIn,
        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt,
      })),
      privatePhotos: privatePhotos.map((privatePhoto) => {
        const image = imageMap.get(privatePhoto.imageId);
        return {
          _id: privatePhoto._id,
          email: privatePhoto.email,
          imageId: privatePhoto.imageId,
          imageName: this.imageDisplayName(image, privatePhoto.imageId),
          imageUrl: image?.thumbnailUrl || image?.url || '',
          status: privatePhoto.status ?? 'pending',
          createdAt: privatePhoto.createdAt,
          updatedAt: privatePhoto.updatedAt,
        };
      }),
    };
  }

  async recordPublicDownloadActivity(
    identifier: string,
    body: {
      email?: string;
      items?: Array<{
        imageId?: string;
        imageName?: string;
        imageUrl?: string;
      }>;
      downloadType?: 'single' | 'all';
    },
    siteSlug?: string,
  ) {
    const collection = await this.findCollectionByIdentifier(
      identifier,
      siteSlug,
    );
    if (!this.isPublicCollectionVisible(collection))
      throw new NotFoundException('Collection not found');
    const owner = await this.userModel
      .findById(collection.userId)
      .select('planFeatures')
      .lean();
    if (!owner?.planFeatures?.downloads) {
      throw new BadRequestException('Current plan does not allow Downloads.');
    }
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@'))
      throw new BadRequestException('Email is required');
    const items = Array.isArray(body?.items) ? body.items.slice(0, 250) : [];
    if (!items.length)
      throw new BadRequestException('Download item is required');
    const downloadType = body.downloadType === 'all' ? 'all' : 'single';
    const collectionId = collection._id.toString();

    for (const item of items) {
      const imageId =
        item.imageId && Types.ObjectId.isValid(item.imageId)
          ? item.imageId
          : '';
      await this.downloadActivityModel.updateOne(
        {
          collectionId,
          email,
          imageId: imageId ?? '',
          imageName: String(item.imageName ?? ''),
          downloadType,
        },
        {
          $set: {
            collectionId,
            email,
            imageId,
            imageName: String(item.imageName ?? ''),
            imageUrl: String(item.imageUrl ?? ''),
            downloadType,
          },
          $inc: { count: 1 },
        },
        { upsert: true },
      );
    }

    return { saved: items.length };
  }

  async deleteFavoriteInfo(
    userId: string,
    collectionId: string,
    favoriteUserId: string,
  ) {
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    const [collectionResult, imageResult] = await Promise.all([
      this.favoriteModel.deleteMany({ collectionId, userId: favoriteUserId }),
      this.imageFavoriteModel.deleteMany({
        collectionId,
        userId: favoriteUserId,
      }),
    ]);
    return {
      deleted:
        (collectionResult.deletedCount ?? 0) + (imageResult.deletedCount ?? 0),
    };
  }

  async deleteFavoriteImageInfo(
    userId: string,
    collectionId: string,
    favoriteUserId: string,
    imageId: string,
  ) {
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    if (!Types.ObjectId.isValid(imageId))
      throw new BadRequestException('Photo is required');
    const result = await this.imageFavoriteModel.deleteOne({
      collectionId,
      userId: favoriteUserId,
      imageId,
    });
    return { deleted: result.deletedCount ?? 0 };
  }

  async updatePrivatePhotoRequest(
    userId: string,
    collectionId: string,
    privatePhotoId: string,
    status: 'pending' | 'approved' | 'declined',
  ) {
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .select('_id')
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    if (!Types.ObjectId.isValid(privatePhotoId))
      throw new BadRequestException('Private photo request is required');
    const record = await this.privatePhotoModel
      .findOneAndUpdate(
        { _id: privatePhotoId, collectionId },
        { $set: { status } },
        { returnDocument: 'after' },
      )
      .lean();
    if (!record) throw new NotFoundException('Private photo request not found');
    return {
      _id: record._id,
      status: record.status,
      imageId: record.imageId,
      email: record.email,
    };
  }

  async deletePrivatePhotoRequest(
    userId: string,
    collectionId: string,
    privatePhotoId: string,
  ) {
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .select('_id')
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    if (!Types.ObjectId.isValid(privatePhotoId))
      throw new BadRequestException('Private photo request is required');
    const result = await this.privatePhotoModel.deleteOne({
      _id: privatePhotoId,
      collectionId,
    });
    return { deleted: result.deletedCount ?? 0 };
  }

  async copyFavoriteListToSet(
    userId: string,
    collectionId: string,
    favoriteUserId: string,
    name?: string,
  ) {
    const collection = await this.collectionModel.findOne({
      _id: collectionId,
      userId,
    });
    if (!collection) throw new NotFoundException('Collection not found');
    const images = await this.favoriteImagesForUser(
      collectionId,
      favoriteUserId,
    );
    if (!images.length)
      throw new BadRequestException('No favorite photos to copy');

    const set = {
      id: `set-${Date.now()}`,
      name: name?.trim() || 'Favorite Selection',
      createdAt: new Date(),
    };
    const copies = images.map((image) => ({
      userId,
      collectionId,
      setId: set.id,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      blurDataUrl: image.blurDataUrl,
      originalName: image.originalName,
      filename: image.filename,
      mimetype: image.mimetype,
      sizeBytes: image.sizeBytes,
      watermarked: image.watermarked,
      metadata: image.metadata ?? {},
    }));

    await this.imageModel.insertMany(copies);
    collection.sets = [...(collection.sets ?? []), set];
    collection.imageCount = (collection.imageCount ?? 0) + copies.length;
    await collection.save();
    const copiedBytes = copies.reduce(
      (sum, c) => sum + Math.max(0, Number(c.sizeBytes ?? 0)),
      0,
    );
    if (copiedBytes > 0) {
      await this.userModel.updateOne(
        { _id: userId },
        { $inc: { storageUsedBytes: copiedBytes } },
      );
    }
    return { set, copied: copies.length };
  }

  async copyFavoriteListToCollection(
    userId: string,
    collectionId: string,
    favoriteUserId: string,
    name?: string,
  ) {
    const source = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .lean();
    if (!source) throw new NotFoundException('Collection not found');
    const images = await this.favoriteImagesForUser(
      collectionId,
      favoriteUserId,
    );
    if (!images.length)
      throw new BadRequestException('No favorite photos to copy');

    const set = { id: 'highlights', name: 'Featured', createdAt: new Date() };
    const collection = await this.collectionModel.create({
      userId,
      name: name?.trim() || `${source.name} Favorites`,
      slug: await this.uniqueSlug(
        userId,
        name?.trim() || `${source.name} Favorites`,
      ),
      eventDate: source.eventDate,
      presetId: source.presetId,
      coverImage: images[0]?.url,
      sets: [set],
      tags: source.tags ?? [],
      watermarkId: source.watermarkId,
      design: source.design ?? {},
      settings: source.settings ?? {},
      imageCount: images.length,
      status: 'draft',
    });
    const imageRecords = images.map((image) => ({
      userId,
      collectionId: collection._id.toString(),
      setId: set.id,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      blurDataUrl: image.blurDataUrl,
      originalName: image.originalName,
      filename: image.filename,
      mimetype: image.mimetype,
      sizeBytes: image.sizeBytes,
      watermarked: image.watermarked,
      metadata: image.metadata ?? {},
    }));
    await this.imageModel.insertMany(imageRecords);
    const copiedBytes = imageRecords.reduce(
      (sum, r) => sum + Math.max(0, Number(r.sizeBytes ?? 0)),
      0,
    );
    if (copiedBytes > 0) {
      await this.userModel.updateOne(
        { _id: userId },
        { $inc: { storageUsedBytes: copiedBytes } },
      );
    }
    return { collection: collection.toObject(), copied: images.length };
  }

  private async favoriteImagesForUser(
    collectionId: string,
    favoriteUserId: string,
  ) {
    const favorites = await this.imageFavoriteModel
      .find({ collectionId, userId: favoriteUserId })
      .lean();
    const imageIds = favorites
      .map((favorite) => favorite.imageId)
      .filter((id) => Types.ObjectId.isValid(id));
    if (!imageIds.length) return [];
    return this.imageModel
      .find({ collectionId, _id: { $in: imageIds } })
      .lean();
  }

  async findAllImages(userId: string) {
    const images = await this.imageModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    const collectionIds = [
      ...new Set(images.map((image) => image.collectionId)),
    ];
    const collections = await this.collectionModel
      .find({ userId, _id: { $in: collectionIds } })
      .select('_id name sets')
      .lean();
    const collectionMap = new Map(
      collections.map((collection) => [collection._id.toString(), collection]),
    );

    return images.map((image) => {
      const collection = collectionMap.get(image.collectionId);
      const set = collection?.sets?.find((item) => item.id === image.setId);

      return {
        ...image,
        collectionName: collection?.name ?? 'Collection',
        setName: set?.name ?? 'Featured',
      };
    });
  }

  async update(userId: string, id: string, dto: UpdateCollectionDto) {
    const collection = await this.collectionModel.findOne({ _id: id, userId });
    if (!collection) throw new NotFoundException('Collection not found');
    const wasPublished = collection.status === 'published';
    dto = await this.sanitizeCollectionCapabilities(userId, dto, id);
    const currentSettings = ((collection.settings ?? {}) as Record<string, any>);
    const currentAccess = ((currentSettings.access ?? {}) as Record<string, any>);
    const previousPublishRecipients = this.cleanEmailList(
      Array.isArray(currentAccess.publishRecipientEmails)
        ? currentAccess.publishRecipientEmails
        : collection.clientEmails,
    );
    const nextPublishRecipients = dto.clientEmails !== undefined
      ? this.cleanEmailList(dto.clientEmails)
      : this.cleanEmailList(collection.clientEmails);
    const requestedSettings = dto.settings !== undefined
      ? ((dto.settings ?? {}) as Record<string, any>)
      : currentSettings;
    const requestedAccess = ((requestedSettings.access ?? currentAccess) as Record<string, any>);
    const requestedAllowedEmails = this.cleanEmailList(
      Array.isArray(requestedAccess.allowedEmails) ? requestedAccess.allowedEmails : [],
    );
    const manualAllowedEmails = requestedAllowedEmails.filter(
      (email) => !previousPublishRecipients.includes(email),
    );
    const syncedSettings = {
      ...requestedSettings,
      access: {
        ...requestedAccess,
        allowedEmails: this.cleanEmailList([
          ...manualAllowedEmails,
          ...nextPublishRecipients,
        ]),
        publishRecipientEmails: nextPublishRecipients,
      },
    };

    if (dto.name !== undefined) {
      collection.name = dto.name;
      collection.slug = await this.uniqueSlug(userId, dto.name, id);
    }
    if (dto.slug !== undefined) {
      collection.slug = await this.uniqueSlug(userId, dto.slug, id);
    }
    if (dto.eventDate !== undefined)
      collection.eventDate = new Date(dto.eventDate);
    if (dto.presetId !== undefined)
      collection.presetId = dto.presetId || undefined;
    if (dto.coverImage !== undefined)
      collection.coverImage = dto.coverImage || undefined;
    if (dto.sets !== undefined) {
      const currentSets = collection.sets ?? [];
      const currentById = new Map(currentSets.map((set) => [String(set.id), set]));
      const seenSetIds = new Set<string>();
      const nextSets = dto.sets.map((set) => {
        const setId = String(set.id ?? '').trim();
        const setName = String(set.name ?? '').trim();
        if (!setId || !setName)
          throw new BadRequestException('Every set requires an id and name');
        if (seenSetIds.has(setId))
          throw new BadRequestException('Duplicate set ids are not allowed');
        seenSetIds.add(setId);
        const currentSet = currentById.get(setId);
        return {
          id: setId,
          name: setName,
          watermarkId: set.watermarkId || currentSet?.watermarkId || undefined,
          createdAt: set.createdAt
            ? new Date(set.createdAt)
            : currentSet?.createdAt ?? new Date(),
        };
      });
      const nextSetIds = nextSets.map((set) => set.id);
      const removedSetIds = currentSets
        .map((set) => String(set.id))
        .filter((setId) => !seenSetIds.has(setId));
      if (removedSetIds.length && dto.allowSetRemoval !== true) {
        throw new BadRequestException(
          'Removing a set requires an explicit delete action',
        );
      }
      const fallbackSetId = nextSetIds[0] ?? 'highlights';
      if (removedSetIds.length) {
        await this.imageModel.updateMany(
          { userId, collectionId: id, setId: { $in: removedSetIds } },
          { $set: { setId: fallbackSetId } },
        );
      }
      collection.sets = nextSets.length
        ? nextSets
        : [{ id: 'highlights', name: 'Featured', createdAt: new Date() }];
    }
    if (dto.tags !== undefined) collection.tags = [...new Set(dto.tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20);
    if (dto.clientEmails !== undefined) collection.clientEmails = nextPublishRecipients;
    if (dto.watermarkId !== undefined)
      collection.watermarkId = dto.watermarkId || undefined;
    if (dto.expiresAt !== undefined)
      collection.expiresAt = this.expiryDate(dto.expiresAt);
    if (dto.status !== undefined) collection.status = dto.status;
    if (dto.showOnHomepage !== undefined)
      collection.showOnHomepage = dto.showOnHomepage;
    if (dto.homepageSiteIds !== undefined)
      collection.homepageSiteIds = await this.validateHomepageSiteIds(userId, dto.homepageSiteIds);
    if (dto.design !== undefined) collection.design = dto.design;
    if (dto.settings !== undefined || dto.clientEmails !== undefined)
      collection.settings = syncedSettings;
    // Keep the legacy duplicated photoSets setting derived from the authoritative
    // set records so unrelated updates can never write stale set names back.
    this.syncCollectionSetNamesInSettings(collection);

    await collection.save();
    if (
      dto.watermarkId !== undefined ||
      dto.presetId !== undefined ||
      dto.sets !== undefined
    ) {
      await this.invalidateCollectionImageCache(id).catch(() => undefined);
    }
    if (!wasPublished && collection.status === 'published') {
      await this.queuePublishedCollection(collection).catch(() => undefined);
    } else if (wasPublished && collection.status === 'published') {
      const lifecycleKeys = [
        'name',
        'eventDate',
        'coverImage',
        'sets',
        'tags',
        'clientEmails',
        'watermarkId',
        'expiresAt',
        'homepageSiteIds',
        'design',
        'settings',
      ];
      const shouldNotifyGalleryUpdate = lifecycleKeys.some(
        (key) => (dto as Record<string, unknown>)[key] !== undefined,
      );
      if (shouldNotifyGalleryUpdate) {
        const eventId = this.galleryUpdateEventId(id);
        await this.queueUpdatedCollection(collection, eventId).catch(
          () => undefined,
        );
      }
    }
    return collection.toObject();
  }

  async duplicate(userId: string, id: string) {
    const source = await this.collectionModel
      .findOne({ _id: id, userId })
      .lean();
    if (!source) throw new NotFoundException('Collection not found');

    const images = await this.imageModel
      .find({ collectionId: id, userId })
      .select('+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes')
      .sort({ order: 1, createdAt: -1 })
      .lean();
    const name = `${source.name} Copy`;
    const collection = await this.collectionModel.create({
      userId,
      name,
      slug: await this.uniqueSlug(userId, name),
      eventDate: source.eventDate,
      presetId: source.presetId,
      coverImage: source.coverImage,
      sets: source.sets ?? [
        { id: 'highlights', name: 'Featured', createdAt: new Date() },
      ],
      tags: source.tags ?? [],
      clientEmails: source.clientEmails ?? [],
      watermarkId: source.watermarkId,
      expiresAt: source.expiresAt,
      design: source.design ?? {},
      settings: source.settings ?? {},
      imageCount: images.length,
      status: 'draft',
      showOnHomepage: source.showOnHomepage !== false,
      homepageSiteIds: Array.isArray(source.homepageSiteIds) && source.homepageSiteIds.length
        ? source.homepageSiteIds
        : ['main'],
    });

    if (images.length) {
      await this.imageModel.insertMany(
        images.map((image) => ({
          userId,
          collectionId: collection._id.toString(),
          setId: image.setId,
          url: image.url,
          thumbnailUrl: image.thumbnailUrl,
          blurDataUrl: image.blurDataUrl,
          originalName: image.originalName,
          filename: image.filename,
          originalObjectKey: image.originalObjectKey,
          originalFilename: image.originalFilename,
          originalMimeType: image.originalMimeType,
          originalSizeBytes: image.originalSizeBytes,
          mimetype: image.mimetype,
          sizeBytes: image.sizeBytes,
          watermarked: image.watermarked,
          metadata: (() => {
            const metadata = { ...((image.metadata ?? {}) as Record<string, any>) };
            delete metadata.imageCache;
            return metadata;
          })(),
          order: image.order,
        })),
      );
      // A duplicated gallery reuses the same stored objects. Do not charge
      // storage twice when no physical R2 bytes were copied.
    }

    return { collection: collection.toObject(), copied: images.length };
  }

  async remove(userId: string, id: string) {
    const collection = await this.collectionModel.findOne({ _id: id, userId });
    if (!collection) throw new NotFoundException('Collection not found');

    const images = await this.imageModel
      .find({ collectionId: id, userId })
      .select('+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes');
    const candidatePrivateKeys = [
      ...new Set(
        images
          .flatMap((image) => [
            String(image.originalObjectKey ?? '').trim(),
            String(
              (image.metadata as Record<string, any> | undefined)
                ?.directUploadObjectKey ?? '',
            ).trim(),
          ])
          .filter(Boolean),
      ),
    ];
    const sharedRows = candidatePrivateKeys.length
      ? await this.imageModel
          .find({
            userId,
            collectionId: { $ne: id },
            $or: [
              { originalObjectKey: { $in: candidatePrivateKeys } },
              {
                'metadata.directUploadObjectKey': {
                  $in: candidatePrivateKeys,
                },
              },
            ],
          })
          .select('+originalObjectKey metadata')
          .lean()
      : [];
    const sharedPrivateKeys = new Set(
      sharedRows
        .flatMap((image) => [
          String(image.originalObjectKey ?? '').trim(),
          String(
            (image.metadata as Record<string, any> | undefined)
              ?.directUploadObjectKey ?? '',
          ).trim(),
        ])
        .filter(Boolean),
    );
    const reclaimedBytes = images.reduce((sum, image) => {
      const metadata = (image.metadata ?? {}) as Record<string, any>;
      const storageKey =
        String(image.originalObjectKey ?? '').trim() ||
        String(metadata.directUploadObjectKey ?? '').trim();
      if (storageKey && sharedPrivateKeys.has(storageKey)) return sum;
      return sum + Math.max(0, Number(image.sizeBytes ?? 0));
    }, 0);

    await Promise.all([
      this.imageModel.deleteMany({ collectionId: id, userId }),
      this.favoriteModel.deleteMany({ collectionId: id }),
      this.imageFavoriteModel.deleteMany({ collectionId: id }),
      this.downloadActivityModel.deleteMany({ collectionId: id }),
      this.collectionModel.deleteOne({ _id: id, userId }),
    ]);

    await this.decrementStorageUsedBytes(userId, reclaimedBytes);

    // Public/account state is removed first. Slow object-storage and face-index cleanup continues concurrently.
    void Promise.allSettled([
      ...images.map((image) => this.deleteStoredImageFiles(image)),
      this.faceSearchService.deleteCollectionFaces(id),
    ]);

    return { deleted: true, collectionId: id };
  }

  async addSet(userId: string, collectionId: string, name: string) {
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException('Set name is required');

    const collection = await this.collectionModel.findOne({
      _id: collectionId,
      userId,
    });
    if (!collection) throw new NotFoundException('Collection not found');

    const set = {
      id: `set-${Date.now()}`,
      name: trimmed,
      createdAt: new Date(),
    };
    collection.sets = [...(collection.sets ?? []), set];
    this.syncCollectionSetNamesInSettings(collection);
    await collection.save();
    return set;
  }

  async renameSet(
    userId: string,
    collectionId: string,
    setId: string,
    name: string,
  ) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new BadRequestException('Set name is required');

    const collection = await this.collectionModel.findOne({
      _id: collectionId,
      userId,
    });
    if (!collection) throw new NotFoundException('Collection not found');

    const target = collection.sets?.find((set) => String(set.id) === setId);
    if (!target) throw new NotFoundException('Set not found');
    if (target.name === trimmed) return collection.toObject();

    target.name = trimmed;
    this.syncCollectionSetNamesInSettings(collection);
    await collection.save();
    return collection.toObject();
  }

  async reorderSets(
    userId: string,
    collectionId: string,
    setIds: string[],
  ) {
    if (!Array.isArray(setIds) || !setIds.length)
      throw new BadRequestException('Set order is required');

    const collection = await this.collectionModel.findOne({
      _id: collectionId,
      userId,
    });
    if (!collection) throw new NotFoundException('Collection not found');

    const currentSets = collection.sets ?? [];
    const normalizedIds = setIds.map((id) => String(id ?? '').trim());
    if (
      normalizedIds.length !== currentSets.length ||
      new Set(normalizedIds).size !== currentSets.length
    ) {
      throw new BadRequestException('Set order must contain every set exactly once');
    }

    const currentById = new Map(currentSets.map((set) => [String(set.id), set]));
    if (normalizedIds.some((id) => !currentById.has(id)))
      throw new BadRequestException('Set order contains an unknown set');

    const currentIds = currentSets.map((set) => String(set.id));
    if (normalizedIds.every((id, index) => id === currentIds[index]))
      return collection.toObject();

    collection.sets = normalizedIds.map((id) => currentById.get(id)!);
    this.syncCollectionSetNamesInSettings(collection);
    await collection.save();
    return collection.toObject();
  }

  async deleteSet(userId: string, collectionId: string, setId: string) {
    const collection = await this.collectionModel.findOne({
      _id: collectionId,
      userId,
    });
    if (!collection) throw new NotFoundException('Collection not found');

    const currentSets = collection.sets ?? [];
    if (currentSets.length <= 1)
      throw new BadRequestException('A collection must keep at least one set');

    const target = currentSets.find((set) => String(set.id) === setId);
    if (!target) throw new NotFoundException('Set not found');

    const [images, processingJobs] = await Promise.all([
      this.imageModel
        .find({ userId, collectionId, setId })
        .select(
          '+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes',
        )
        .lean(),
      this.imageProcessingJobModel
        .find({ userId, collectionId, setId })
        .select('objectKey status')
        .lean(),
    ]);

    const deletedIds = images.map((image) => image._id.toString());
    const candidatePrivateKeys = [
      ...new Set(
        images
          .flatMap((image) => [
            String(image.originalObjectKey ?? '').trim(),
            String(
              (image.metadata as Record<string, any> | undefined)
                ?.directUploadObjectKey ?? '',
            ).trim(),
          ])
          .filter(Boolean),
      ),
    ];
    const sharedRows = candidatePrivateKeys.length
      ? await this.imageModel
          .find({
            _id: { $nin: deletedIds },
            $or: [
              { originalObjectKey: { $in: candidatePrivateKeys } },
              {
                'metadata.directUploadObjectKey': {
                  $in: candidatePrivateKeys,
                },
              },
            ],
          })
          .select('+originalObjectKey metadata')
          .lean()
      : [];
    const sharedPrivateKeys = new Set(
      sharedRows
        .flatMap((image) => [
          String(image.originalObjectKey ?? '').trim(),
          String(
            (image.metadata as Record<string, any> | undefined)
              ?.directUploadObjectKey ?? '',
          ).trim(),
        ])
        .filter(Boolean),
    );
    const now = new Date();

    // Queue the physical R2/public-file cleanup before removing DB records.
    // The delete worker retries failures in the background and also removes face data.
    for (let offset = 0; offset < images.length; offset += 500) {
      const batch = images.slice(offset, offset + 500);
      await this.imageDeleteJobModel.bulkWrite(
        batch.map((image) => {
          const metadata = (image.metadata ?? {}) as Record<string, any>;
          const directObjectKey = String(
            metadata.directUploadObjectKey ?? '',
          ).trim();
          const storageMode = String(metadata.storageMode ?? '');
          const publicReferences =
            ['original-imgproxy', 'original-imagor'].includes(storageMode)
              ? []
              : [image.url, image.thumbnailUrl, image.filename].filter(
                  Boolean,
                ) as string[];
          const privateObjectKeys = [
            String(image.originalObjectKey ?? '').trim(),
            directObjectKey,
          ].filter(
            (key) => Boolean(key) && !sharedPrivateKeys.has(key),
          ) as string[];

          return {
            updateOne: {
              filter: { imageId: image._id.toString() },
              update: {
                $setOnInsert: {
                  userId,
                  collectionId,
                  imageId: image._id.toString(),
                  publicReferences: [...new Set(publicReferences)],
                  privateObjectKeys: [...new Set(privateObjectKeys)],
                  status: 'queued',
                  attempts: 0,
                  nextAttemptAt: now,
                  lastError: '',
                },
              },
              upsert: true,
            },
          };
        }),
        { ordered: false },
      );
    }

    const directObjectKeys = [
      ...new Set(
        images
          .flatMap((image) => [
            String(image.originalObjectKey ?? '').trim(),
            String(
              (image.metadata as Record<string, any> | undefined)
                ?.directUploadObjectKey ?? '',
            ).trim(),
          ])
          .filter(Boolean),
      ),
    ];
    const unfinishedUploadObjectKeys = [
      ...new Set(
        processingJobs
          .map((job) => String(job.objectKey ?? '').trim())
          .filter(
            (objectKey) =>
              Boolean(objectKey) && !sharedPrivateKeys.has(objectKey),
          ),
      ),
    ];

    await Promise.all([
      this.imageModel.deleteMany({ userId, collectionId, setId }),
      deletedIds.length
        ? this.imageFavoriteModel.deleteMany({
            collectionId,
            imageId: { $in: deletedIds },
          })
        : Promise.resolve(),
      this.imageProcessingJobModel.deleteMany({ userId, collectionId, setId }),
      directObjectKeys.length
        ? this.imageProcessingJobModel.deleteMany({
            userId,
            collectionId,
            objectKey: { $in: directObjectKeys },
          })
        : Promise.resolve(),
    ]);

    const reclaimedBytes = images.reduce((sum, image) => {
      const metadata = (image.metadata ?? {}) as Record<string, any>;
      const storageKey =
        String(image.originalObjectKey ?? '').trim() ||
        String(metadata.directUploadObjectKey ?? '').trim();
      if (storageKey && sharedPrivateKeys.has(storageKey)) return sum;
      return sum + Math.max(0, Number(image.sizeBytes ?? 0));
    }, 0);
    if (reclaimedBytes > 0)
      await this.decrementStorageUsedBytes(userId, reclaimedBytes);

    const deletedUrls = new Set(
      images.flatMap((image) => [image.url, image.thumbnailUrl]).filter(Boolean),
    );
    if (collection.coverImage && deletedUrls.has(collection.coverImage)) {
      const nextCover = await this.imageModel
        .findOne({ userId, collectionId })
        .sort({ order: 1, createdAt: 1 })
        .select('url')
        .lean();
      collection.coverImage = nextCover?.url || undefined;
    }

    collection.imageCount = Math.max(
      0,
      Number(collection.imageCount ?? 0) - images.length,
    );
    collection.sets = currentSets.filter((set) => String(set.id) !== setId);
    this.syncCollectionSetNamesInSettings(collection);
    await collection.save();

    // Jobs that had not produced a gallery image yet still own a raw private R2
    // object. Remove those asynchronously so deleting a set also clears uploads
    // that were pending in the background.
    if (unfinishedUploadObjectKeys.length) {
      void Promise.allSettled(
        unfinishedUploadObjectKeys.map((objectKey) =>
          this.minioService.deletePrivateFile(objectKey),
        ),
      );
    }

    return {
      ...collection.toObject(),
      deletedImageCount: images.length,
    };
  }

  private syncCollectionSetNamesInSettings(collection: CollectionDocument) {
    const settings = (collection.settings ?? {}) as Record<string, unknown>;
    const general = (settings.general ?? {}) as Record<string, unknown>;
    collection.settings = {
      ...settings,
      general: {
        ...general,
        photoSets: (collection.sets ?? []).map((set) => set.name).join(', '),
      },
    };
  }

  async reorderImages(
    userId: string,
    collectionId: string,
    imageIds: string[],
  ) {
    if (!Array.isArray(imageIds) || !imageIds.length) {
      throw new BadRequestException('Image order is required');
    }
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const images = await this.imageModel
      .find({ collectionId, userId, _id: { $in: imageIds } })
      .select('_id')
      .lean();
    const validIds = new Set(images.map((image) => image._id.toString()));
    const orderedIds = imageIds.filter((id) => validIds.has(id));
    if (!orderedIds.length)
      throw new BadRequestException('No valid images to reorder');

    await this.imageModel.bulkWrite(
      orderedIds.map((imageId, index) => ({
        updateOne: {
          filter: { _id: imageId, collectionId, userId },
          update: { $set: { order: index + 1 } },
        },
      })),
    );
    if (collection.status === 'published') {
      await this.queueUpdatedCollection(
        collection,
        this.galleryUpdateEventId(collectionId),
      ).catch(() => undefined);
    }

    return { updated: orderedIds.length };
  }

  async uploadImages(
    userId: string,
    collectionId: string,
    files: Express.Multer.File[],
    setId?: string,
    uploadWatermarkId?: string,
    metadataOverrides: ImageMetadataDefaults = {},
  ) {
    if (!files?.length) throw new BadRequestException('Files are required');
    this.assertImageFiles(files);
    const owner = await this.ensureStorageAvailable(
      userId,
      files.reduce((sum, file) => sum + (file.size ?? 0), 0),
    );
    const photographer = String(
      owner?.name || owner?.username || owner?.businessName || '',
    ).trim();
    const credit = String(
      owner?.businessName || owner?.name || owner?.username || '',
    ).trim();
    const metadataDefaults: ImageMetadataDefaults = {
      photographer,
      credit,
      source: credit,
      ...metadataOverrides,
    };

    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    const activeSet = setId
      ? collection.sets?.find((set) => set.id === setId)
      : collection.sets?.[0];
    if (setId && !activeSet) throw new NotFoundException('Set not found');
    const resolvedSetId = activeSet?.id || 'highlights';
    const watermark = uploadWatermarkId
      ? await this.resolveWatermarkById(userId, uploadWatermarkId)
      : activeSet?.watermarkId
        ? await this.resolveWatermarkById(userId, activeSet.watermarkId)
        : collection.watermarkId
          ? await this.resolveWatermarkById(userId, collection.watermarkId)
          : collection.presetId
            ? await this.resolveWatermark(userId, collection.presetId)
            : null;

    const lastImage = await this.imageModel
      .findOne({ collectionId, userId })
      .sort({ order: -1, createdAt: -1 })
      .select('order')
      .lean();
    const nextOrder = Math.max(0, Number(lastImage?.order ?? 0));
    const uploaded = await this.mapWithConcurrency(
      files,
      this.imageProcessingConcurrency(),
      (file, index) =>
        this.processAndSaveImage(
          userId,
          collectionId,
          file,
          watermark,
          resolvedSetId,
          nextOrder + index + 1,
          metadataDefaults,
        ),
    );

    await this.collectionModel.updateOne(
      { _id: collectionId, userId },
      {
        $inc: { imageCount: uploaded.length },
        $set: {
          coverImage: collection.coverImage ?? uploaded[0]?.url,
          ...(this.imagorService.isEnabled() && uploaded.length
            ? {
                imageCacheStatus: 'warming',
                imageCacheVersion: IMAGE_CACHE_VERSION,
              }
            : {}),
        },
        ...(this.imagorService.isEnabled() && uploaded.length
          ? { $unset: { imageCacheReadyAt: 1 } }
          : {}),
      },
    );
    await this.imageMetadataAiService.enqueueMany(uploaded).catch((error) => {
      console.warn('Could not queue AI image metadata:', error?.message ?? error);
    });
    // Keep only the tiny fields face indexing needs so large upload batches are not
    // retained in memory while waiting for the low-priority background lane.
    const faceQueue: FaceIndexQueueImage[] = uploaded.map((image) => ({
      _id: image._id,
      userId: image.userId,
      collectionId: image.collectionId,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      originalObjectKey: image.originalObjectKey,
      metadata: image.metadata,
      width: image.width,
      height: image.height,
    }));
    setTimeout(() => {
      void this.indexFacesInBackground(faceQueue);
    }, this.backgroundFaceStartDelayMs());
    if (collection.status === 'published' && uploaded.length) {
      await this.queueUpdatedCollection(
        collection,
        this.galleryUpdateEventId(collectionId),
      ).catch(() => undefined);
    }

    return uploaded;
  }

  async createDirectUploads(
    userId: string,
    collectionId: string,
    files: Array<{
      name: string;
      type: string;
      size: number;
      durationSeconds?: number;
      width?: number;
      height?: number;
    }>,
    setId?: string,
    watermarkId?: string,
    replaceImageId?: string,
  ) {
    if (!Array.isArray(files) || !files.length || files.length > 500)
      throw new BadRequestException('1 to 500 files are required');
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .select('sets')
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    const activeSet = setId
      ? collection.sets?.find((set) => set.id === setId)
      : collection.sets?.[0];
    if (setId && !activeSet) throw new NotFoundException('Set not found');
    const resolvedSetId = activeSet?.id || 'highlights';
    const uploadScope = `collections/${collectionId}/sets/${resolvedSetId}`;

    await this.ensureStorageAvailable(
      userId,
      files.reduce((sum, file) => sum + Math.max(0, Number(file.size)), 0),
    );
    await this.ensureVideoPlanAvailable(userId, files);

    const tickets = await Promise.all(
      files.map((file) =>
        this.minioService.createDirectUpload(userId, file, {
          privateImage: true,
          scope: uploadScope,
        }),
      ),
    );

    const durableUploadJobs = files.map((input, index) => ({
      input,
      ticket: tickets[index],
    }));
    if (durableUploadJobs.length) {
      await this.imageProcessingJobModel.bulkWrite(
        durableUploadJobs.map(({ input, ticket }) => ({
          updateOne: {
            filter: { objectKey: ticket.objectKey },
            update: {
              $setOnInsert: {
                userId,
                collectionId,
                setId: resolvedSetId,
                watermarkId,
                replaceImageId,
                objectKey: ticket.objectKey,
                uploadId:
                  (ticket as { uploadId?: string }).uploadId || undefined,
                multipartPartCount: Array.isArray(
                  (ticket as { parts?: unknown[] }).parts,
                )
                  ? (ticket as { parts?: unknown[] }).parts!.length
                  : 0,
                name: input.name,
                type: input.type,
                size: input.size,
                durationSeconds: this.safeSeconds(input.durationSeconds),
                width: this.safeDimension(input.width),
                height: this.safeDimension(input.height),
                status: 'awaiting-upload',
                attempts: 0,
                lastError: '',
                resultMode: '',
                nextAttemptAt: new Date(Date.now() + 10_000),
                statusMessage:
                  'Upload authorized. Backend will automatically take over as soon as the raw file reaches R2.',
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    return tickets;
  }

  async completeDirectUploads(
    userId: string,
    collectionId: string,
    files: DirectUploadFile[],
    setId?: string,
    watermarkId?: string,
    replaceImageId?: string,
  ) {
    if (!Array.isArray(files) || !files.length || files.length > 100)
      throw new BadRequestException('1 to 100 completed files are required');

    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .select('userId name slug status clientEmails sets watermarkId presetId coverImage')
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    const activeSet = setId
      ? collection.sets?.find((set) => set.id === setId)
      : collection.sets?.[0];
    if (setId && !activeSet) throw new NotFoundException('Set not found');
    const resolvedSetId = activeSet?.id || 'highlights';
    const uploadScope = `collections/${collectionId}/sets/${resolvedSetId}`;

    const verified = await this.mapWithConcurrency(
      files,
      24,
      async (file) => {
        let verified:
          | Awaited<ReturnType<MinioService['verifyDirectUpload']>>
          | undefined;
        if (file.uploadId && file.parts?.length) {
          try {
            await this.minioService.completeDirectMultipartUpload(
              userId,
              {
                objectKey: file.objectKey,
                uploadId: file.uploadId,
                parts: file.parts,
              },
              uploadScope,
            );
          } catch (error) {
            verified = await this.minioService
              .verifyDirectUpload(userId, file, uploadScope)
              .catch(() => undefined);
            if (!verified) throw error;
          }
        }
        return {
          ...file,
          ...(verified ??
            (await this.minioService.verifyDirectUpload(
              userId,
              file,
              uploadScope,
            ))),
        };
      },
    );
    await this.ensureStorageAvailable(
      userId,
      verified.reduce((sum, file) => sum + file.size, 0),
    );
    await this.ensureVideoPlanAvailable(userId, verified);
    const savedVideos: any[] = [];
    if (verified.some((file) => this.mediaType(file.type) === 'video')) {
      const lastImage = await this.imageModel
        .findOne({ collectionId, userId })
        .sort({ order: -1, createdAt: -1 })
        .select('order')
        .lean();
      const startOrder = Math.max(0, Number(lastImage?.order ?? 0));
      let videoOrder = 0;
      let newVideoCount = 0;
      for (const file of verified) {
        if (this.mediaType(file.type) === 'image') continue;
        const existingVideo = await this.imageModel
          .findOne({
            userId,
            collectionId,
            'metadata.directUploadObjectKey': file.objectKey,
          })
          .lean();
        if (existingVideo) {
          savedVideos.push(this.publicImageRecord(existingVideo));
          continue;
        }
        const image = await this.imageModel.create({
          userId,
          collectionId,
          setId: resolvedSetId,
          url: file.url,
          thumbnailUrl: '',
          blurDataUrl: '',
          originalName: file.name,
          filename: file.objectKey,
          mimetype: file.type,
          mediaType: 'video',
          sizeBytes: file.size,
          durationSeconds: this.safeSeconds(file.durationSeconds),
          width: this.safeDimension(file.width),
          height: this.safeDimension(file.height),
          watermarked: false,
          order: startOrder + ++videoOrder,
          metadata: {
            videoQuality: this.videoQuality(file.width, file.height),
            directUploadObjectKey: file.objectKey,
          },
        });
        await this.userModel.updateOne(
          { _id: userId },
          { $inc: { storageUsedBytes: file.size } },
        );
        savedVideos.push(this.publicImageRecord(image.toObject()));
        newVideoCount += 1;
      }
      if (newVideoCount) {
        await this.collectionModel.updateOne(
          { _id: collectionId, userId },
          { $inc: { imageCount: newVideoCount } },
        );
      }
    }

    const imageDirectFiles = verified.filter(
      (item) => this.mediaType(item.type) === 'image',
    );

    let savedImages: any[] = [];
    if (imageDirectFiles.length && this.imagorService.isEnabled()) {
      const batchWatermark = await this.resolveEffectiveWatermark(
        userId,
        collection,
        resolvedSetId,
        watermarkId,
      );
      const lastImage = await this.imageModel
        .findOne({ collectionId, userId })
        .sort({ order: -1, createdAt: -1 })
        .select('order')
        .lean();
      const startOrder = Math.max(0, Number(lastImage?.order ?? 0));

      savedImages = await this.mapWithConcurrency(
        imageDirectFiles,
        16,
        async (file, index) => {
          const jobLike = {
            userId,
            collectionId,
            setId: resolvedSetId,
            watermarkId,
            replaceImageId,
            objectKey: file.objectKey,
            name: file.name,
            type: file.type,
            size: file.size,
            durationSeconds: file.durationSeconds,
            width: file.width,
            height: file.height,
            order: startOrder + index + 1,
          };
          const image = await this.saveDirectImageForImagor(jobLike, {
            collection,
            resolvedSetId,
            watermarkData: batchWatermark,
          });
          if (replaceImageId) {
            await this.replaceImageAfterDirectProcessing(jobLike as any);
          }
          return this.publicImageRecord(image);
        },
      );

      await this.imageProcessingJobModel.deleteMany({
        objectKey: { $in: imageDirectFiles.map((file) => file.objectKey) },
      });
    } else if (imageDirectFiles.length) {
      await this.imageProcessingJobModel.bulkWrite(
        imageDirectFiles.map((file) => ({
          updateOne: {
            filter: { objectKey: file.objectKey },
            update: {
              $setOnInsert: {
                userId,
                collectionId,
                setId: resolvedSetId,
                watermarkId,
                replaceImageId,
                objectKey: file.objectKey,
                name: file.name,
                type: file.type,
                size: file.size,
                durationSeconds: this.safeSeconds(file.durationSeconds),
                width: this.safeDimension(file.width),
                height: this.safeDimension(file.height),
                status: 'queued',
                attempts: 0,
                lastError: '',
                resultMode: '',
                nextAttemptAt: new Date(),
                statusMessage:
                  'Raw upload is safe in R2. Waiting for background optimization.',
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      await this.imageProcessingJobModel.updateMany(
        {
          objectKey: { $in: imageDirectFiles.map((file) => file.objectKey) },
          status: 'awaiting-upload',
        },
        {
          $set: {
            status: 'queued',
            nextAttemptAt: new Date(),
            lastError: '',
            statusMessage:
              'Raw upload is safe in R2. Waiting for background optimization.',
          },
        },
      );
    }

    const savedItems = [...savedVideos, ...savedImages];
    if (
      this.imagorService.isEnabled() &&
      savedImages.length
    ) {
      await this.collectionModel.updateOne(
        { _id: collectionId, userId },
        {
          $set: {
            imageCacheStatus: 'warming',
            imageCacheVersion: IMAGE_CACHE_VERSION,
          },
          $unset: { imageCacheReadyAt: 1 },
        },
      );
    }
    if (collection.status === 'published' && savedItems.length) {
      await this.queueUpdatedCollection(
        collection,
        this.galleryUpdateEventId(collectionId),
      ).catch(() => undefined);
    }

    return {
      items: savedItems,
      queued: this.imagorService.isEnabled() ? 0 : imageDirectFiles.length,
    };
  }

  async getDirectUploadProcessingStatus(userId: string, collectionId: string) {
    const recentSince = new Date(Date.now() - 10 * 60 * 1000);
    const [
      rows,
      recentRows,
      processingJob,
      queuedJob,
      recentCompletedJobs,
      setCountRows,
    ] = await Promise.all([
      this.imageProcessingJobModel.aggregate<{
        _id: string;
        count: number;
      }>([
        {
          $match: {
            userId,
            collectionId,
            status: { $in: ['queued', 'processing', 'failed'] },
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.imageProcessingJobModel.aggregate<{
        _id: string;
        count: number;
      }>([
        {
          $match: {
            userId,
            collectionId,
            status: 'completed',
            completedAt: { $gte: recentSince },
          },
        },
        { $group: { _id: '$resultMode', count: { $sum: 1 } } },
      ]),
      this.imageProcessingJobModel
        .findOne({ userId, collectionId, status: 'processing' })
        .sort({ processingStartedAt: 1, createdAt: 1 })
        .select('name status attempts statusMessage')
        .lean(),
      this.imageProcessingJobModel
        .findOne({ userId, collectionId, status: 'queued' })
        .sort({ createdAt: 1 })
        .select('name status attempts statusMessage')
        .lean(),
      this.imageProcessingJobModel
        .find({
          userId,
          collectionId,
          status: 'completed',
          completedAt: { $gte: recentSince },
        })
        .sort({ completedAt: -1 })
        .limit(120)
        .select('objectKey completedAt')
        .lean(),
      this.imageModel.aggregate<{ _id: string; count: number }>([
        { $match: { userId, collectionId } },
        {
          $group: {
            _id: {
              setId: { $ifNull: ['$setId', 'highlights'] },
              logicalId: {
                $ifNull: ['$metadata.directUploadObjectKey', { $toString: '$_id' }],
              },
            },
          },
        },
        { $group: { _id: '$_id.setId', count: { $sum: 1 } } },
      ]),
    ]);

    const completedObjectKeys = recentCompletedJobs
      .map((job) => String(job.objectKey || '').trim())
      .filter(Boolean);
    const completedImages = completedObjectKeys.length
      ? await this.imageModel
          .find({
            userId,
            collectionId,
            'metadata.directUploadObjectKey': { $in: completedObjectKeys },
          })
          .select(
            '+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes',
          )
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const publicCompletedImages =
      await this.publicImageRecordsForCollection(completedImages as any[]);
    const setImageCounts = Object.fromEntries(
      setCountRows.map((row) => [
        String(row._id || 'highlights'),
        Number(row.count || 0),
      ]),
    );
    const imageCount = Object.values(setImageCounts).reduce(
      (sum, count) => sum + Number(count || 0),
      0,
    );

    const counts = new Map(rows.map((row) => [row._id, row.count]));
    const recentCounts = new Map(
      recentRows.map((row) => [row._id || '', row.count]),
    );
    const imagorActive = this.imagorService.isEnabled();
    const queued = imagorActive ? 0 : (counts.get('queued') ?? 0);
    const processing = imagorActive ? 0 : (counts.get('processing') ?? 0);
    const failed = imagorActive ? 0 : (counts.get('failed') ?? 0);
    const current = imagorActive ? null : (processingJob ?? queuedJob);

    return {
      queued,
      processing,
      failed,
      pending: queued + processing,
      optimized: imagorActive ? 0 : (recentCounts.get('optimized') ?? 0),
      rawFallback: imagorActive
        ? 0
        : (recentCounts.get('raw-fallback') ?? 0),
      imageCount,
      setImageCounts,
      completedImages: imagorActive ? [] : publicCompletedImages,
      current: current
        ? {
            name: current.name,
            status: current.status,
            attempts: Math.max(0, Number(current.attempts ?? 0)),
            message: String(current.statusMessage ?? ''),
          }
        : null,
    };
  }

  @Interval(2000)
  async processDirectImageQueueTick() {
    if (!backgroundWorkerEnabled()) return;
    if (this.directImageWorkerRunning) return;
    this.directImageWorkerRunning = true;
    try {
      const now = Date.now();
      if (this.imagorService.isEnabled()) {
        if (now - this.lastDirectUploadDiscoveryAt >= 5_000) {
          this.lastDirectUploadDiscoveryAt = now;
          await this.discoverCompletedDirectUploads();
        }
        await this.reconcileLegacyImagorJobsOnce();
        if (now - this.lastDirectImageRecoveryAt >= 60_000) {
          this.lastDirectImageRecoveryAt = now;
          await this.imageProcessingJobModel.deleteMany({
            status: 'completed',
          });
        }
        return;
      }

      if (now - this.lastDirectUploadDiscoveryAt >= 5_000) {
        this.lastDirectUploadDiscoveryAt = now;
        await this.discoverCompletedDirectUploads();
      }
      if (now - this.lastDirectImageRecoveryAt >= 60_000) {
        this.lastDirectImageRecoveryAt = now;
        const staleBefore = new Date(now - 3 * 60 * 1000);
        await this.imageProcessingJobModel.updateMany(
          {
            status: 'processing',
            processingStartedAt: { $lte: staleBefore },
          },
          {
            $set: {
              status: 'queued',
              nextAttemptAt: new Date(now),
              lastError: 'Recovered after an interrupted image-processing worker',
              statusMessage:
                'Recovered after a restart. Background optimization will retry automatically.',
            },
            $unset: { processingStartedAt: 1 },
          },
        );
        await this.imageProcessingJobModel.deleteMany({
          status: 'completed',
          completedAt: { $lte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
        });
      }

      const workerCount = this.directImageWorkerConcurrency();
      await Promise.all(
        Array.from({ length: workerCount }, () =>
          this.processNextDirectImageJob(),
        ),
      );
    } finally {
      this.directImageWorkerRunning = false;
    }
  }

  private async discoverCompletedDirectUploads() {
    const now = new Date();
    const jobs = await this.imageProcessingJobModel
      .find({
        status: 'awaiting-upload',
        $or: [
          { nextAttemptAt: { $lte: now } },
          { nextAttemptAt: { $exists: false } },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(80)
      .lean();
    if (!jobs.length) return;

    await this.mapWithConcurrency(jobs, 12, async (job) => {
      const collection = await this.collectionModel
        .findOne({ _id: job.collectionId, userId: job.userId })
        .select('sets')
        .lean()
        .catch(() => null);

      if (
        !collection ||
        (job.setId &&
          !collection.sets?.some((set: any) => set.id === job.setId))
      ) {
        await this.imageProcessingJobModel
          .deleteOne({ _id: job._id })
          .catch(() => undefined);
        return;
      }

      const directFile: DirectUploadFile = {
        objectKey: job.objectKey,
        name: job.name,
        type: job.type,
        size: job.size,
        durationSeconds: job.durationSeconds,
        width: job.width,
        height: job.height,
      };

      let verified = await this.minioService
        .verifyDirectUpload(job.userId, directFile)
        .catch(() => undefined);

      if (
        !verified &&
        job.uploadId &&
        Math.max(0, Number(job.multipartPartCount ?? 0)) > 0
      ) {
        const recovered = await this.minioService
          .recoverDirectMultipartUpload(job.userId, {
            objectKey: job.objectKey,
            uploadId: job.uploadId,
            expectedPartCount: Math.max(
              1,
              Number(job.multipartPartCount ?? 0),
            ),
            expectedSize: Math.max(0, Number(job.size ?? 0)),
          })
          .catch(() => false);
        if (recovered) {
          verified = await this.minioService
            .verifyDirectUpload(job.userId, directFile)
            .catch(() => undefined);
        }
      }

      if (verified) {
        if (this.imagorService.isEnabled()) {
          if (this.mediaType(job.type) === 'image') {
            await this.saveDirectImageForImagor(job as any);
          } else {
            await this.saveDirectVideoFromProcessingJob(job as any);
          }
          await this.replaceImageAfterDirectProcessing(job as any);
          await this.imageProcessingJobModel.deleteOne({ _id: job._id });
          return;
        }

        await this.imageProcessingJobModel.updateOne(
          { _id: job._id, status: 'awaiting-upload' },
          {
            $set: {
              status: 'queued',
              nextAttemptAt: new Date(),
              lastError: '',
              statusMessage:
                'Raw upload reached R2. Backend recovered the upload and will finish it automatically.',
            },
          },
        );
        return;
      }

      const createdAt = new Date(
        (job as typeof job & { createdAt?: Date }).createdAt ?? Date.now(),
      ).getTime();
      if (Date.now() - createdAt > 24 * 60 * 60 * 1000) {
        await this.imageProcessingJobModel.updateOne(
          { _id: job._id, status: 'awaiting-upload' },
          {
            $set: {
              status: 'failed',
              lastError:
                'Browser upload never reached a complete R2 object within 24 hours.',
              statusMessage:
                'The browser upload did not finish. Upload this file again.',
            },
          },
        );
      } else {
        await this.imageProcessingJobModel.updateOne(
          { _id: job._id, status: 'awaiting-upload' },
          {
            $set: {
              nextAttemptAt: new Date(Date.now() + 10_000),
            },
          },
        );
      }
    });
  }

  private async reconcileLegacyImagorJobsOnce() {
    const jobs = await this.imageProcessingJobModel
      .find({
        status: { $in: ['queued', 'processing', 'failed'] },
      })
      .sort({ createdAt: 1 })
      .limit(120)
      .lean();
    if (!jobs.length) return;

    await this.mapWithConcurrency(jobs, 20, async (job) => {
      try {
        const collection = await this.collectionModel
          .findOne({ _id: job.collectionId, userId: job.userId })
          .select('sets')
          .lean()
          .catch(() => null);

        if (!collection) return;
        if (
          job.setId &&
          !collection.sets?.some((set: any) => set.id === job.setId)
        ) {
          return;
        }

        const verified = await this.minioService
          .verifyDirectUpload(job.userId, {
            objectKey: job.objectKey,
            name: job.name,
            type: job.type,
            size: job.size,
          })
          .catch(() => undefined);

        if (!verified) return;

        if (this.mediaType(job.type) === 'image') {
          await this.saveDirectImageForImagor(job as any);
        } else {
          await this.saveDirectVideoFromProcessingJob(job as any);
        }
        await this.replaceImageAfterDirectProcessing(job as any);
      } catch {
        // Legacy recovery must never bubble into the scheduler. The job is
        // obsolete or malformed; drop it and continue with the next item.
      } finally {
        await this.imageProcessingJobModel
          .deleteOne({ _id: job._id })
          .catch(() => undefined);
      }
    });
  }

  private directImageWorkerConcurrency() {
    const configured = Number(
      this.configService.get<string>(
        'IMAGE_BACKGROUND_PROCESSING_CONCURRENCY',
      ) ?? 6,
    );
    return Math.max(
      1,
      Math.min(
        8,
        Number.isFinite(configured) ? Math.floor(configured) : 6,
      ),
    );
  }

  private shouldPublishDirectRawFallback(
    job: CollectionImageProcessingJobDocument,
  ) {
    const sizeThreshold = Number(
      this.configService.get<string>(
        'IMAGE_BACKGROUND_RAW_FALLBACK_MIN_BYTES',
      ) ?? 20 * 1024 * 1024,
    );
    const maxQueueAgeMs = Number(
      this.configService.get<string>(
        'IMAGE_BACKGROUND_RAW_FALLBACK_AFTER_MS',
      ) ?? 30_000,
    );
    const createdAt = new Date(
      (job as CollectionImageProcessingJobDocument & { createdAt?: Date })
        .createdAt ?? Date.now(),
    ).getTime();
    const ageMs = Math.max(0, Date.now() - createdAt);

    return (
      Math.max(0, Number(job.size ?? 0)) >=
        Math.max(1, Number.isFinite(sizeThreshold) ? sizeThreshold : 20 * 1024 * 1024) ||
      ageMs >=
        Math.max(5_000, Number.isFinite(maxQueueAgeMs) ? maxQueueAgeMs : 30_000)
    );
  }

  private toImagorWatermark(
    watermark: WatermarkData | null | undefined,
  ): ImagorWatermark | undefined {
    if (!watermark) return undefined;
    return {
      type: watermark.type,
      text: watermark.text,
      font: watermark.font,
      color: watermark.color,
      scale: watermark.scale,
      opacity: watermark.opacity,
      position: watermark.position,
      image: watermark.image,
    };
  }

  private async resolveEffectiveWatermark(
    userId: string,
    collection: any,
    setId?: string,
    explicitWatermarkId?: string,
  ) {
    const explicit = String(explicitWatermarkId ?? '').trim();
    if (explicit) {
      if (explicit === 'No watermark') return null;
      return this.resolveWatermarkById(userId, explicit);
    }
    const set = Array.isArray(collection?.sets)
      ? collection.sets.find((item: any) => item?.id === setId)
      : undefined;
    if (set?.watermarkId) {
      return this.resolveWatermarkById(userId, String(set.watermarkId));
    }
    if (collection?.watermarkId) {
      return this.resolveWatermarkById(userId, String(collection.watermarkId));
    }
    if (collection?.presetId) {
      return this.resolveWatermark(userId, String(collection.presetId));
    }
    return null;
  }

  private async queueImagePostUpload(image: any) {
    await this.imageMetadataAiService.enqueueMany([image]).catch((error) => {
      console.warn('Could not queue AI image metadata:', error?.message ?? error);
    });
    const faceQueue: FaceIndexQueueImage[] = [{
      _id: image._id,
      userId: image.userId,
      collectionId: image.collectionId,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      originalObjectKey: image.originalObjectKey,
      metadata: image.metadata,
      width: image.width,
      height: image.height,
    }];
    setTimeout(() => {
      void this.indexFacesInBackground(faceQueue);
    }, this.backgroundFaceStartDelayMs());
  }

  private async saveDirectImageForImagor(
    job: any,
    options: {
      manageCollection?: boolean;
      queuePostUpload?: boolean;
      collection?: any;
      resolvedSetId?: string;
      watermarkData?: WatermarkData | null;
    } = {},
  ) {
    const lockKey = [
      String(job.userId ?? ''),
      String(job.collectionId ?? ''),
      String(job.objectKey ?? ''),
    ].join(':');
    const existingLock = this.directImagorSaveLocks.get(lockKey);
    if (existingLock) return existingLock;

    const savePromise = this.saveDirectImageForImagorUnlocked(job, options);
    this.directImagorSaveLocks.set(lockKey, savePromise);
    try {
      return await savePromise;
    } finally {
      if (this.directImagorSaveLocks.get(lockKey) === savePromise) {
        this.directImagorSaveLocks.delete(lockKey);
      }
    }
  }

  private async saveDirectImageForImagorUnlocked(
    job: any,
    options: {
      manageCollection?: boolean;
      queuePostUpload?: boolean;
      collection?: any;
      resolvedSetId?: string;
      watermarkData?: WatermarkData | null;
    } = {},
  ) {
    const existing = await this.imageModel
      .findOne({
        userId: job.userId,
        collectionId: job.collectionId,
        'metadata.directUploadObjectKey': job.objectKey,
      })
      .select('+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes')
      .lean();
    if (existing) return existing;

    const collection =
      options.collection ??
      (await this.collectionModel
        .findOne({ _id: job.collectionId, userId: job.userId })
        .lean());
    if (!collection) throw new NotFoundException('Collection not found');
    const activeSet = job.setId
      ? collection.sets?.find((set: any) => set.id === job.setId)
      : collection.sets?.[0];
    if (job.setId && !activeSet) throw new NotFoundException('Set not found');
    const resolvedSetId =
      options.resolvedSetId || activeSet?.id || 'highlights';
    const watermark =
      options.watermarkData !== undefined
        ? options.watermarkData
        : ((job.watermarkData as WatermarkData | undefined) ??
          (await this.resolveEffectiveWatermark(
            job.userId,
            collection,
            resolvedSetId,
            job.watermarkId,
          )));
    const imagorWatermark = this.toImagorWatermark(watermark);
    const sourceDimensions =
      await this.imagorService.resolveSourceDimensions(job.objectKey, {
        width: job.width,
        height: job.height,
      });
    const urls = this.imagorService.imageUrls(
      job.objectKey,
      imagorWatermark,
      sourceDimensions,
    );
    if (!urls) throw new Error('Imagor is not configured');

    const requestedOrder = Math.max(0, Number(job.order ?? 0));
    const lastImage = requestedOrder
      ? null
      : await this.imageModel
          .findOne({ collectionId: job.collectionId, userId: job.userId })
          .sort({ order: -1, createdAt: -1 })
          .select('order')
          .lean();
    const size = Math.max(0, Number(job.size ?? 0));
    const image = await this.imageModel.create({
      userId: job.userId,
      collectionId: job.collectionId,
      setId: resolvedSetId,
      url: urls.url,
      thumbnailUrl: urls.thumbnailUrl,
      blurDataUrl: '',
      originalName: job.name,
      filename: job.name,
      originalObjectKey: job.objectKey,
      originalFilename: job.name,
      originalMimeType: job.type,
      originalSizeBytes: size,
      mimetype: job.type,
      mediaType: 'image',
      sizeBytes: size,
      width: this.safeDimension(sourceDimensions?.width ?? job.width),
      height: this.safeDimension(sourceDimensions?.height ?? job.height),
      watermarked: this.imagorService.hasWatermark(imagorWatermark),
      order:
        Math.max(0, Number(job.order ?? 0)) ||
        Math.max(0, Number(lastImage?.order ?? 0)) + 1,
      metadata: {
        filename: job.name,
        directUploadObjectKey: job.objectKey,
        storageMode: 'original-imagor',
        watermarkId: watermark?.id || job.watermarkId || '',
        imagorWatermark,
      },
    });

    await this.userModel.updateOne(
      { _id: job.userId },
      { $inc: { storageUsedBytes: size } },
    );
    if (options.manageCollection !== false) {
      await this.collectionModel.updateOne(
        { _id: job.collectionId, userId: job.userId },
        {
          $inc: { imageCount: 1 },
          ...(!collection.coverImage
            ? { $set: { coverImage: urls.url } }
            : {}),
        },
      );
    }
    if (
      options.queuePostUpload !== false &&
      this.imagorService.hasWatermark(imagorWatermark)
    ) {
      void this.queueImagePostUpload(image.toObject());
    }
    return image.toObject();
  }

  private async saveDirectVideoFromProcessingJob(
    job: CollectionImageProcessingJobDocument,
  ) {
    const existing = await this.imageModel
      .findOne({
        userId: job.userId,
        collectionId: job.collectionId,
        'metadata.directUploadObjectKey': job.objectKey,
      })
      .lean();
    if (existing) return existing;

    const collection = await this.collectionModel
      .findOne({ _id: job.collectionId, userId: job.userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const activeSet = job.setId
      ? collection.sets?.find((set) => set.id === job.setId)
      : collection.sets?.[0];
    if (job.setId && !activeSet) throw new NotFoundException('Set not found');
    const resolvedSetId = activeSet?.id || 'highlights';

    const verified = await this.minioService.verifyDirectUpload(job.userId, {
      objectKey: job.objectKey,
      name: job.name,
      type: job.type,
      size: job.size,
    });
    const lastImage = await this.imageModel
      .findOne({ collectionId: job.collectionId, userId: job.userId })
      .sort({ order: -1, createdAt: -1 })
      .select('order')
      .lean();

    const image = await this.imageModel.create({
      userId: job.userId,
      collectionId: job.collectionId,
      setId: resolvedSetId,
      url: verified.url,
      thumbnailUrl: '',
      blurDataUrl: '',
      originalName: job.name,
      filename: job.objectKey,
      mimetype: verified.type,
      mediaType: 'video',
      sizeBytes: verified.size,
      durationSeconds: this.safeSeconds(job.durationSeconds),
      width: this.safeDimension(job.width),
      height: this.safeDimension(job.height),
      watermarked: false,
      order: Math.max(0, Number(lastImage?.order ?? 0)) + 1,
      metadata: {
        videoQuality: this.videoQuality(job.width, job.height),
        directUploadObjectKey: job.objectKey,
      },
    });

    await Promise.all([
      this.userModel.updateOne(
        { _id: job.userId },
        { $inc: { storageUsedBytes: verified.size } },
      ),
      this.collectionModel.updateOne(
        { _id: job.collectionId, userId: job.userId },
        { $inc: { imageCount: 1 } },
      ),
    ]);

    return image.toObject();
  }

  private async processNextDirectImageJob() {
    const now = new Date();
    const job = await this.imageProcessingJobModel.findOneAndUpdate(
      {
        status: 'queued',
        attempts: { $lt: 4 },
        $or: [
          { nextAttemptAt: { $lte: now } },
          { nextAttemptAt: { $exists: false } },
        ],
      },
      {
        $set: {
          status: 'processing',
          processingStartedAt: new Date(),
          lastError: '',
          statusMessage:
            'Finalizing upload on the server. Raw file is already safe in R2.',
        },
        $unset: { nextAttemptAt: 1 },
        $inc: { attempts: 1 },
      },
      {
        returnDocument: 'after',
        sort: { createdAt: 1 },
      },
    );
    if (!job) return;

    const heartbeat = setInterval(() => {
      void this.imageProcessingJobModel
        .updateOne(
          { _id: job._id, status: 'processing' },
          { $set: { processingStartedAt: new Date() } },
        )
        .catch(() => undefined);
    }, 30_000);
    let localFile: Express.Multer.File | undefined;

    try {
      if (
        this.imagorService.isEnabled() &&
        this.mediaType(job.type) === 'image'
      ) {
        await this.saveDirectImageForImagor(job);
        await this.replaceImageAfterDirectProcessing(job);
        await this.imageProcessingJobModel.deleteOne({ _id: job._id });
        return;
      }

      if (this.mediaType(job.type) === 'video') {
        await this.saveDirectVideoFromProcessingJob(job);
        await this.replaceImageAfterDirectProcessing(job);
        await this.imageProcessingJobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'completed',
              resultMode: '',
              statusMessage:
                'Video is live in the gallery. Server-side upload recovery is complete.',
              completedAt: new Date(),
              lastError: '',
            },
            $unset: { processingStartedAt: 1, nextAttemptAt: 1 },
          },
        );
        return;
      }

      const alreadyProcessed = await this.imageModel
        .findOne({
          userId: job.userId,
          collectionId: job.collectionId,
          'metadata.directUploadObjectKey': job.objectKey,
        })
        .select('metadata')
        .lean();
      let resultMode: 'optimized' | 'raw-fallback' =
        (alreadyProcessed?.metadata as Record<string, any> | undefined)
          ?.rawFallback === true
          ? 'raw-fallback'
          : 'optimized';

      if (!alreadyProcessed && this.shouldPublishDirectRawFallback(job)) {
        await this.saveDirectRawFallback(
          job,
          'Published the raw original immediately so gallery availability never waits on Sharp.',
        );
        resultMode = 'raw-fallback';
      }

      if (!alreadyProcessed && resultMode !== 'raw-fallback') {
        const directFile: DirectUploadFile = {
          objectKey: job.objectKey,
          name: job.name,
          type: job.type,
          size: job.size,
          durationSeconds: job.durationSeconds,
          width: job.width,
          height: job.height,
        };
        localFile = await this.minioService.downloadDirectUpload(
          job.userId,
          directFile,
        );
        await this.uploadImages(
          job.userId,
          job.collectionId,
          [localFile],
          job.setId,
          job.watermarkId,
          { directUploadObjectKey: job.objectKey },
        );
        resultMode = 'optimized';
      }

      await this.replaceImageAfterDirectProcessing(job);
      await this.imageProcessingJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'completed',
            resultMode,
            statusMessage:
              resultMode === 'raw-fallback'
                ? 'Raw original published because optimization was too slow.'
                : 'Optimized gallery copy ready. Raw original preserved in R2.',
            completedAt: new Date(),
            lastError: '',
          },
          $unset: { processingStartedAt: 1, nextAttemptAt: 1 },
        },
      );
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);

      // A deleted set must not be recreated by an upload worker that was already
      // running when the user confirmed deletion.
      if (/set not found/i.test(message)) {
        await Promise.allSettled([
          this.minioService.deleteDirectUpload(job.userId, job.objectKey),
          this.imageProcessingJobModel.deleteOne({ _id: job._id }),
        ]);
        return;
      }

      const attempts = Math.max(1, Number(job.attempts ?? 1));
      const timedOut = this.isBackgroundImageOptimizationTimeout(error);
      const shouldUseRawFallback =
        this.mediaType(job.type) === 'image' && (timedOut || attempts >= 2);

      if (shouldUseRawFallback) {
        try {
          const reason = timedOut
            ? 'Optimization exceeded the processing deadline.'
            : 'Optimization failed twice.';
          await this.saveDirectRawFallback(job, reason);
          await this.replaceImageAfterDirectProcessing(job);
          await this.imageProcessingJobModel.updateOne(
            { _id: job._id },
            {
              $set: {
                status: 'completed',
                resultMode: 'raw-fallback',
                statusMessage:
                  'Optimization was skipped. Raw original is live in the gallery.',
                completedAt: new Date(),
                lastError: '',
              },
              $unset: { processingStartedAt: 1, nextAttemptAt: 1 },
            },
          );
          return;
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError);
          message = `${message}; raw fallback failed: ${fallbackMessage}`;
        }
      }

      const retryDelayMs = Math.min(
        60_000,
        5_000 * 2 ** Math.max(0, attempts - 1),
      );
      await this.imageProcessingJobModel.updateOne(
        { _id: job._id },
        attempts >= 4
          ? {
              $set: {
                status: 'failed',
                statusMessage:
                  'Background processing failed after automatic retries.',
                lastError: message.slice(0, 1600),
              },
              $unset: { processingStartedAt: 1, nextAttemptAt: 1 },
            }
          : {
              $set: {
                status: 'queued',
                nextAttemptAt: new Date(Date.now() + retryDelayMs),
                statusMessage: `Retrying background processing automatically (attempt ${attempts + 1} of 4) after a short cooldown.`,
                lastError: message.slice(0, 1600),
              },
              $unset: { processingStartedAt: 1 },
            },
      );
    } finally {
      clearInterval(heartbeat);
      if (localFile?.path) await this.safeUnlink(localFile.path);
    }
  }

  private async replaceImageAfterDirectProcessing(
    job: CollectionImageProcessingJobDocument,
  ) {
    if (!job.replaceImageId) return;
    const oldImageExists = await this.imageModel.exists({
      _id: job.replaceImageId,
      userId: job.userId,
      collectionId: job.collectionId,
    });
    if (!oldImageExists) return;
    await this.removeImage(
      job.userId,
      job.collectionId,
      job.replaceImageId,
    );
  }

  private isBackgroundImageOptimizationTimeout(error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? '');
    return /timeout|timed out|processing deadline|operation.*time/i.test(message);
  }

  private async saveDirectRawFallback(
    job: CollectionImageProcessingJobDocument,
    reason: string,
  ) {
    const existing = await this.imageModel
      .findOne({
        userId: job.userId,
        collectionId: job.collectionId,
        'metadata.directUploadObjectKey': job.objectKey,
      })
      .lean();
    if (existing) return existing;

    const collection = await this.collectionModel
      .findOne({ _id: job.collectionId, userId: job.userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const activeSet = job.setId
      ? collection.sets?.find((set) => set.id === job.setId)
      : collection.sets?.[0];
    if (job.setId && !activeSet) throw new NotFoundException('Set not found');
    const resolvedSetId = activeSet?.id || 'highlights';

    const extension =
      extname(job.name)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, '')
        .slice(0, 12) || '.img';
    const publicObjectKey =
      `raw/${job.userId}/${job.collectionId}/${job._id.toString()}${extension}`;
    const storedBytes = Math.max(0, Number(job.size ?? 0)) * 2;
    await this.ensureStorageAvailable(job.userId, storedBytes);

    let promotedUrl = '';
    try {
      const promoted = await this.minioService.promoteDirectUploadToPublic(
        job.userId,
        {
          objectKey: job.objectKey,
          name: job.name,
          type: job.type,
          size: job.size,
        },
        publicObjectKey,
      );
      promotedUrl = promoted.url;

      const lastImage = await this.imageModel
        .findOne({ collectionId: job.collectionId, userId: job.userId })
        .sort({ order: -1, createdAt: -1 })
        .select('order')
        .lean();
      const fallbackTitle = String(job.name || 'Image')
        .replace(extname(job.name), '')
        .replace(/[-_]+/g, ' ')
        .trim();

      const image = await this.imageModel.create({
        userId: job.userId,
        collectionId: job.collectionId,
        setId: resolvedSetId,
        url: promoted.url,
        thumbnailUrl: '',
        blurDataUrl: '',
        originalName: job.name,
        filename: promoted.objectKey,
        originalObjectKey: job.objectKey,
        originalFilename: job.name,
        originalMimeType: job.type,
        originalSizeBytes: Math.max(0, Number(job.size ?? 0)),
        mimetype: job.type,
        mediaType: 'image',
        sizeBytes: storedBytes,
        width: this.safeDimension(job.width),
        height: this.safeDimension(job.height),
        watermarked: false,
        order: Math.max(0, Number(lastImage?.order ?? 0)) + 1,
        metadata: {
          filename: job.name,
          title: fallbackTitle,
          fileTitle: fallbackTitle,
          date: new Date().toISOString(),
          directUploadObjectKey: job.objectKey,
          rawFallback: true,
          optimizationStatus: 'raw-fallback',
          optimizationMessage: reason,
          watermarkSkipped: Boolean(job.watermarkId),
        },
      });

      await Promise.all([
        this.userModel.updateOne(
          { _id: job.userId },
          { $inc: { storageUsedBytes: storedBytes } },
        ),
        this.collectionModel.updateOne(
          { _id: job.collectionId, userId: job.userId },
          {
            $inc: { imageCount: 1 },
            $set: { coverImage: collection.coverImage ?? promoted.url },
          },
        ),
      ]);
      const savedImage = image.toObject();
      await this.imageMetadataAiService.enqueueMany([savedImage]).catch((error) => {
        console.warn(
          'Could not queue AI metadata for raw fallback image:',
          error?.message ?? error,
        );
      });
      return savedImage;
    } catch (error) {
      if (promotedUrl) {
        await this.minioService.deleteService(promotedUrl).catch(() => null);
      }
      throw error;
    }
  }

  private async indexFacesInBackground(images: FaceIndexQueueImage[]) {
    // In PM2 cluster mode only instance 0 performs face inference. Uploads that
    // land on other API workers remain unindexed in Mongo and are picked up by
    // FaceSearchService's global low-pressure sweep.
    if (!backgroundWorkerEnabled()) return;

    for (const image of images) {
      await this.faceSearchService.indexImage(image).catch((error) => {
        console.warn('Face indexing failed:', error?.message ?? error);
      });
      // The face service owns the global cooldown, so overlapping upload batches
      // cannot accidentally create a burst here.
    }
  }

  private backgroundFaceStartDelayMs() {
    const configured = Number(
      this.configService.get<string>('FACE_BACKGROUND_START_DELAY_MS') ?? 10000,
    );
    return Math.max(
      0,
      Math.min(60000, Number.isFinite(configured) ? Math.floor(configured) : 10000),
    );
  }

  private imageCacheSourceClause() {
    return {
      $or: [
        { originalObjectKey: { $regex: /^(private-direct\/|direct\/|originals\/)/ } },
        {
          'metadata.directUploadObjectKey': {
            $regex: /^(private-direct\/|direct\/|originals\/)/,
          },
        },
      ],
    };
  }

  async claimImagorResultCacheJob() {
    if (!this.imagorService.isEnabled()) return null;

    const now = new Date();
    const staleProcessingBefore = new Date(Date.now() - 15 * 60_000);
    const jobToken = new Types.ObjectId().toString();
    const image = await this.imageModel
      .findOneAndUpdate(
        {
          mediaType: { $ne: 'video' },
          $and: [
            this.imageCacheSourceClause(),
            {
              $or: [
                { 'metadata.imageCache.version': { $ne: IMAGE_CACHE_VERSION } },
                { 'metadata.imageCache.status': { $exists: false } },
                {
                  'metadata.imageCache.status': {
                    $in: ['', 'queued', 'stale', 'failed'],
                  },
                },
                {
                  'metadata.imageCache.status': 'processing',
                  'metadata.imageCache.processingStartedAt': {
                    $lte: staleProcessingBefore,
                  },
                },
              ],
            },
            {
              $or: [
                { 'metadata.imageCache.nextAttemptAt': { $exists: false } },
                { 'metadata.imageCache.nextAttemptAt': { $lte: now } },
              ],
            },
          ],
        } as any,
        {
          $set: {
            'metadata.imageCache.version': IMAGE_CACHE_VERSION,
            'metadata.imageCache.status': 'processing',
            'metadata.imageCache.processingStartedAt': now,
            'metadata.imageCache.jobToken': jobToken,
            'metadata.imageCache.lastError': '',
          },
          $inc: { 'metadata.imageCache.attempts': 1 },
          $unset: { 'metadata.imageCache.nextAttemptAt': 1 },
        },
        {
          sort: { createdAt: 1 },
          returnDocument: 'after',
        },
      )
      .select(
        '+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes',
      )
      .lean();

    if (!image) {
      const warming = await this.collectionModel
        .findOne({
          imageCacheStatus: 'warming',
          imageCacheVersion: IMAGE_CACHE_VERSION,
        })
        .select('_id')
        .lean();
      if (warming) {
        await this.finalizeCollectionImageCache(String(warming._id));
      }
      return null;
    }

    const collectionId = String(image.collectionId);
    const imageId = String(image._id);
    const collection = await this.collectionModel
      .findById(collectionId)
      .select(
        'userId presetId watermarkId sets imageCacheStatus imageCacheVersion',
      )
      .lean();
    if (!collection) {
      await this.imageModel.updateOne(
        { _id: imageId },
        {
          $set: {
            'metadata.imageCache.status': 'failed',
            'metadata.imageCache.lastError': 'Collection no longer exists',
            'metadata.imageCache.nextAttemptAt': new Date(
              Date.now() + 6 * 60 * 60_000,
            ),
          },
          $unset: { 'metadata.imageCache.processingStartedAt': 1 },
        },
      );
      return null;
    }

    await this.collectionModel.updateOne(
      { _id: collectionId },
      {
        $set: {
          imageCacheStatus: 'warming',
          imageCacheVersion: IMAGE_CACHE_VERSION,
        },
        $unset: { imageCacheReadyAt: 1 },
      },
    );

    try {
      const sourceObjectKey =
        String((image as any).originalObjectKey ?? '').trim() ||
        String((image.metadata as any)?.directUploadObjectKey ?? '').trim();
      if (!sourceObjectKey) throw new Error('Original R2 object key is missing');

      const explicitWatermarkId = String(
        (image.metadata as any)?.watermarkId ?? '',
      ).trim();
      const watermark =
        explicitWatermarkId === 'No watermark'
          ? null
          : await this.resolveEffectiveWatermark(
              String(image.userId),
              collection,
              String(image.setId || 'highlights'),
              explicitWatermarkId || undefined,
            );
      const dimensions = await this.imagorService.resolveSourceDimensions(
        sourceObjectKey,
        { width: Number(image.width), height: Number(image.height) },
      );
      const imagorUrls = this.imagorService.imageUrls(
        sourceObjectKey,
        this.toImagorWatermark(watermark),
        dimensions,
      );
      if (!imagorUrls) throw new Error('Imagor URL generation is unavailable');

      return {
        imageId,
        collectionId,
        jobToken,
        version: IMAGE_CACHE_VERSION,
        urls: {
          thumbnail: imagorUrls.thumbnailUrl,
          view: imagorUrls.url,
          small: imagorUrls.responsive.small,
          medium: imagorUrls.responsive.medium,
          large: imagorUrls.responsive.large,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'Cache claim failed');
      await this.imageModel.updateOne(
        { _id: imageId, collectionId },
        {
          $set: {
            'metadata.imageCache.status': 'failed',
            'metadata.imageCache.lastError': message.slice(0, 600),
            'metadata.imageCache.nextAttemptAt': new Date(
              Date.now() + 30 * 60_000,
            ),
          },
          $unset: { 'metadata.imageCache.processingStartedAt': 1 },
        },
      );
      return null;
    }
  }

  async completeImagorResultCacheJob(
    imageId: string,
    body: {
      collectionId?: string;
      jobToken?: string;
      success?: boolean;
      keys?: Record<string, string>;
      urls?: Record<string, string>;
      error?: string;
    },
  ) {
    const collectionId = String(body?.collectionId ?? '').trim();
    if (!Types.ObjectId.isValid(imageId) || !Types.ObjectId.isValid(collectionId)) {
      return { accepted: false, obsoleteKeys: [], obsoleteUrls: [] };
    }

    const image = await this.imageModel
      .findOne({ _id: imageId, collectionId })
      .select('metadata')
      .lean();
    if (!image) {
      return { accepted: false, obsoleteKeys: [], obsoleteUrls: [] };
    }

    if (!body?.success) {
      await this.imageModel.updateOne(
        { _id: imageId, collectionId },
        {
          $set: {
            'metadata.imageCache.version': IMAGE_CACHE_VERSION,
            'metadata.imageCache.status': 'failed',
            'metadata.imageCache.lastError': String(body?.error || 'Imagor cache warm failed').slice(0, 600),
            'metadata.imageCache.nextAttemptAt': new Date(
              Date.now() + 30 * 60_000,
            ),
          },
          $unset: { 'metadata.imageCache.processingStartedAt': 1 },
        },
      );
      return { accepted: true, ready: false, obsoleteKeys: [], obsoleteUrls: [] };
    }

    // Only two variants are permanent. The tiny thumbnail is generated and
    // cached by Imagor only when a browser actually requests it.
    const requiredVariants = ['small', 'view'];
    const keys = Object.fromEntries(
      requiredVariants.map((variant) => [
        variant,
        String(body?.keys?.[variant] ?? '').trim(),
      ]),
    );
    const urls = Object.fromEntries(
      requiredVariants.map((variant) => [
        variant,
        String(body?.urls?.[variant] ?? '').trim(),
      ]),
    );
    if (
      requiredVariants.some(
        (variant) => !keys[variant] || !urls[variant],
      )
    ) {
      await this.imageModel.updateOne(
        { _id: imageId, collectionId },
        {
          $set: {
            'metadata.imageCache.status': 'failed',
            'metadata.imageCache.lastError':
              'Imagor worker did not confirm every R2 Result Storage variant',
            'metadata.imageCache.nextAttemptAt': new Date(
              Date.now() + 30 * 60_000,
            ),
          },
          $unset: { 'metadata.imageCache.processingStartedAt': 1 },
        },
      );
      return { accepted: true, ready: false, obsoleteKeys: [], obsoleteUrls: [] };
    }

    const previousKeys = Object.values(
      ((image.metadata as any)?.imageCache?.keys ?? {}) as Record<string, unknown>,
    )
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const previousUrls = Object.values(
      ((image.metadata as any)?.imageCache?.urls ?? {}) as Record<string, unknown>,
    )
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    const cacheCommit = await this.imageModel.updateOne(
      { _id: imageId, collectionId },
      {
        $set: {
          'metadata.imageCache': {
            version: IMAGE_CACHE_VERSION,
            status: 'ready',
            keys,
            urls,
            readyAt: new Date(),
            attempts: Number((image.metadata as any)?.imageCache?.attempts ?? 1),
            lastError: '',
          },
        },
      },
    );
    if (!cacheCommit.matchedCount) {
      return {
        accepted: false,
        obsoleteKeys: Object.values(keys),
        obsoleteUrls: Object.values(urls),
      };
    }

    const nextKeys = new Set(Object.values(keys));
    const nextUrls = new Set(Object.values(urls));
    const incomingExtraKeys = Object.entries(
      (body?.keys ?? {}) as Record<string, unknown>,
    )
      .filter(([variant]) => !requiredVariants.includes(variant))
      .map(([, value]) => String(value || '').trim())
      .filter(Boolean);
    const incomingExtraUrls = Object.entries(
      (body?.urls ?? {}) as Record<string, unknown>,
    )
      .filter(([variant]) => !requiredVariants.includes(variant))
      .map(([, value]) => String(value || '').trim())
      .filter(Boolean);
    const obsoleteKeys = [
      ...new Set([
        ...previousKeys.filter((key) => !nextKeys.has(key)),
        ...incomingExtraKeys.filter((key) => !nextKeys.has(key)),
      ]),
    ];
    const obsoleteUrls = [
      ...new Set([
        ...previousUrls.filter((url) => !nextUrls.has(url)),
        ...incomingExtraUrls.filter((url) => !nextUrls.has(url)),
      ]),
    ];
    const ready = await this.finalizeCollectionImageCache(collectionId);
    return { accepted: true, ready, obsoleteKeys, obsoleteUrls };
  }

  async claimImagorResultCacheDeleteJob() {
    const now = new Date();
    const staleBefore = new Date(Date.now() - 10 * 60_000);
    const job = await this.imageDeleteJobModel
      .findOneAndUpdate(
        {
          $and: [
            {
              $or: [
                { 'cacheObjectKeys.0': { $exists: true } },
                { 'cacheTransformUrls.0': { $exists: true } },
              ],
            },
            {
              $or: [
                {
                  cacheDeleteStatus: { $in: ['', 'queued', 'failed'] },
                  $or: [
                    { cacheDeleteNextAttemptAt: { $exists: false } },
                    { cacheDeleteNextAttemptAt: { $lte: now } },
                  ],
                },
                {
                  cacheDeleteStatus: 'processing',
                  cacheDeleteProcessingStartedAt: { $lte: staleBefore },
                },
              ],
            },
          ],
        },
        {
          $set: {
            cacheDeleteStatus: 'processing',
            cacheDeleteProcessingStartedAt: now,
            cacheDeleteLastError: '',
          },
          $inc: { cacheDeleteAttempts: 1 },
          $unset: { cacheDeleteNextAttemptAt: 1 },
        },
        {
          sort: { createdAt: 1 },
          returnDocument: 'after',
        },
      )
      .lean();
    if (!job) return null;

    return {
      jobId: String(job._id),
      imageId: String(job.imageId),
      collectionId: String(job.collectionId),
      keys: (job.cacheObjectKeys ?? []).map((value) => String(value)).filter(Boolean),
      urls: (job.cachePublicUrls ?? []).map((value) => String(value)).filter(Boolean),
      transformUrls: (job.cacheTransformUrls ?? [])
        .map((value) => String(value))
        .filter(Boolean),
    };
  }

  async completeImagorResultCacheDeleteJob(
    jobId: string,
    body: { success?: boolean; error?: string },
  ) {
    if (!Types.ObjectId.isValid(jobId)) return { accepted: false };
    const success = Boolean(body?.success);
    const job = await this.imageDeleteJobModel.findById(jobId).lean();
    if (!job) return { accepted: false };

    if (success) {
      await this.imageDeleteJobModel.updateOne(
        { _id: jobId },
        {
          $set: {
            cacheDeleteStatus: 'completed',
            cacheDeletedAt: new Date(),
            cacheDeleteLastError: '',
          },
          $unset: {
            cacheDeleteProcessingStartedAt: 1,
            cacheDeleteNextAttemptAt: 1,
          },
        },
      );
      return { accepted: true };
    }

    const attempts = Math.max(1, Number(job.cacheDeleteAttempts ?? 1));
    const retryDelayMs = Math.min(
      60 * 60_000,
      10_000 * 2 ** Math.min(8, Math.max(0, attempts - 1)),
    );
    await this.imageDeleteJobModel.updateOne(
      { _id: jobId },
      {
        $set: {
          cacheDeleteStatus: 'queued',
          cacheDeleteNextAttemptAt: new Date(Date.now() + retryDelayMs),
          cacheDeleteLastError: String(body?.error || 'Imagor R2 cache delete failed').slice(0, 1000),
        },
        $unset: { cacheDeleteProcessingStartedAt: 1 },
      },
    );
    return { accepted: true };
  }

  private async invalidateCollectionImageCache(collectionId: string) {
    if (!this.imagorService.isEnabled()) return;
    const now = new Date();
    await Promise.all([
      this.collectionModel.updateOne(
        { _id: collectionId },
        {
          $set: {
            imageCacheStatus: 'warming',
            imageCacheVersion: IMAGE_CACHE_VERSION,
          },
          $unset: { imageCacheReadyAt: 1 },
        },
      ),
      this.imageModel.updateMany(
        {
          collectionId,
          mediaType: { $ne: 'video' },
          $and: [this.imageCacheSourceClause()],
        } as any,
        {
          $set: {
            'metadata.imageCache.status': 'stale',
            'metadata.imageCache.version': IMAGE_CACHE_VERSION,
            'metadata.imageCache.nextAttemptAt': now,
          },
          $unset: { 'metadata.imageCache.processingStartedAt': 1 },
        },
      ),
    ]);
  }

  private async finalizeCollectionImageCache(collectionId: string) {
    const pending = await this.imageModel.exists({
      collectionId,
      mediaType: { $ne: 'video' },
      $and: [
        this.imageCacheSourceClause(),
        {
          $or: [
            { 'metadata.imageCache.version': { $ne: IMAGE_CACHE_VERSION } },
            { 'metadata.imageCache.status': { $ne: 'ready' } },
          ],
        },
      ],
    } as any);
    if (pending) return false;

    await this.collectionModel.updateOne(
      { _id: collectionId },
      {
        $set: {
          imageCacheStatus: 'ready',
          imageCacheVersion: IMAGE_CACHE_VERSION,
          imageCacheReadyAt: new Date(),
        },
      },
    );
    return true;
  }

  private async directImageCacheReady(collection: any) {
    if (
      collection?.imageCacheStatus !== 'ready' ||
      Number(collection?.imageCacheVersion ?? 0) !== IMAGE_CACHE_VERSION
    ) {
      return false;
    }

    const pending = await this.imageModel.exists({
      collectionId: String(collection._id),
      mediaType: { $ne: 'video' },
      $and: [
        this.imageCacheSourceClause(),
        {
          $or: [
            { 'metadata.imageCache.version': { $ne: IMAGE_CACHE_VERSION } },
            { 'metadata.imageCache.status': { $ne: 'ready' } },
          ],
        },
      ],
    } as any);
    if (!pending) return true;

    void this.collectionModel
      .updateOne(
        { _id: collection._id },
        {
          $set: {
            imageCacheStatus: 'warming',
            imageCacheVersion: IMAGE_CACHE_VERSION,
          },
          $unset: { imageCacheReadyAt: 1 },
        },
      )
      .catch(() => undefined);
    return false;
  }

  @Interval(2000)
  async processImageDeleteQueueTick() {
    if (!backgroundWorkerEnabled()) return;
    if (this.imageDeleteWorkerRunning) return;
    this.imageDeleteWorkerRunning = true;
    try {
      const now = Date.now();
      if (now - this.lastImageDeleteRecoveryAt >= 60_000) {
        this.lastImageDeleteRecoveryAt = now;
        await this.imageDeleteJobModel.updateMany(
          {
            status: 'processing',
            processingStartedAt: { $lte: new Date(now - 5 * 60 * 1000) },
          },
          {
            $set: {
              status: 'queued',
              nextAttemptAt: new Date(now),
              lastError: 'Recovered after an interrupted delete worker',
            },
            $unset: { processingStartedAt: 1 },
          },
        );
        await this.imageDeleteJobModel.deleteMany({
          status: 'completed',
          completedAt: { $lte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
          $or: [
            {
              $and: [
                { 'cacheObjectKeys.0': { $exists: false } },
                { 'cacheTransformUrls.0': { $exists: false } },
              ],
            },
            { cacheDeleteStatus: 'completed' },
          ],
        });
      }

      await Promise.all(
        Array.from(
          { length: this.imageDeleteWorkerConcurrency() },
          () => this.processNextImageDeleteJob(),
        ),
      );
    } finally {
      this.imageDeleteWorkerRunning = false;
    }
  }

  private imageDeleteWorkerConcurrency() {
    const configured = Number(
      this.configService.get<string>('IMAGE_DELETE_BACKGROUND_CONCURRENCY') ?? 2,
    );
    return Math.max(
      1,
      Math.min(
        4,
        Number.isFinite(configured) ? Math.floor(configured) : 2,
      ),
    );
  }

  private async processNextImageDeleteJob() {
    const now = new Date();
    const job = await this.imageDeleteJobModel.findOneAndUpdate(
      {
        status: 'queued',
        $or: [
          { nextAttemptAt: { $lte: now } },
          { nextAttemptAt: { $exists: false } },
        ],
      },
      {
        $set: {
          status: 'processing',
          processingStartedAt: now,
          lastError: '',
        },
        $unset: { nextAttemptAt: 1 },
        $inc: { attempts: 1 },
      },
      {
        returnDocument: 'after',
        sort: { createdAt: 1 },
      },
    );
    if (!job) return;

    const heartbeat = setInterval(() => {
      void this.imageDeleteJobModel
        .updateOne(
          { _id: job._id, status: 'processing' },
          { $set: { processingStartedAt: new Date() } },
        )
        .catch(() => undefined);
    }, 30_000);

    try {
      const imageStillExists = await this.imageModel.exists({
        _id: job.imageId,
        userId: job.userId,
        collectionId: job.collectionId,
      });
      if (imageStillExists) {
        await this.imageDeleteJobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'queued',
              nextAttemptAt: new Date(Date.now() + 2_000),
              lastError: '',
            },
            $unset: { processingStartedAt: 1 },
          },
        );
        return;
      }

      const publicReferences = [
        ...new Set(
          (job.publicReferences ?? [])
            .map((value) => String(value || '').trim())
            .filter(Boolean),
        ),
      ];
      const privateObjectKeys = [
        ...new Set(
          (job.privateObjectKeys ?? [])
            .map((value) => String(value || '').trim())
            .filter(Boolean),
        ),
      ];
      await Promise.all([
        ...publicReferences.map((reference) =>
          this.minioService.deleteService(reference),
        ),
        ...privateObjectKeys.map((objectKey) =>
          this.minioService.deletePrivateFile(objectKey),
        ),
      ]);

      await this.faceSearchService
        .deleteImageFaces(job.collectionId, job.imageId)
        .catch(() => undefined);

      await this.imageDeleteJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            lastError: '',
          },
          $unset: { processingStartedAt: 1, nextAttemptAt: 1 },
        },
      );
    } catch (error) {
      const attempts = Math.max(1, Number(job.attempts ?? 1));
      const retryDelayMs = Math.min(
        15 * 60_000,
        5_000 * 2 ** Math.min(8, Math.max(0, attempts - 1)),
      );
      const message =
        error instanceof Error ? error.message : String(error ?? 'Delete failed');
      await this.imageDeleteJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'queued',
            nextAttemptAt: new Date(Date.now() + retryDelayMs),
            lastError: message.slice(0, 1600),
          },
          $unset: { processingStartedAt: 1 },
        },
      );
    } finally {
      clearInterval(heartbeat);
    }
  }

  async removeImage(userId: string, collectionId: string, imageId: string) {
    const result = await this.removeImages(userId, collectionId, [imageId]);
    if (!result.deleted) throw new NotFoundException('Image not found');
    return result.items[0];
  }

  async removeImages(
    userId: string,
    collectionId: string,
    imageIds: string[],
  ) {
    const ids = [
      ...new Set(
        (Array.isArray(imageIds) ? imageIds : [])
          .map((id) => String(id || '').trim())
          .filter((id) => Types.ObjectId.isValid(id)),
      ),
    ];
    if (!ids.length) throw new BadRequestException('Images are required');
    if (ids.length > 2000)
      throw new BadRequestException('Up to 2000 images can be deleted at once');

    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const images = await this.imageModel
      .find({ _id: { $in: ids }, userId, collectionId })
      .select(
        '+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes',
      )
      .lean();
    if (!images.length) {
      return { deleted: 0, imageIds: [], items: [] };
    }

    const deletingIds = images.map((image) => image._id.toString());
    const candidatePrivateKeys = [
      ...new Set(
        images
          .flatMap((image) => [
            String(image.originalObjectKey ?? '').trim(),
            String(
              (image.metadata as Record<string, any> | undefined)
                ?.directUploadObjectKey ?? '',
            ).trim(),
          ])
          .filter(Boolean),
      ),
    ];
    const sharedRows = candidatePrivateKeys.length
      ? await this.imageModel
          .find({
            _id: { $nin: deletingIds },
            $or: [
              { originalObjectKey: { $in: candidatePrivateKeys } },
              {
                'metadata.directUploadObjectKey': {
                  $in: candidatePrivateKeys,
                },
              },
            ],
          })
          .select('+originalObjectKey metadata')
          .lean()
      : [];
    const sharedPrivateKeys = new Set(
      sharedRows
        .flatMap((image) => [
          String(image.originalObjectKey ?? '').trim(),
          String(
            (image.metadata as Record<string, any> | undefined)
              ?.directUploadObjectKey ?? '',
          ).trim(),
        ])
        .filter(Boolean),
    );

    const now = new Date();
    await this.imageDeleteJobModel.bulkWrite(
      images.map((image) => {
        const metadata = (image.metadata ?? {}) as Record<string, any>;
        const directObjectKey = String(
          metadata.directUploadObjectKey ?? '',
        ).trim();
        const storageMode = String(metadata.storageMode ?? '');
        const publicReferences =
          ['original-imgproxy', 'original-imagor'].includes(storageMode)
            ? []
            : [image.url, image.thumbnailUrl, image.filename].filter(
                Boolean,
              ) as string[];
        const privateObjectKeys = [
          String(image.originalObjectKey ?? '').trim(),
          directObjectKey,
        ].filter(
          (key) => Boolean(key) && !sharedPrivateKeys.has(key),
        ) as string[];
        const imageCacheKeys = Object.values(
          (metadata.imageCache?.keys ?? {}) as Record<string, unknown>,
        )
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        const imageCacheUrls = Object.values(
          (metadata.imageCache?.urls ?? {}) as Record<string, unknown>,
        )
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        const cacheTransformUrls = this.onDemandCacheTransformUrls(
          image as Record<string, any>,
        );
        const hasCacheCleanup =
          imageCacheKeys.length > 0 || cacheTransformUrls.length > 0;

        return {
          updateOne: {
            filter: { imageId: image._id.toString() },
            update: {
              $setOnInsert: {
                userId,
                collectionId,
                imageId: image._id.toString(),
                publicReferences: [...new Set(publicReferences)],
                privateObjectKeys: [...new Set(privateObjectKeys)],
                cacheObjectKeys: [...new Set(imageCacheKeys)],
                cachePublicUrls: [...new Set(imageCacheUrls)],
                cacheTransformUrls: [...new Set(cacheTransformUrls)],
                cacheDeleteStatus: hasCacheCleanup ? 'queued' : '',
                cacheDeleteAttempts: 0,
                cacheDeleteNextAttemptAt: hasCacheCleanup ? now : undefined,
                cacheDeleteLastError: '',
                status: 'queued',
                attempts: 0,
                nextAttemptAt: now,
                lastError: '',
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );

    const deletedIds = images.map((image) => image._id.toString());
    const directObjectKeys = [
      ...new Set(
        images
          .flatMap((image) => [
            String(image.originalObjectKey ?? '').trim(),
            String(
              (image.metadata as Record<string, any> | undefined)
                ?.directUploadObjectKey ?? '',
            ).trim(),
          ])
          .filter(Boolean),
      ),
    ];

    await Promise.all([
      this.imageModel.deleteMany({
        _id: { $in: deletedIds },
        userId,
        collectionId,
      }),
      this.imageFavoriteModel.deleteMany({
        imageId: { $in: deletedIds },
      }),
      directObjectKeys.length
        ? this.imageProcessingJobModel.deleteMany({
            userId,
            collectionId,
            objectKey: { $in: directObjectKeys },
          })
        : Promise.resolve(),
    ]);

    const reclaimedBytes = images.reduce((sum, image) => {
      const metadata = (image.metadata ?? {}) as Record<string, any>;
      const storageKey =
        String(image.originalObjectKey ?? '').trim() ||
        String(metadata.directUploadObjectKey ?? '').trim();
      if (storageKey && sharedPrivateKeys.has(storageKey)) return sum;
      return sum + Math.max(0, Number(image.sizeBytes ?? 0));
    }, 0);
    const nextImage = await this.imageModel
      .findOne({ userId, collectionId })
      .sort({ createdAt: -1 })
      .lean();
    const deletedUrls = new Set(images.map((image) => image.url).filter(Boolean));
    const update: Record<string, any> = {
      $inc: { imageCount: -images.length },
    };
    if (collection.coverImage && deletedUrls.has(collection.coverImage)) {
      if (nextImage?.url) update.$set = { coverImage: nextImage.url };
      else update.$unset = { coverImage: '' };
    }

    await Promise.all([
      this.collectionModel.updateOne({ _id: collectionId, userId }, update),
      this.decrementStorageUsedBytes(userId, reclaimedBytes),
    ]);
    if (collection.status === 'published') {
      await this.queueUpdatedCollection(
        collection,
        this.galleryUpdateEventId(collectionId),
      ).catch(() => undefined);
    }

    return {
      deleted: images.length,
      imageIds: deletedIds,
      items: images.map((image) => this.publicImageRecord(image as any)),
    };
  }

  async moveImages(
    userId: string,
    collectionId: string,
    imageIds: string[],
    targetCollectionIdInput: string,
    targetSetIdInput?: string,
  ) {
    const ids = [
      ...new Set(
        (Array.isArray(imageIds) ? imageIds : [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    ];
    if (!ids.length) throw new BadRequestException('Select at least one image');
    if (ids.length > 5000)
      throw new BadRequestException('Move up to 5000 images at a time');
    if (ids.some((id) => !Types.ObjectId.isValid(id)))
      throw new BadRequestException('Invalid image selection');

    const targetCollectionId = String(targetCollectionIdInput ?? '').trim();
    if (!Types.ObjectId.isValid(targetCollectionId))
      throw new BadRequestException('Target collection is required');

    const [sourceCollection, targetCollection, images] = await Promise.all([
      this.collectionModel
        .findOne({ _id: collectionId, userId })
        .select('userId name slug status clientEmails coverImage sets')
        .lean(),
      this.collectionModel
        .findOne({ _id: targetCollectionId, userId })
        .select('userId name slug status clientEmails coverImage sets')
        .lean(),
      this.imageModel
        .find({
          _id: { $in: ids },
          userId,
          collectionId,
        })
        .select('_id url setId')
        .lean(),
    ]);
    if (!sourceCollection)
      throw new NotFoundException('Collection not found');
    if (!targetCollection)
      throw new NotFoundException('Target collection not found');
    if (images.length !== ids.length)
      throw new BadRequestException(
        'Some selected images are no longer available. Refresh and try again.',
      );

    const targetSetId =
      String(targetSetIdInput ?? '').trim() ||
      targetCollection.sets?.[0]?.id ||
      'highlights';
    if (
      targetSetId &&
      !targetCollection.sets?.some((set) => set.id === targetSetId)
    ) {
      throw new BadRequestException('Target set not found');
    }

    const movedIds = images.map((image) => image._id.toString());
    const movingWithinCollection = targetCollectionId === collectionId;

    if (movingWithinCollection) {
      await this.imageModel.updateMany(
        {
          _id: { $in: movedIds },
          userId,
          collectionId,
        },
        {
          $set: {
            setId: targetSetId,
            'metadata.imageCache.status': 'stale',
            'metadata.imageCache.version': IMAGE_CACHE_VERSION,
            'metadata.imageCache.nextAttemptAt': new Date(),
          },
        },
      );
    } else {
      const lastTargetImage = await this.imageModel
        .findOne({ userId, collectionId: targetCollectionId })
        .sort({ order: -1, createdAt: -1 })
        .select('order')
        .lean();
      const firstOrder = Math.max(0, Number(lastTargetImage?.order ?? 0)) + 1;
      await this.imageModel.bulkWrite(
        movedIds.map((imageId, index) => ({
          updateOne: {
            filter: { _id: imageId, userId, collectionId },
            update: {
              $set: {
                collectionId: targetCollectionId,
                setId: targetSetId,
                order: firstOrder + index,
                'metadata.imageCache.status': 'stale',
                'metadata.imageCache.version': IMAGE_CACHE_VERSION,
                'metadata.imageCache.nextAttemptAt': new Date(),
              },
            },
          },
        })),
        { ordered: false },
      );
    }

    if (!movingWithinCollection) {
      const movedUrls = new Set(images.map((image) => image.url).filter(Boolean));
      const sourceCoverMoved =
        Boolean(sourceCollection.coverImage) &&
        movedUrls.has(String(sourceCollection.coverImage));

      const [sourceCount, targetCount] = await Promise.all([
        this.imageModel.countDocuments({ userId, collectionId }),
        this.imageModel.countDocuments({
          userId,
          collectionId: targetCollectionId,
        }),
      ]);

      let nextSourceCover = sourceCollection.coverImage;
      if (sourceCoverMoved) {
        const nextCover = await this.imageModel
          .findOne({ userId, collectionId })
          .sort({ order: 1, createdAt: 1 })
          .select('url')
          .lean();
        nextSourceCover = nextCover?.url || undefined;
      }

      await Promise.all([
        this.collectionModel.updateOne(
          { _id: collectionId, userId },
          nextSourceCover
            ? {
                $set: {
                  imageCount: sourceCount,
                  coverImage: nextSourceCover,
                },
              }
            : {
                $set: { imageCount: sourceCount },
                $unset: { coverImage: 1 },
              },
        ),
        this.collectionModel.updateOne(
          { _id: targetCollectionId, userId },
          {
            $set: {
              imageCount: targetCount,
              coverImage:
                targetCollection.coverImage || images[0]?.url || undefined,
            },
          },
        ),
      ]);
    }

    if (this.imagorService.isEnabled()) {
      await this.collectionModel.updateOne(
        { _id: targetCollectionId, userId },
        {
          $set: {
            imageCacheStatus: 'warming',
            imageCacheVersion: IMAGE_CACHE_VERSION,
          },
          $unset: { imageCacheReadyAt: 1 },
        },
      );
    }
    if (sourceCollection.status === 'published') {
      await this.queueUpdatedCollection(
        sourceCollection,
        this.galleryUpdateEventId(collectionId),
      ).catch(() => undefined);
    }
    if (
      targetCollectionId !== collectionId &&
      targetCollection.status === 'published'
    ) {
      await this.queueUpdatedCollection(
        targetCollection,
        this.galleryUpdateEventId(targetCollectionId),
      ).catch(() => undefined);
    }

    return {
      moved: movedIds.length,
      imageIds: movedIds,
      targetCollectionId,
      targetSetId,
    };
  }

  async updateImage(
    userId: string,
    collectionId: string,
    imageId: string,
    dto: { originalName?: string; setId?: string; watermarkId?: string },
  ) {
    const image = await this.imageModel
      .findOne({
        _id: imageId,
        userId,
        collectionId,
      })
      .select(
        '+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes',
      );
    if (!image) throw new NotFoundException('Image not found');
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .select('userId name slug status clientEmails sets')
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    if (dto.originalName !== undefined) {
      const name = String(dto.originalName ?? '')
        .trim()
        .slice(0, 240);
      if (!name) throw new BadRequestException('Filename is required');
      image.originalName = name;
      image.metadata = { ...(image.metadata ?? {}), filename: name };
    }
    if (dto.setId !== undefined) {
      const setId = String(dto.setId ?? '').trim();
      if (setId && !collection.sets?.some((set) => set.id === setId)) {
        throw new BadRequestException('Set not found');
      }
      image.setId = setId || undefined;
    }
    if (dto.watermarkId !== undefined) {
      const watermarkId = String(dto.watermarkId ?? '').trim();
      if (watermarkId && watermarkId !== 'No watermark')
        await this.resolveWatermarkById(userId, watermarkId);
      image.metadata = { ...(image.metadata ?? {}), watermarkId };
      image.watermarked = false;
    }
    if (dto.watermarkId !== undefined || dto.setId !== undefined) {
      image.metadata = {
        ...(image.metadata ?? {}),
        imageCache: {
          ...((image.metadata as any)?.imageCache ?? {}),
          version: IMAGE_CACHE_VERSION,
          status: 'stale',
          nextAttemptAt: new Date(),
        },
      };
    }
    await image.save();
    if (
      this.imagorService.isEnabled() &&
      (dto.watermarkId !== undefined || dto.setId !== undefined)
    ) {
      await this.collectionModel.updateOne(
        { _id: collectionId, userId },
        {
          $set: {
            imageCacheStatus: 'warming',
            imageCacheVersion: IMAGE_CACHE_VERSION,
          },
          $unset: { imageCacheReadyAt: 1 },
        },
      );
    }
    if (collection.status === 'published') {
      await this.queueUpdatedCollection(
        collection,
        this.galleryUpdateEventId(collectionId),
      ).catch(() => undefined);
    }
    const [publicImage] = await this.publicImageRecordsForCollection([
      image.toObject() as any,
    ]);
    return publicImage;
  }

  async copyMoveImage(
    userId: string,
    collectionId: string,
    imageId: string,
    dto: {
      mode?: 'copy' | 'move';
      targetCollectionId?: string;
      targetSetId?: string;
    },
  ) {
    const image = await this.imageModel
      .findOne({ _id: imageId, userId, collectionId })
      .select(
        '+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes',
      )
      .lean();
    if (!image) throw new NotFoundException('Image not found');
    const targetCollectionId = String(dto.targetCollectionId ?? '').trim();
    if (!Types.ObjectId.isValid(targetCollectionId))
      throw new BadRequestException('Target collection is required');
    const [sourceCollection, targetCollection] = await Promise.all([
      this.collectionModel.findOne({ _id: collectionId, userId }).lean(),
      this.collectionModel.findOne({ _id: targetCollectionId, userId }).lean(),
    ]);
    if (!sourceCollection) throw new NotFoundException('Collection not found');
    if (!targetCollection)
      throw new NotFoundException('Target collection not found');
    const targetSetId =
      String(dto.targetSetId ?? '').trim() ||
      targetCollection.sets?.[0]?.id ||
      'highlights';
    if (
      targetSetId &&
      !targetCollection.sets?.some((set) => set.id === targetSetId)
    ) {
      throw new BadRequestException('Target set not found');
    }
    if (dto.mode === 'move') {
      await this.imageModel.updateOne(
        { _id: imageId, userId, collectionId },
        {
          $set: {
            collectionId: targetCollectionId,
            setId: targetSetId,
            'metadata.imageCache.status': 'stale',
            'metadata.imageCache.version': IMAGE_CACHE_VERSION,
            'metadata.imageCache.nextAttemptAt': new Date(),
          },
        },
      );
      await this.collectionModel.updateOne(
        { _id: collectionId, userId },
        { $inc: { imageCount: -1 } },
      );
      await this.collectionModel.updateOne(
        { _id: targetCollectionId, userId },
        {
          $inc: { imageCount: 1 },
          $set: {
            coverImage: targetCollection.coverImage ?? image.url,
            ...(this.imagorService.isEnabled()
              ? {
                  imageCacheStatus: 'warming',
                  imageCacheVersion: IMAGE_CACHE_VERSION,
                }
              : {}),
          },
          ...(this.imagorService.isEnabled()
            ? { $unset: { imageCacheReadyAt: 1 } }
            : {}),
        },
      );
      if (sourceCollection.status === 'published') {
        await this.queueUpdatedCollection(
          sourceCollection,
          this.galleryUpdateEventId(collectionId),
        ).catch(() => undefined);
      }
      if (targetCollection.status === 'published') {
        await this.queueUpdatedCollection(
          targetCollection,
          this.galleryUpdateEventId(targetCollectionId),
        ).catch(() => undefined);
      }
      return { moved: true, imageId, targetCollectionId, targetSetId };
    }

    const lastImage = await this.imageModel
      .findOne({ collectionId: targetCollectionId, userId })
      .sort({ order: -1, createdAt: -1 })
      .select('order')
      .lean();
    const imageCopy = { ...(image as any) };
    delete imageCopy._id;
    delete imageCopy.createdAt;
    delete imageCopy.updatedAt;
    delete imageCopy.__v;
    imageCopy.metadata = { ...(imageCopy.metadata ?? {}) };
    delete imageCopy.metadata.imageCache;
    const copy = await this.imageModel.create({
      ...imageCopy,
      collectionId: targetCollectionId,
      setId: targetSetId,
      order: Math.max(0, Number(lastImage?.order ?? 0)) + 1,
    });
    await this.collectionModel.updateOne(
      { _id: targetCollectionId, userId },
      {
        $inc: { imageCount: 1 },
        $set: {
          coverImage: targetCollection.coverImage ?? image.url,
          ...(this.imagorService.isEnabled()
            ? {
                imageCacheStatus: 'warming',
                imageCacheVersion: IMAGE_CACHE_VERSION,
              }
            : {}),
        },
        ...(this.imagorService.isEnabled()
          ? { $unset: { imageCacheReadyAt: 1 } }
          : {}),
      },
    );
    if (targetCollection.status === 'published') {
      await this.queueUpdatedCollection(
        targetCollection,
        this.galleryUpdateEventId(targetCollectionId),
      ).catch(() => undefined);
    }
    const [publicCopy] = await this.publicImageRecordsForCollection([
      copy.toObject() as any,
    ]);
    return {
      copied: true,
      image: publicCopy,
      targetCollectionId,
      targetSetId,
    };
  }

  async starImage(
    userId: string,
    collectionId: string,
    imageId: string,
    starred: boolean,
  ) {
    const image = await this.imageModel.findOne({
      _id: imageId,
      userId,
      collectionId,
    });
    if (!image) throw new NotFoundException('Image not found');

    image.metadata = {
      ...(image.metadata ?? {}),
      starred: Boolean(starred),
    };
    await image.save();
    return image.toObject();
  }

  private async processAndSaveImage(
    userId: string,
    collectionId: string,
    file: Express.Multer.File,
    watermark: WatermarkData | null,
    setId?: string,
    order = 0,
    metadataDefaults: ImageMetadataDefaults = {},
  ) {
    const imageId = new Types.ObjectId();
    const directOriginalObjectKey = String(
      metadataDefaults.directUploadObjectKey ?? '',
    ).trim();
    if (directOriginalObjectKey) {
      const existing = await this.imageModel
        .findOne({
          userId,
          collectionId,
          'metadata.directUploadObjectKey': directOriginalObjectKey,
        })
        .lean();
      if (existing) return this.publicImageRecord(existing);
    }
    if (this.imagorService.isEnabled()) {
      const extension =
        extname(file.originalname)
          .toLowerCase()
          .replace(/[^.a-z0-9]/g, '')
          .slice(0, 12) || '.img';
      const originalObjectKey =
        directOriginalObjectKey ||
        `originals/${userId}/${collectionId}/${imageId.toString()}${extension}`;
      let originalStored = false;
      try {
        if (!directOriginalObjectKey) {
          await this.minioService.uploadPrivateFile(file, originalObjectKey);
          originalStored = true;
        }
        const image = await this.saveDirectImageForImagor(
          {
            userId,
            collectionId,
            setId,
            order,
            watermarkId: watermark?.id,
            watermarkData: watermark ?? undefined,
            objectKey: originalObjectKey,
            name: file.originalname,
            type: file.mimetype,
            size: Math.max(0, Number(file.size ?? 0)),
          },
          {
            manageCollection: false,
            queuePostUpload: false,
          },
        );
        return this.publicImageRecord(image);
      } catch (error) {
        if (originalStored) {
          await this.minioService
            .deletePrivateFile(originalObjectKey)
            .catch(() => undefined);
        }
        throw error;
      } finally {
        await this.safeUnlink(file.path);
      }
    }

    const extractedMetadata = directOriginalObjectKey
      ? {}
      : await this.extractMetadata(file);
    const metadata = this.buildReferenceMetadata(
      extractedMetadata,
      file,
      imageId.toString(),
      metadataDefaults,
    );
    const extension =
      extname(file.originalname)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, '')
        .slice(0, 12) || '.img';
    const originalObjectKey =
      directOriginalObjectKey ||
      `originals/${userId}/${collectionId}/${imageId.toString()}${extension}`;
    let originalTempPath = '';
    let processedPath = '';
    let galleryPath = '';
    let previewPath = '';
    let watermarked = false;
    let thumbnailUrl = '';
    let url = '';
    let blurDataUrl = '';
    let originalStored = false;

    try {
      const original = directOriginalObjectKey
        ? {
            file,
            tempPath: '',
            size: Math.max(0, Number(file.size ?? 0)),
          }
        : await this.preparePrivateOriginal(file);
      originalTempPath = original.tempPath;
      if (!directOriginalObjectKey) {
        await this.minioService.uploadPrivateFile(
          original.file,
          originalObjectKey,
        );
        originalStored = true;
      }

      let gallerySource = file;
      if (watermark) {
        const processed = await this.applyWatermark(file, watermark);
        if (processed) {
          processedPath = processed.path;
          gallerySource = {
            ...file,
            path: processed.path,
            filename: processed.filename,
          };
          watermarked = true;
        }
      }

      const gallery = await this.createGalleryImage(gallerySource);
      galleryPath = gallery.path;
      const galleryFile = {
        ...file,
        path: gallery.path,
        filename: gallery.filename,
        mimetype: 'image/jpeg',
        size: gallery.size,
      } as Express.Multer.File;

      const preview = await this.createImagePreview(galleryFile);
      previewPath = preview.path;
      blurDataUrl = preview.blurDataUrl;
      [thumbnailUrl, url] = await Promise.all([
        this.minioService.uploadFile({
          ...galleryFile,
          path: preview.path,
          filename: preview.filename,
          size: preview.size,
        }),
        this.minioService.uploadFile(galleryFile),
      ]);

      const storedBytes =
        Math.max(0, original.size) +
        Math.max(0, gallery.size) +
        Math.max(0, preview.size);
      const image = await this.imageModel.create({
        _id: imageId,
        userId,
        collectionId,
        setId,
        url,
        thumbnailUrl,
        blurDataUrl,
        originalName: file.originalname,
        filename: gallery.filename,
        originalObjectKey,
        originalFilename: file.originalname,
        originalMimeType: file.mimetype,
        originalSizeBytes: original.size,
        mimetype: 'image/jpeg',
        mediaType: 'image',
        sizeBytes: storedBytes,
        watermarked,
        order,
        metadata,
      });
      await this.userModel.updateOne(
        { _id: userId },
        { $inc: { storageUsedBytes: storedBytes } },
      );
      return this.publicImageRecord(image.toObject());
    } catch (error) {
      await Promise.allSettled([
        ...(url ? [this.minioService.deleteService(url)] : []),
        ...(thumbnailUrl
          ? [this.minioService.deleteService(thumbnailUrl)]
          : []),
        ...(originalStored
          ? [this.minioService.deletePrivateFile(originalObjectKey)]
          : []),
      ]);
      throw error;
    } finally {
      await this.safeUnlink(file.path);
      if (originalTempPath) await this.safeUnlink(originalTempPath);
      if (processedPath) await this.safeUnlink(processedPath);
      if (galleryPath) await this.safeUnlink(galleryPath);
      if (previewPath) await this.safeUnlink(previewPath);
    }
  }

  private async preparePrivateOriginal(file: Express.Multer.File): Promise<{
    file: Express.Multer.File;
    tempPath: string;
    size: number;
  }> {
    const maxBytes = 20 * 1024 * 1024;
    const targetBytes = 18 * 1024 * 1024;
    const originalSize = Math.max(0, Number(file.size ?? 0));
    if (!originalSize || originalSize <= maxBytes) {
      return { file, tempPath: '', size: originalSize };
    }

    const mime = String(file.mimetype || '').toLowerCase();
    const supported = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/heic',
      'image/heif',
      'image/tiff',
      'image/gif',
    ]);
    if (!supported.has(mime)) {
      throw new BadRequestException(
        'Images larger than 20 MB must use a format that can be optimized without changing file type',
      );
    }

    const extension =
      extname(file.originalname)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, '')
        .slice(0, 12) || '.img';
    const outputPath = join(
      cwd(),
      'uploads',
      `original-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`,
    );
    const sourceMetadata = await sharp(file.path, {
      animated: mime === 'image/gif',
    })
      .timeout({ seconds: 60 })
      .metadata()
      .catch(() => ({} as Metadata));
    const initialRatio = Math.sqrt(targetBytes / Math.max(1, originalSize));
    let scale = Math.min(1, Math.max(0.3, initialRatio * 1.35));

    try {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        let output = sharp(file.path, {
          animated: mime === 'image/gif',
        })
          .timeout({ seconds: 120 })
          .withMetadata();

        if (
          scale < 0.999 &&
          sourceMetadata.width &&
          sourceMetadata.height
        ) {
          output = output.resize({
            width: Math.max(1, Math.round(sourceMetadata.width * scale)),
            height: Math.max(1, Math.round(sourceMetadata.height * scale)),
            fit: 'inside',
            withoutEnlargement: true,
          });
        }

        if (mime === 'image/jpeg' || mime === 'image/jpg') {
          const jpegQuality = [84, 80, 76, 72][attempt] ?? 72;
          output = output.jpeg({
            quality: jpegQuality,
            mozjpeg: false,
            progressive: true,
          });
        } else if (mime === 'image/png') {
          output = output.png({
            compressionLevel: 6,
            adaptiveFiltering: true,
          });
        } else if (mime === 'image/webp') {
          output = output.webp({ quality: [84, 80, 76, 72][attempt] ?? 72 });
        } else if (mime === 'image/avif') {
          output = output.avif({ quality: [68, 62, 58, 54][attempt] ?? 54 });
        } else if (mime === 'image/heic' || mime === 'image/heif') {
          output = output.heif({
            quality: [76, 72, 68, 64][attempt] ?? 64,
            compression: 'hevc',
          });
        } else if (mime === 'image/tiff') {
          output = output.tiff({
            quality: [84, 80, 76, 72][attempt] ?? 72,
            compression: 'jpeg',
          });
        } else if (mime === 'image/gif') {
          output = output.gif({ effort: 4 });
        }

        const info = await output.toFile(outputPath);
        if (info.size <= maxBytes) {
          return {
            file: {
              ...file,
              path: outputPath,
              filename: `original-${file.filename}`,
              size: info.size,
            },
            tempPath: outputPath,
            size: info.size,
          };
        }

        await this.safeUnlink(outputPath);
        const ratio = Math.sqrt(targetBytes / Math.max(1, info.size));
        scale = Math.max(0.1, scale * Math.min(0.88, ratio * 0.98));
      }
      throw new BadRequestException(
        'Original image could not be optimized below 20 MB while preserving its file format',
      );
    } catch (error) {
      await this.safeUnlink(outputPath);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Original image could not be optimized below 20 MB while preserving its file format',
      );
    }
  }

  private async createGalleryImage(file: Express.Multer.File) {
    const filename =
      `gallery-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const outputPath = join(cwd(), 'uploads', filename);
    const info = await sharp(file.path)
      .timeout({ seconds: 25 })
      .rotate()
      .resize({
        width: 1920,
        height: 1080,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 68,
        mozjpeg: false,
        progressive: true,
      })
      .toFile(outputPath);

    return {
      path: outputPath,
      filename,
      size: info.size,
    };
  }

  private publicImageRecord(
    image: Record<string, any>,
    watermark?: WatermarkData | null,
    sourceDimensions?: { width: number; height: number },
    directCacheAllowed = false,
  ) {
    const {
      originalObjectKey,
      originalFilename: _originalFilename,
      originalMimeType: _originalMimeType,
      originalSizeBytes: _originalSizeBytes,
      ...safe
    } = image ?? {};
    const fallbackDirectObjectKey = String(
      safe.metadata?.directUploadObjectKey ?? '',
    ).trim();
    const sourceObjectKey =
      String(originalObjectKey ?? '').trim() ||
      (fallbackDirectObjectKey.startsWith('private-direct/') ||
      fallbackDirectObjectKey.startsWith('direct/') ||
      fallbackDirectObjectKey.startsWith('originals/')
        ? fallbackDirectObjectKey
        : '');
    const storedWatermark =
      (safe.metadata?.imagorWatermark ??
        safe.metadata?.imgproxyWatermark) as ImagorWatermark | undefined;
    const imageCache = safe.metadata?.imageCache as
      | {
          version?: number;
          status?: string;
          keys?: Record<string, string>;
          urls?: Record<string, string>;
        }
      | undefined;
    if (safe.metadata) {
      const {
        imagorWatermark: _imagorWatermark,
        imgproxyWatermark: _legacyImgproxyWatermark,
        imageCache: _privateImageCache,
        ...publicMetadata
      } = safe.metadata;
      safe.metadata = publicMetadata;
    }

    const imagorWatermark =
      watermark === undefined
        ? storedWatermark
        : this.toImagorWatermark(watermark);
    const hasWatermark = this.imagorService.hasWatermark(imagorWatermark);
    const imagorUrls =
      this.imagorService.isEnabled() &&
      sourceObjectKey &&
      safe.mediaType !== 'video'
        ? this.imagorService.imageUrls(
            sourceObjectKey,
            imagorWatermark,
            sourceDimensions ?? { width: safe.width, height: safe.height },
          )
        : null;
    const cacheUrl = (variant: string) =>
      String(imageCache?.urls?.[variant] ?? '').trim();
    const directViewUrl = cacheUrl('view');
    const directSmallUrl = cacheUrl('small');

    if (
      directCacheAllowed &&
      Number(imageCache?.version ?? 0) === IMAGE_CACHE_VERSION &&
      imageCache?.status === 'ready' &&
      directViewUrl &&
      directSmallUrl &&
      safe.mediaType !== 'video'
    ) {
      return {
        ...safe,
        width: sourceDimensions?.width ?? safe.width,
        height: sourceDimensions?.height ?? safe.height,
        url: directViewUrl,
        // Thumbnail stays on-demand through Imagor. If Imagor is unavailable,
        // the tiny permanent small AVIF remains a safe direct-R2 fallback.
        thumbnailUrl: imagorUrls?.thumbnailUrl || directSmallUrl,
        responsive: {
          small: directSmallUrl,
          medium: directViewUrl,
          large: directViewUrl,
        },
        watermarked: hasWatermark,
        watermark: hasWatermark ? imagorWatermark : undefined,
        cacheDelivery: 'imagor-r2-result',
      };
    }

    if (imagorUrls) {
      const urls = imagorUrls;
      const storedFallbackUrl = String(safe.url ?? '').trim();
      const storedFallbackThumbnailUrl = String(
        safe.thumbnailUrl ?? '',
      ).trim();
      return {
        ...safe,
        width: sourceDimensions?.width ?? safe.width,
        height: sourceDimensions?.height ?? safe.height,
        url: urls.url,
        thumbnailUrl: urls.thumbnailUrl,
        responsive: urls.responsive,
        watermarked: hasWatermark,
        watermark: hasWatermark ? imagorWatermark : undefined,
        fallbackUrl:
          storedFallbackUrl && storedFallbackUrl !== urls.url
            ? storedFallbackUrl
            : undefined,
        fallbackThumbnailUrl:
          storedFallbackThumbnailUrl &&
          storedFallbackThumbnailUrl !== urls.thumbnailUrl
            ? storedFallbackThumbnailUrl
            : undefined,
        // Legacy public gallery copies may already contain the watermark in
        // the pixels. The browser must never draw a second overlay on those.
        fallbackWatermarked: Boolean(safe.watermarked),
      };
    }

    return safe;
  }

  private async currentCollectionCover(collection: any) {
    const storedCover = String(collection?.coverImage ?? '').trim();
    if (!storedCover || !this.imagorService.isEnabled()) {
      return storedCover;
    }

    const image = await this.imageModel
      .findOne({
        userId: String(collection.userId),
        collectionId: String(collection._id),
        mediaType: { $ne: 'video' },
        $or: [{ url: storedCover }, { thumbnailUrl: storedCover }],
      })
      .select(
        '+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes',
      )
      .lean();
    if (!image) return storedCover;
    const originalObjectKey =
      String(image?.originalObjectKey ?? '').trim() ||
      String(
        (image?.metadata as Record<string, any> | undefined)
          ?.directUploadObjectKey ?? '',
      ).trim();
    if (
      !originalObjectKey ||
      (!originalObjectKey.startsWith('private-direct/') &&
        !originalObjectKey.startsWith('direct/') &&
        !originalObjectKey.startsWith('originals/'))
    ) {
      return storedCover;
    }

    const explicitWatermarkId = String(
      (image.metadata as Record<string, any> | undefined)?.watermarkId ?? '',
    ).trim();
    const watermark = await this.resolveEffectiveWatermark(
      String(collection.userId),
      collection,
      String(image.setId || 'highlights'),
      explicitWatermarkId || undefined,
    );
    const storedWidth = Number(image.width);
    const storedHeight = Number(image.height);
    const sourceDimensions =
      Number.isFinite(storedWidth) &&
      Number.isFinite(storedHeight) &&
      storedWidth > 0 &&
      storedHeight > 0
        ? {
            width: Math.round(storedWidth),
            height: Math.round(storedHeight),
          }
        : undefined;
    if (!sourceDimensions) {
      void this.imagorService
        .resolveSourceDimensions(originalObjectKey)
        .then((dimensions) => {
          if (!dimensions) return;
          return this.imageModel.updateOne(
            { _id: image._id },
            {
              $set: {
                width: dimensions.width,
                height: dimensions.height,
              },
            },
          );
        })
        .catch(() => undefined);
    }
    const directCacheAllowed = await this.directImageCacheReady(collection);
    const publicImage = this.publicImageRecord(
      image as any,
      watermark,
      sourceDimensions,
      directCacheAllowed,
    );
    return publicImage?.url || storedCover;
  }

  private async publicImageRecordsForCollection(
    images: Record<string, any>[],
  ) {
    if (!images.length) return [];
    if (!this.imagorService.isEnabled()) {
      return images.map((image) => this.publicImageRecord(image));
    }

    const originalImages = images.filter((image) => {
      const key =
        String(image?.originalObjectKey ?? '').trim() ||
        String(image?.metadata?.directUploadObjectKey ?? '').trim();
      return (
        image?.mediaType !== 'video' &&
        (key.startsWith('private-direct/') ||
          key.startsWith('direct/') ||
          key.startsWith('originals/'))
      );
    });
    if (!originalImages.length) {
      return images.map((image) => this.publicImageRecord(image));
    }

    const first = originalImages[0];
    const collection = await this.collectionModel
      .findOne({
        _id: first.collectionId,
        userId: first.userId,
      })
      .select('userId presetId watermarkId sets imageCacheStatus imageCacheVersion imageCacheReadyAt')
      .lean();

    if (!collection) {
      return images.map((image) => this.publicImageRecord(image));
    }
    const directCacheAllowed = await this.directImageCacheReady(collection);

    // Never make a public-gallery request wait on Imagor/R2 metadata. Stored
    // dimensions are used immediately; missing legacy dimensions are repaired
    // asynchronously. This keeps the gallery responsive even if Imagor is
    // restarting or R2 credentials are temporarily wrong.
    const sourceDimensions = new Map<
      string,
      { width: number; height: number }
    >();
    for (const image of originalImages) {
      const sourceObjectKey =
        String(image?.originalObjectKey ?? '').trim() ||
        String(image?.metadata?.directUploadObjectKey ?? '').trim();
      if (!sourceObjectKey) continue;

      const width = Number(image.width);
      const height = Number(image.height);
      if (
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0
      ) {
        sourceDimensions.set(sourceObjectKey, {
          width: Math.round(width),
          height: Math.round(height),
        });
        continue;
      }

      void this.imagorService
        .resolveSourceDimensions(sourceObjectKey)
        .then((dimensions) => {
          if (!dimensions) return;
          return this.imageModel.updateOne(
            { _id: image._id },
            {
              $set: {
                width: dimensions.width,
                height: dimensions.height,
              },
            },
          );
        })
        .catch(() => undefined);
    }

    const watermarkCache = new Map<string, Promise<WatermarkData | null>>();
    const records: Record<string, any>[] = [];
    for (const image of images) {
      const sourceObjectKey =
        String(image?.originalObjectKey ?? '').trim() ||
        String(image?.metadata?.directUploadObjectKey ?? '').trim();
      if (
        image?.mediaType === 'video' ||
        (!sourceObjectKey.startsWith('private-direct/') &&
          !sourceObjectKey.startsWith('direct/') &&
          !sourceObjectKey.startsWith('originals/'))
      ) {
        records.push(this.publicImageRecord(image));
        continue;
      }

      const explicitWatermarkId = String(
        image?.metadata?.watermarkId ?? '',
      ).trim();
      const setId = String(image?.setId || 'highlights');
      const cacheKey = explicitWatermarkId
        ? `watermark:${explicitWatermarkId}`
        : `set:${setId}`;
      if (!watermarkCache.has(cacheKey)) {
        watermarkCache.set(
          cacheKey,
          explicitWatermarkId === 'No watermark'
            ? Promise.resolve(null)
            : this.resolveEffectiveWatermark(
                String(first.userId),
                collection,
                setId,
                explicitWatermarkId || undefined,
              ),
        );
      }
      const watermark = await watermarkCache.get(cacheKey)!;
      records.push(
        this.publicImageRecord(
          image,
          watermark,
          sourceDimensions.get(sourceObjectKey),
          directCacheAllowed,
        ),
      );
    }
    return records;
  }

  private imageProcessingConcurrency() {
    const configured = Number(
      this.configService.get<string>('IMAGE_UPLOAD_PROCESSING_CONCURRENCY') ??
        2,
    );
    return Math.max(
      1,
      Math.min(4, Number.isFinite(configured) ? Math.floor(configured) : 2),
    );
  }

  private assertImageFiles(files: Express.Multer.File[]) {
    const invalid = files.find(
      (file) =>
        !String(file.mimetype || '')
          .toLowerCase()
          .startsWith('image/'),
    );
    if (invalid)
      throw new BadRequestException(
        `${invalid.originalname || 'File'} is not supported by this upload endpoint`,
      );
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    const errors: unknown[] = [];
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const index = nextIndex++;
          try {
            results[index] = await mapper(items[index], index);
          } catch (error) {
            errors.push(error);
          }
        }
      }),
    );

    if (errors.length) throw errors[0];
    return results;
  }

  private sortImagesForGallery<
    T extends { order?: number; createdAt?: Date | string; _id?: unknown },
  >(images: T[]) {
    return [...images].sort((a, b) => {
      const aOrder = Number(a.order);
      const bOrder = Number(b.order);
      const aHasOrder = Number.isFinite(aOrder) && aOrder > 0;
      const bHasOrder = Number.isFinite(bOrder) && bOrder > 0;
      if (aHasOrder && bHasOrder) return aOrder - bOrder;
      if (aHasOrder) return -1;
      if (bHasOrder) return 1;
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    });
  }

  private async findVisiblePublicImagesPage(
    collectionId: string,
    limitValue?: string,
    offsetValue?: string,
    setId?: string,
  ) {
    const privateRows = await this.privatePhotoModel
      .find({ collectionId, status: 'approved' })
      .select('imageId')
      .lean();
    const hiddenImageIds = privateRows.map((row) => row.imageId);
    const query = this.withSetFilter(
      {
        collectionId,
        ...(hiddenImageIds.length ? { _id: { $nin: hiddenImageIds } } : {}),
      },
      setId,
    );
    return this.findImagesPage(query, limitValue, offsetValue);
  }

  private async findImagesPage(
    query: Record<string, unknown>,
    limitValue?: string,
    offsetValue?: string,
  ) {
    const limit = this.pageLimit(limitValue);
    const offset = this.pageOffset(offsetValue);
    const [items, total] = await Promise.all([
      this.imageModel
        .find(query)
        .select(
          '+originalObjectKey +originalFilename +originalMimeType +originalSizeBytes',
        )
        .sort({ order: 1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.imageModel.countDocuments(query),
    ]);
    const sorted = this.sortImagesForGallery(items);
    const publicItems = await this.publicImageRecordsForCollection(sorted as any[]);
    return {
      items: publicItems,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  private withSetFilter(
    query: Record<string, unknown>,
    setId?: string,
  ) {
    const normalizedSetId = String(setId ?? '').trim();
    if (!normalizedSetId || normalizedSetId === '__all__') return query;

    if (normalizedSetId === 'highlights') {
      return {
        ...query,
        $or: [
          { setId: 'highlights' },
          { setId: { $exists: false } },
          { setId: null },
          { setId: '' },
        ],
      };
    }

    return { ...query, setId: normalizedSetId };
  }

  private pageLimit(value?: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 48;
    return Math.min(120, Math.max(1, Math.floor(parsed)));
  }

  private pageOffset(value?: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  }

  private async createImagePreview(file: Express.Multer.File) {
    return this.createImagePreviewFromSharp(
      sharp(file.path).timeout({ seconds: 12 }).rotate(),
    );
  }

  private async createImagePreviewFromSharp(image: Sharp) {
    const filename = `thumb-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const outputPath = join(cwd(), 'uploads', filename);
    const blurDataUrl = await image
      .clone()
      .resize({
        width: 24,
        height: 24,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 35 })
      .toBuffer()
      .then((buffer) => `data:image/jpeg;base64,${buffer.toString('base64')}`)
      .catch(() => '');

    const info = await image
      .resize({
        width: 900,
        height: 900,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 74, mozjpeg: true })
      .toFile(outputPath);

    return { path: outputPath, filename, blurDataUrl, size: info.size };
  }

  private async ensureCollectionPreviews(collectionId: string) {
    const images = await this.imageModel
      .find({
        collectionId,
        mediaType: { $ne: 'video' },
        thumbnailUrl: { $in: [null, ''] },
        ...(this.imagorService.isEnabled()
          ? {
              $or: [
                { originalObjectKey: { $exists: false } },
                { originalObjectKey: null },
                { originalObjectKey: '' },
              ],
            }
          : {}),
      })
      .limit(30)
      .lean()
      .catch(() => []);

    for (const image of images) {
      const buffer = await this.readImageBuffer(image.url).catch(() => null);
      if (!buffer) continue;
      let previewPath = '';
      try {
        const preview = await this.createImagePreviewFromSharp(
          sharp(buffer).timeout({ seconds: 12 }).rotate(),
        );
        previewPath = preview.path;
        const thumbnailUrl = await this.minioService.uploadFile({
          path: preview.path,
          filename: preview.filename,
          mimetype: 'image/jpeg',
          originalname: preview.filename,
          size: 0,
        } as Express.Multer.File);
        await this.imageModel.updateOne(
          { _id: image._id },
          { $set: { thumbnailUrl, blurDataUrl: preview.blurDataUrl } },
        );
      } catch {
        continue;
      } finally {
        if (previewPath) await this.safeUnlink(previewPath);
      }
    }
  }

  private async readImageBuffer(url: string) {
    if (url.startsWith('/uploads/')) {
      const localPath = join(cwd(), url.replace(/^\/uploads\//, 'uploads/'));
      return existsSync(localPath) ? readFile(localPath) : null;
    }
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  private async extractMetadata(file: Express.Multer.File) {
    const sharpMeta: Partial<Metadata> = await sharp(file.path)
      .timeout({ seconds: 8 })
      .metadata()
      .catch(() => ({}));
    const exif = await exifr
      .parse(file.path, { exif: true, iptc: true, xmp: true })
      .catch(() => null);
    const dateTaken = exif?.DateTimeOriginal ?? exif?.DateCreated ?? exif?.CreateDate;
    const city = exif?.City ?? exif?.LocationCreatedCity ?? '';
    const country =
      exif?.Country ??
      exif?.CountryPrimaryLocationName ??
      exif?.LocationCreatedCountryName ??
      '';
    const state = exif?.State ?? exif?.ProvinceState ?? '';
    const photographer =
      exif?.Byline ?? exif?.Creator ?? exif?.Artist ?? exif?.Author ?? '';
    const keywords = exif?.keywords ?? exif?.Keywords ?? exif?.Subject ?? [];

    return {
      filename: file.originalname,
      orientation: sharpMeta.orientation,
      colorSpace: sharpMeta.space,
      width: sharpMeta.width,
      height: sharpMeta.height,
      format: sharpMeta.format,
      camera: [exif?.Make, exif?.Model].filter(Boolean).join(' ') || exif?.Make,
      make: exif?.Make,
      model: exif?.Model,
      lens: exif?.LensModel,
      focalLength: exif?.FocalLength,
      focalLength35mm: exif?.FocalLengthIn35mmFormat,
      shutterSpeed: exif?.ExposureTime,
      aperture: exif?.FNumber,
      iso: exif?.ISO,
      flash: exif?.Flash,
      meteringMode: exif?.MeteringMode,
      exposureMode: exif?.ExposureMode,
      exposureProgram: exif?.ExposureProgram,
      whiteBalance: exif?.WhiteBalance,
      dateTaken,
      eventDate: dateTaken,
      software: exif?.Software,
      artist: exif?.Artist,
      photographer,
      credit: exif?.Credit ?? '',
      source: exif?.Source ?? '',
      copyright: exif?.Copyright,
      city,
      state,
      country,
      countryCode: exif?.CountryCode ?? exif?.CountryPrimaryLocationCode ?? '',
      location: exif?.SubLocation ?? exif?.Location ?? '',
      cityCountry: [city, country].filter(Boolean).join(', '),
      gps:
        exif?.latitude && exif?.longitude
          ? {
              latitude: exif.latitude,
              longitude: exif.longitude,
              altitude: exif?.GPSAltitude,
            }
          : undefined,
      title: exif?.title ?? exif?.Title ?? '',
      caption: exif?.description ?? exif?.Description ?? exif?.Caption ?? '',
      headline: exif?.Headline ?? '',
      objectName: exif?.ObjectName ?? '',
      genre: exif?.Genre ?? exif?.Category ?? '',
      transmissionRef:
        exif?.TransmissionReference ?? exif?.OriginalTransmissionReference ?? '',
      keyword: keywords,
      keywords,
      rating: exif?.Rating,
      colorLabel: exif?.Label,
      raw: this.compactMetadata(exif),
      starred: false,
    };
  }

  private buildReferenceMetadata(
    extracted: Record<string, any>,
    file: Express.Multer.File,
    itemNumber: string,
    defaults: ImageMetadataDefaults,
  ) {
    const uploadedAt = new Date();
    const eventDate = this.metadataDate(extracted.eventDate ?? extracted.dateTaken);
    const photographer = this.metadataText(
      extracted.photographer || extracted.artist || defaults.photographer,
    );
    const credit = this.metadataText(extracted.credit || defaults.credit || photographer);
    const source = this.metadataText(extracted.source || defaults.source || credit);
    const city = this.metadataText(extracted.city);
    const country = this.metadataText(extracted.country);
    const fallbackTitle = this.metadataText(
      file.originalname.replace(extname(file.originalname), '').replace(/[-_]+/g, ' '),
    );
    const year = eventDate ? new Date(eventDate).getUTCFullYear() : uploadedAt.getUTCFullYear();
    const copyright = this.metadataText(extracted.copyright) ||
      (credit ? `© ${year} ${credit}` : `© ${year}`);
    const width = Number(extracted.width || 0);
    const height = Number(extracted.height || 0);

    return {
      ...extracted,
      itemNumber,
      date: uploadedAt.toISOString(),
      eventDate,
      genre: this.metadataText(extracted.genre),
      credit,
      photographer,
      objectName: this.metadataText(extracted.objectName),
      headline: this.metadataText(extracted.headline),
      caption: this.metadataText(extracted.caption),
      title: this.metadataText(extracted.title) || fallbackTitle,
      fileTitle: this.metadataText(extracted.title) || fallbackTitle,
      description: this.metadataText(extracted.description || extracted.caption),
      city,
      country,
      cityCountry: this.metadataText(extracted.cityCountry) || [city, country].filter(Boolean).join(', '),
      copyright,
      source,
      size: width > 0 && height > 0 ? `${width} x ${height}` : '',
      transmissionRef: this.metadataText(extracted.transmissionRef) || itemNumber,
      ...(defaults.directUploadObjectKey
        ? { directUploadObjectKey: defaults.directUploadObjectKey }
        : {}),
    };
  }

  private imageDisplayName(image: any, fallback = '') {
    const metadata = (image?.metadata ?? {}) as Record<string, any>;
    return this.metadataText(
      metadata.fileTitle || metadata.title || image?.originalName || metadata.filename || fallback,
    );
  }

  private metadataText(value: unknown) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private metadataDate(value: unknown) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? this.metadataText(value) : date.toISOString();
  }

  private async resolveWatermark(userId: string, presetId: string) {
    const preset = await this.settingModel
      .findOne({ userId, type: DashboardSettingType.PRESET, localId: presetId })
      .lean();
    const presetData = preset?.data as any;
    const defaultWatermark =
      presetData?.general?.defaultWatermark ??
      presetData?.presetGeneral?.defaultWatermark;

    if (!defaultWatermark || defaultWatermark === 'No watermark') return null;

    const watermark = await this.settingModel
      .findOne({
        userId,
        type: DashboardSettingType.WATERMARK,
        $or: [
          { localId: defaultWatermark },
          { name: defaultWatermark },
          { 'data.id': defaultWatermark },
          { 'data.name': defaultWatermark },
        ],
      })
      .lean();

    return (watermark?.data as WatermarkData) ?? null;
  }

  private async resolveWatermarkById(userId: string, watermarkId: string) {
    const watermark = await this.settingModel
      .findOne({
        userId,
        type: DashboardSettingType.WATERMARK,
        $or: [
          { localId: watermarkId },
          { name: watermarkId },
          { 'data.id': watermarkId },
          { 'data.name': watermarkId },
        ],
      })
      .lean();

    return (watermark?.data as WatermarkData) ?? null;
  }

  private async applyWatermark(
    file: Express.Multer.File,
    watermark: WatermarkData,
  ) {
    const image = sharp(file.path)
      .timeout({ seconds: 25 })
      .rotate();
    const meta = await image.metadata();
    const width = meta.width ?? 1200;
    const height = meta.height ?? 800;
    const rawPosition = watermark.position ?? { x: 15, y: 85 };
    const opacity = (watermark.opacity ?? 90) / 100;
    const outputPath = join(cwd(), 'uploads', `wm-${file.filename}`);
    const outputFilename = `wm-${file.filename}`;

    try {
      if (watermark.type === 'text') {
        const text = this.escapeSvg(watermark.text || 'Watermark');
        const fontFamily = this.watermarkFontFamily(watermark.font);
        const fontSize = this.watermarkTextSize(width, watermark.scale);
        const estimatedTextWidth =
          (watermark.text || 'Watermark').length * fontSize * 0.55;
        const padX = Math.min(45, Math.max(5, (estimatedTextWidth / width) * 50));
        const padY = Math.min(45, Math.max(5, (fontSize / height) * 60));
        const position = {
          x: this.clampPercent(rawPosition.x, padX, 100 - padX),
          y: this.clampPercent(rawPosition.y, padY, 100 - padY),
        };
        const svg = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <style>
            .watermark-text {
              font-family: ${fontFamily};
              font-size: ${fontSize}px;
              fill: ${watermark.color || '#ffffff'};
              opacity: ${opacity};
            }
          </style>
          <text class="watermark-text" x="${position.x}%" y="${position.y}%"
            text-anchor="middle" dominant-baseline="middle">${text}</text>
        </svg>
      `);

        await image
          .composite([{ input: svg, left: 0, top: 0 }])
          .toFile(outputPath);
        return { path: outputPath, filename: outputFilename };
      }

      const overlay = await this.readWatermarkImage(watermark.image);
      if (!overlay) return null;

      const overlayWidth = this.watermarkImageWidth(width, watermark.scale);
      const overlayBuffer = await sharp(overlay)
        .timeout({ seconds: 12 })
        .resize({ width: overlayWidth, withoutEnlargement: true })
        .ensureAlpha(opacity)
        .toBuffer();
      const overlayMeta = await sharp(overlayBuffer)
        .timeout({ seconds: 8 })
        .metadata();
      const overlayHeight = overlayMeta.height ?? overlayWidth;
      const position = {
        x: this.clampPercent(
          rawPosition.x,
          ((overlayMeta.width ?? overlayWidth) / width) * 50,
          100 - ((overlayMeta.width ?? overlayWidth) / width) * 50,
        ),
        y: this.clampPercent(
          rawPosition.y,
          (overlayHeight / height) * 50,
          100 - (overlayHeight / height) * 50,
        ),
      };
      const left = Math.round(
        (position.x / 100) * width - (overlayMeta.width ?? overlayWidth) / 2,
      );
      const top = Math.round((position.y / 100) * height - overlayHeight / 2);

      await image
        .composite([{ input: overlayBuffer, left, top }])
        .toFile(outputPath);
      return { path: outputPath, filename: outputFilename };
    } catch (error) {
      await this.safeUnlink(outputPath);
      throw error;
    }
  }

  private async readWatermarkImage(image?: string) {
    if (!image) return null;
    if (image.startsWith('/uploads/')) {
      const localPath = join(cwd(), image.replace(/^\/+/, ''));
      return existsSync(localPath) ? localPath : null;
    }
    if (image.startsWith('http')) {
      const response = await fetch(image).catch(() => null);
      if (!response?.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }
    return existsSync(image) ? image : null;
  }

  private async safeUnlink(path: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await unlink(path);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') return;
        if (!['EBUSY', 'EPERM'].includes(code ?? '') || attempt === 4) return;
        await delay(50 * 2 ** attempt);
      }
    }
  }

  private onDemandCacheTransformUrls(image: Record<string, any>) {
    const metadata = (image?.metadata ?? {}) as Record<string, any>;
    const sourceObjectKey =
      String(image?.originalObjectKey ?? '').trim() ||
      String(metadata.directUploadObjectKey ?? '').trim();
    if (!sourceObjectKey || !this.imagorService.isEnabled()) return [];

    const watermark =
      (metadata.imagorWatermark ??
        metadata.imgproxyWatermark) as ImagorWatermark | undefined;
    const urls = this.imagorService.imageUrls(
      sourceObjectKey,
      watermark,
      {
        width: Number(image?.width) || undefined,
        height: Number(image?.height) || undefined,
      },
    );
    return [String(urls?.thumbnailUrl ?? '').trim()].filter(Boolean);
  }

  private async deleteStoredImageFiles(image: CollectionImageDocument) {
    const storageMode = String(
      (image.metadata as Record<string, any> | undefined)?.storageMode ?? '',
    );
    const originalObjectKey = String(image.originalObjectKey ?? '').trim();

    if (!['original-imgproxy', 'original-imagor'].includes(storageMode)) {
      const references = [image.url, image.thumbnailUrl, image.filename].filter(
        Boolean,
      ) as string[];
      await Promise.all(
        [...new Set(references)].map((reference) =>
          this.minioService.deleteService(reference).catch(() => null),
        ),
      );
    }

    const cacheObjectKeys = Object.values(
      (((image.metadata as Record<string, any> | undefined)?.imageCache?.keys ??
        {}) as Record<string, unknown>),
    )
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const cachePublicUrls = Object.values(
      (((image.metadata as Record<string, any> | undefined)?.imageCache?.urls ??
        {}) as Record<string, unknown>),
    )
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const cacheTransformUrls = this.onDemandCacheTransformUrls(
      image.toObject() as Record<string, any>,
    );
    if (cacheObjectKeys.length || cacheTransformUrls.length) {
      const now = new Date();
      await this.imageDeleteJobModel
        .updateOne(
          { imageId: image._id.toString() },
          {
            $setOnInsert: {
              userId: String(image.userId),
              collectionId: String(image.collectionId),
              imageId: image._id.toString(),
              publicReferences: [],
              privateObjectKeys: [],
              status: 'completed',
              attempts: 0,
              nextAttemptAt: now,
              lastError: '',
              completedAt: now,
            },
            $set: {
              cacheObjectKeys: [...new Set(cacheObjectKeys)],
              cachePublicUrls: [...new Set(cachePublicUrls)],
              cacheTransformUrls: [...new Set(cacheTransformUrls)],
              cacheDeleteStatus: 'queued',
              cacheDeleteAttempts: 0,
              cacheDeleteNextAttemptAt: now,
              cacheDeleteLastError: '',
            },
          },
          { upsert: true },
        )
        .catch(() => undefined);
    }

    if (originalObjectKey) {
      const sharedReference = await this.imageModel.exists({
        _id: { $ne: image._id },
        originalObjectKey,
      });
      if (!sharedReference) {
        await this.minioService
          .deletePrivateFile(originalObjectKey)
          .catch(() => null);
      }
    }
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private randomSlugSuffix() {
    return Math.random().toString(36).slice(2, 8);
  }

  private async uniqueSlug(userId: string, value: string, excludeId?: string) {
    const base = this.slugify(value) || 'collection';
    const exists = async (slug: string) => {
      const query: Record<string, unknown> = { userId, slug };
      if (excludeId) query._id = { $ne: excludeId };
      return this.collectionModel.exists(query);
    };

    if (!(await exists(base))) return base;
    for (let index = 0; index < 6; index += 1) {
      const candidate = `${base}-${this.randomSlugSuffix()}`;
      if (!(await exists(candidate))) return candidate;
    }
    return `${base}-${Date.now().toString(36)}-${this.randomSlugSuffix()}`;
  }

  private async findCollectionByIdentifier(
    identifier: string,
    siteSlug?: string,
  ) {
    const query: Record<string, string>[] = [
      { slug: identifier },
      { name: identifier },
    ];
    if (identifier.match(/^[a-f\d]{24}$/i)) query.unshift({ _id: identifier });
    const requestedSiteSlug = String(siteSlug ?? '').trim().toLowerCase();
    const owner = requestedSiteSlug
      ? await this.homepageModel
          .findOne({
            enabled: true,
            $or: [
              { slug: requestedSiteSlug },
              { subdomains: { $elemMatch: { slug: requestedSiteSlug, enabled: { $ne: false } } } },
            ],
          })
          .select('userId slug subdomains')
          .lean()
      : null;
    if (requestedSiteSlug && !owner) throw new NotFoundException('Collection not found');
    const collection = await this.collectionModel
      .findOne({ $or: query, ...(owner ? { userId: owner.userId } : {}) })
      .sort({ createdAt: -1 })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    if (owner) {
      const siteId = String(owner.slug) === requestedSiteSlug
        ? 'main'
        : String((owner.subdomains ?? []).find((site: any) => String(site.slug) === requestedSiteSlug)?.id ?? '');
      if (!siteId || !this.collectionAssignedToHomepageSite(collection, siteId)) {
        throw new NotFoundException('Collection not found');
      }
    }
    return collection;
  }

  private collectionAssignedToHomepageSite(collection: any, siteId: string) {
    const ids = Array.isArray(collection?.homepageSiteIds)
      ? collection.homepageSiteIds.map((value: unknown) => String(value)).filter(Boolean)
      : [];
    return siteId === 'main' ? ids.length === 0 || ids.includes('main') : ids.includes(siteId);
  }

  private async validateHomepageSiteIds(userId: string, values: string[]) {
    const requested = [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
    if (!requested.length) return ['main'];
    const homepage = await this.homepageModel
      .findOne({ userId })
      .select('subdomains')
      .lean();
    const valid = new Set([
      'main',
      ...((homepage?.subdomains ?? []).map((site: any) => String(site.id))),
    ]);
    const invalid = requested.find((siteId) => !valid.has(siteId));
    if (invalid) throw new BadRequestException('One of the selected subdomains no longer exists');
    return requested;
  }

  private isPublicCollectionVisible(collection: {
    status?: string;
    expiresAt?: Date | string | null;
  }) {
    if (collection.status !== 'published') return false;
    if (!collection.expiresAt) return true;
    const expiresAt = new Date(collection.expiresAt);
    return Number.isNaN(expiresAt.getTime()) || expiresAt > new Date();
  }

  private expiryDate(value?: string) {
    if (!value) return undefined;
    const source = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T23:59:59.999Z`
      : value;
    const date = new Date(source);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private escapeSvg(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private watermarkFontFamily(font?: string) {
    const mapped = this.serverWatermarkFont(font);
    return [
      mapped,
      'Noto Sans Bengali',
      'Noto Sans',
      'DejaVu Sans',
      'Liberation Sans',
      'sans-serif',
    ]
      .map((family) =>
        family.includes(' ')
          ? `"${this.escapeCssString(family)}"`
          : this.escapeCssString(family),
      )
      .join(', ');
  }

  private serverWatermarkFont(font?: string) {
    const value = String(font || '')
      .trim()
      .toLowerCase();
    if (
      value.includes('times') ||
      value.includes('georgia') ||
      value.includes('playfair')
    )
      return 'Noto Serif';
    if (value.includes('courier')) return 'DejaVu Sans Mono';
    return 'Noto Sans';
  }

  private escapeCssString(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private watermarkTextSize(imageWidth: number, scale?: number) {
    return Math.max(18, Math.round(imageWidth * ((scale ?? 42) / 100) * 0.2));
  }

  private watermarkImageWidth(imageWidth: number, scale?: number) {
    return Math.max(40, Math.round(imageWidth * ((scale ?? 42) / 100) * 0.28));
  }

  private clampPercent(value: number, min = 5, max = 95) {
    if (min > max) return 50;
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 50));
  }

  private compactMetadata(value: unknown) {
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([, item]) => item !== undefined && item !== null && item !== '',
        )
        .map(([key, item]) => [
          key,
          item instanceof Date ? item.toISOString() : item,
        ]),
    );
  }

  private async ensureStorageAvailable(userId: string, incomingBytes: number) {
    const user = await this.userModel
      .findById(userId)
      .select(
        'planName storageLimitGb storageUsedBytes planExpiresAt name username businessName',
      )
      .lean();
    if (user?.planExpiresAt && user.planExpiresAt <= new Date()) {
      throw new BadRequestException(
        'Plan expired. Purchase a plan to continue uploading images.',
      );
    }
    const limitGb = Math.max(0, Number(user?.storageLimitGb ?? 0));
    const limitBytes = limitGb * 1024 * 1024 * 1024;
    const used = Number(user?.storageUsedBytes ?? 0);
    if (used + incomingBytes > limitBytes) {
      throw new BadRequestException(
        'Storage limit exceeded. Upgrade plan to upload more images.',
      );
    }
    return user;
  }

  private async ensureVideoPlanAvailable(
    userId: string,
    files: Array<{
      type?: string;
      durationSeconds?: number;
      width?: number;
      height?: number;
    }>,
  ) {
    const incomingVideos = files.filter(
      (file) => this.mediaType(file.type) === 'video',
    );
    if (!incomingVideos.length) return;
    const user = await this.userModel
      .findById(userId)
      .select('videoUploadLimitMinutes videoUploadQuality planExpiresAt')
      .lean();
    if (user?.planExpiresAt && user.planExpiresAt <= new Date()) {
      throw new BadRequestException(
        'Plan expired. Purchase a plan to continue uploading videos.',
      );
    }
    const limitSeconds =
      Math.max(0, Number(user?.videoUploadLimitMinutes ?? 0)) * 60;
    const incomingSeconds = incomingVideos.reduce(
      (sum, file) => sum + this.safeSeconds(file.durationSeconds),
      0,
    );
    if (incomingSeconds <= 0)
      throw new BadRequestException('Video duration metadata is required.');
    const current = await Promise.all([
      this.imageModel.aggregate([
        { $match: { userId, mediaType: 'video' } },
        { $group: { _id: null, total: { $sum: '$durationSeconds' } } },
      ]),
      this.mobileGalleryImageModel.aggregate([
        { $match: { userId, mediaType: 'video' } },
        { $group: { _id: null, total: { $sum: '$durationSeconds' } } },
      ]),
    ]);
    const usedSeconds =
      Number(current[0][0]?.total ?? 0) + Number(current[1][0]?.total ?? 0);
    if (limitSeconds <= 0 || usedSeconds + incomingSeconds > limitSeconds) {
      throw new BadRequestException(
        'Video minute limit exceeded. Upgrade plan to upload more video.',
      );
    }
    const allowedQuality = user?.videoUploadQuality === '4k' ? '4k' : 'hd';
    for (const file of incomingVideos) {
      const quality = this.videoQuality(file.width, file.height);
      if (quality === 'unknown')
        throw new BadRequestException('Video resolution metadata is required.');
      if (quality === 'over-4k')
        throw new BadRequestException(
          'Videos larger than 4K are not supported.',
        );
      if (allowedQuality === 'hd' && quality !== 'hd') {
        throw new BadRequestException(
          'Your plan only allows HD video uploads.',
        );
      }
    }
  }

  private mediaType(type?: string) {
    return String(type || '')
      .toLowerCase()
      .startsWith('video/')
      ? 'video'
      : 'image';
  }

  private safeSeconds(value: unknown) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
  }

  private safeDimension(value: unknown) {
    const dimension = Number(value);
    return Number.isFinite(dimension) && dimension > 0
      ? Math.round(dimension)
      : 0;
  }

  private videoQuality(
    width?: number,
    height?: number,
  ): 'hd' | '4k' | 'over-4k' | 'unknown' {
    const w = this.safeDimension(width);
    const h = this.safeDimension(height);
    if (!w || !h) return 'unknown';
    const long = Math.max(w, h);
    const short = Math.min(w, h);
    if (long <= 1920 && short <= 1080) return 'hd';
    if (long <= 3840 && short <= 2160) return '4k';
    return 'over-4k';
  }

  private async decrementStorageUsedBytes(userId: string, bytes: number) {
    const safeBytes = Math.max(0, Number(bytes ?? 0));
    if (safeBytes > 0) {
      const user = await this.userModel
        .findById(userId)
        .select('storageUsedBytes')
        .lean();
      const nextUsedBytes = Math.max(
        0,
        Number(user?.storageUsedBytes ?? 0) - safeBytes,
      );
      await this.userModel.updateOne(
        { _id: userId },
        { $set: { storageUsedBytes: nextUsedBytes } },
      );
    }
    await this.clearStorageIfNoImages(userId);
  }

  private async clearStorageIfNoImages(userId: string) {
    const [collectionImages, mobileImages] = await Promise.all([
      this.imageModel.exists({ userId }),
      this.mobileGalleryImageModel.exists({ userId }),
    ]);
    if (!collectionImages && !mobileImages) {
      await this.userModel.updateOne(
        { _id: userId },
        { $set: { storageUsedBytes: 0 } },
      );
    }
  }

  private cleanEmail(value?: string) {
    const email = String(value ?? '')
      .trim()
      .toLowerCase();
    return /^\S+@\S+\.\S+$/.test(email) ? email : '';
  }

  private cleanEmailList(values?: unknown[]) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map((value) => this.cleanEmail(String(value ?? '')))
      .filter(Boolean))];
  }

  private async collectionPublicLink(collection: any, siteSlug?: string) {
    const homepage = siteSlug
      ? null
      : await this.homepageModel
          .findOne({ userId: String(collection.userId) })
          .select('slug subdomains')
          .lean();
    let resolvedSiteSlug = String(siteSlug || '').trim();
    if (!resolvedSiteSlug && homepage) {
      const assigned = Array.isArray(collection?.homepageSiteIds)
        ? collection.homepageSiteIds.map((value: unknown) => String(value)).filter(Boolean)
        : [];
      if (!assigned.length || assigned.includes('main')) {
        resolvedSiteSlug = String(homepage.slug || '');
      } else {
        const site = (homepage.subdomains ?? []).find((item: any) => assigned.includes(String(item.id)) && item.enabled !== false);
        resolvedSiteSlug = String(site?.slug || homepage.slug || '');
      }
    }
    if (!resolvedSiteSlug) return '';
    const collectionSlug = String(collection.slug || collection._id || '').trim();
    if (!collectionSlug) return '';
    const configuredRoot = String(
      this.configService.get<string>('ROOT_DOMAIN') ||
      this.configService.get<string>('NEXT_PUBLIC_ROOT_DOMAIN') ||
      '',
    ).trim();
    const frontendOrigin = String(
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('PUBLIC_APP_URL') ||
      'https://gallerista.app',
    ).replace(/\/$/, '');
    const root = configuredRoot.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if (root && !/^localhost(?::\d+)?$/i.test(root)) {
      const protocol = configuredRoot.startsWith('http://') ? 'http' : 'https';
      return `${protocol}://${resolvedSiteSlug}.${root}/${encodeURIComponent(collectionSlug)}`;
    }
    return `${frontendOrigin}/collection/${encodeURIComponent(resolvedSiteSlug)}/${encodeURIComponent(collectionSlug)}`;
  }

  private async queueCollectionLifecycle(
    collection: any,
    trigger: 'gallery-published' | 'gallery-updated' | 'client-download' | 'client-favorite',
    emails: string[],
    siteSlug?: string,
    eventId?: string,
  ) {
    const recipientEmails = this.cleanEmailList(emails);
    if (!recipientEmails.length) return;
    const buttonLink = await this.collectionPublicLink(collection, siteSlug);
    await this.marketingScheduleService.queueLifecycleEvent({
      userId: String(collection.userId),
      trigger,
      recipientEmails,
      collectionId: String(collection._id),
      collectionName: String(collection.name || 'Gallery'),
      buttonLink,
      eventId,
    }).catch(() => undefined);
  }

  private async queuePublishedCollection(collection: any) {
    await this.queueCollectionLifecycle(
      collection,
      'gallery-published',
      Array.isArray(collection.clientEmails) ? collection.clientEmails : [],
    );
  }

  private galleryUpdateEventId(collectionId: string) {
    // Collapse multiple saves/uploads/deletes from the same editing session into
    // one lifecycle email per hour instead of spamming a client for each photo.
    return `gallery-update:${collectionId}:${Math.floor(Date.now() / 3_600_000)}`;
  }

  private async queueUpdatedCollection(collection: any, eventId: string) {
    await this.queueCollectionLifecycle(
      collection,
      'gallery-updated',
      Array.isArray(collection.clientEmails) ? collection.clientEmails : [],
      undefined,
      eventId,
    );
  }

  private registrationSource(value?: string) {
    const source = String(value ?? 'email-registration')
      .trim()
      .toLowerCase();
    return [
      'email-registration',
      'popup',
      'download',
      'favorite',
      'store-checkout',
    ].includes(source)
      ? source
      : 'email-registration';
  }

  private async saveEmailRegistration(
    collection: any,
    email: string,
    marketingOptIn: boolean,
    source: string,
  ) {
    const collectionId = collection._id.toString();
    const existing = await this.emailRegistrationModel
      .findOne({ collectionId, email })
      .select('marketingOptIn marketingOptedInAt')
      .lean();
    const nextMarketingOptIn = Boolean(existing?.marketingOptIn || marketingOptIn);
    const firstOptIn = nextMarketingOptIn && !existing?.marketingOptIn;
    await this.emailRegistrationModel.updateOne(
      { collectionId, email },
      {
        $set: {
          ownerId: String(collection.userId),
          collectionName: collection.name,
          email,
          lastSource: source,
          marketingOptIn: nextMarketingOptIn,
          ...(firstOptIn ? { marketingOptedInAt: new Date() } : {}),
        },
        $setOnInsert: { collectionId },
        $addToSet: { sources: source },
      },
      { upsert: true },
    );
  }

  private resolveEmailAccess(settings: any, email?: string) {
    const general = settings?.general ?? {};
    const access = settings?.access ?? {};
    const required = this.boolSetting(general.emailRegistration);
    if (!required)
      return { required: false, authorized: true, status: 'open', email: '' };
    const clean = this.cleanEmail(email);
    if (!clean)
      return { required: true, authorized: false, status: 'required', email: '' };
    const allowedEmails = Array.isArray(access.allowedEmails)
      ? access.allowedEmails.map((value: unknown) => this.cleanEmail(String(value ?? ''))).filter(Boolean)
      : [];
    const approvedRequests = Array.isArray(access.requests)
      ? access.requests.some((request: any) =>
          request?.status === 'approved' && this.cleanEmail(request?.email) === clean,
        )
      : false;
    const authorized = allowedEmails.includes(clean) || approvedRequests;
    return {
      required: true,
      authorized,
      status: authorized ? 'allowed' : 'not-allowed',
      email: clean,
    };
  }

  private boolSetting(value: unknown) {
    if (typeof value === 'boolean') return value;
    const text = String(value ?? '').toLowerCase();
    return ['true', 'on', 'yes', '1', 'enabled'].includes(text);
  }

  private async sanitizeCollectionCapabilities<
    T extends CreateCollectionDto | UpdateCollectionDto,
  >(userId: string, dto: T, collectionId?: string): Promise<T> {
    const user = await this.userModel
      .findById(userId)
      .select('planFeatures')
      .lean();
    const features = user?.planFeatures ?? {};
    const next: any = { ...dto };
    if (next.design && !features.beautifulGalleries) {
      next.design = {};
    }
    const settings = { ...((next.settings ?? {}) as any) };
    const download = { ...(settings.download ?? {}) };
    const store = { ...(settings.store ?? {}) };

    if (!features.downloads) {
      download.enabled = false;
      download.allowDownload = false;
      download.allowDownloads = false;
      download.photoDownload = false;
      download.galleryDownload = false;
      download.singlePhotoDownload = false;
      download.videoDownload = false;
      download.limitDownloads = false;
      download.restrictDownloads = false;
      download.limitPinUsage = '';
      download.downloadPin = false;
      download.downloadPinCode = '';
    } else if (
      (download.limitDownloads || download.restrictDownloads) &&
      !features.downloadLimit
    ) {
      download.limitDownloads = false;
      download.restrictDownloads = false;
      download.limitPinUsage = '';
    }
    if (download.downloadPin && !features.pinSet) {
      download.downloadPin = false;
      download.downloadPinCode = '';
    }
    if (!features.store) {
      store.enabled = false;
      store.storeStatus = false;
      store.showPrintStoreNav = false;
      store.showBuyPhotoButton = false;
    } else if ((store.enabled || store.storeStatus) && !features.multipleGalleryStores) {
      const storeQuery: any = {
        userId,
        $or: [
          { 'settings.store.enabled': true },
          { 'settings.store.storeStatus': true },
        ],
      };
      if (collectionId) storeQuery._id = { $ne: collectionId };
      const existingStore = await this.collectionModel.exists(storeQuery);
      if (existingStore) {
        throw new BadRequestException('Your current plan allows Store on one gallery only. Upgrade for Multiple Gallery Stores.');
      }
    }

    if (next.settings) next.settings = { ...settings, download, store };
    return next as T;
  }
}

function minDate(values: Date[]) {
  if (!values.length) return undefined;
  return new Date(
    Math.min(...values.map((value) => new Date(value).getTime())),
  );
}

function maxDate(values: Date[]) {
  if (!values.length) return undefined;
  return new Date(
    Math.max(...values.map((value) => new Date(value).getTime())),
  );
}

function escapeEmailHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

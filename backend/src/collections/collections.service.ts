import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { Model, Types } from 'mongoose';
import { join } from 'path';
import { cwd } from 'process';
import sharp, { type Metadata, type Sharp } from 'sharp';
import * as exifr from 'exifr';
import { MinioService } from 'src/lib/minio.service';
import { FaceSearchService } from 'src/face-search/face-search.service';
import { MobileGalleryImage, MobileGalleryImageDocument } from 'src/mobile-gallery/entities/mobile-gallery-image.entity';
import { DashboardSetting, DashboardSettingDocument, DashboardSettingType } from 'src/settings/entities/dashboard-setting.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { Homepage, HomepageDocument } from 'src/homepage/entities/homepage.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { Collection, CollectionDocument } from './entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from './entities/collection-image.entity';
import { CollectionFavorite, CollectionFavoriteDocument } from './entities/collection-favorite.entity';
import { CollectionImageFavorite, CollectionImageFavoriteDocument } from './entities/collection-image-favorite.entity';
import { CollectionDownloadActivity, CollectionDownloadActivityDocument } from './entities/collection-download-activity.entity';

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

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(CollectionFavorite.name) private readonly favoriteModel: Model<CollectionFavoriteDocument>,
    @InjectModel(CollectionImageFavorite.name) private readonly imageFavoriteModel: Model<CollectionImageFavoriteDocument>,
    @InjectModel(CollectionDownloadActivity.name) private readonly downloadActivityModel: Model<CollectionDownloadActivityDocument>,
    @InjectModel(DashboardSetting.name) private readonly settingModel: Model<DashboardSettingDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(MobileGalleryImage.name) private readonly mobileGalleryImageModel: Model<MobileGalleryImageDocument>,
    @InjectModel(Homepage.name) private readonly homepageModel: Model<HomepageDocument>,
    private readonly minioService: MinioService,
    private readonly faceSearchService: FaceSearchService,
    private readonly configService: ConfigService,
  ) {}

  async create(userId: string, dto: CreateCollectionDto) {
    const safeDto = await this.sanitizeCollectionCapabilities(userId, dto);
    const collection = await this.collectionModel.create({
      userId,
      name: safeDto.name,
      slug: await this.uniqueSlug(userId, safeDto.name),
      eventDate: safeDto.eventDate ? new Date(safeDto.eventDate) : undefined,
      presetId: safeDto.presetId,
      status: safeDto.status ?? 'draft',
      design: safeDto.design ?? {},
      settings: safeDto.settings ?? {},
      sets: [{ id: 'highlights', name: 'Highlights', createdAt: new Date() }],
      imageCount: 0,
    });

    return collection.toObject();
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
      { $group: { _id: '$collectionId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(imageCounts.map((item) => [item._id, item.count]));

    return collections.map((collection) => ({
      ...collection,
      imageCount: countMap.get(collection._id.toString()) ?? collection.imageCount ?? 0,
    }));
  }

  async findOne(userId: string, id: string, limit?: string, offset?: string) {
    const collection = await this.collectionModel.findOne({ _id: id, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const imagesPage = await this.findImages(userId, id, limit, offset);
    void this.ensureCollectionPreviews(id);

    return { ...collection, images: imagesPage.items, imagesPage };
  }

  async findPublic(identifier: string, email?: string, limit?: string, offset?: string, siteSlug?: string) {
    const collection = await this.findCollectionByIdentifier(identifier, siteSlug);
    if (collection.status !== 'published') throw new NotFoundException('Collection not found');
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
    const accessSourceSettings = {
      ...((collection.settings as any) ?? {}),
      general: {
        ...(presetData?.general ?? presetData?.presetGeneral ?? {}),
        ...((collection.settings as any)?.general ?? {}),
      },
    };
    const emailAccess = this.resolveEmailAccess(accessSourceSettings, email);
    const imagesPage = emailAccess.authorized
      ? await this.findPublicImages(identifier, email, limit, offset, siteSlug)
      : { items: [], total: 0, limit: this.pageLimit(limit), offset: this.pageOffset(offset), hasMore: false };
    if (emailAccess.authorized) void this.ensureCollectionPreviews(collection._id.toString());
    const branding = await this.settingModel
      .findOne({
        userId: collection.userId,
        type: DashboardSettingType.BRANDING,
        localId: 'branding',
      })
      .lean();

    const mergedSettings = {
      general: {
        ...(presetData?.general ?? presetData?.presetGeneral ?? {}),
        ...((collection.settings as any)?.general ?? {}),
      },
      download: {
        ...(presetData?.download ?? presetData?.presetDownload ?? {}),
        ...((collection.settings as any)?.download ?? {}),
      },
      favorite: {
        ...(presetData?.favorite ?? presetData?.presetFavorite ?? {}),
        ...((collection.settings as any)?.favorite ?? {}),
      },
      store: {
        ...(presetData?.store ?? presetData?.presetStore ?? {}),
        ...((collection.settings as any)?.store ?? {}),
      },
      access: {
        emailRequired: emailAccess.required,
        emailAuthorized: emailAccess.authorized,
        emailStatus: emailAccess.status,
        email: emailAccess.email,
      },
    };

    return {
      ...collection,
      design: {
        ...(presetData?.design ?? presetData?.presetDesign ?? {}),
        ...(collection.design ?? {}),
      },
      settings: mergedSettings,
      branding: (branding?.data as any) ?? {},
      images: imagesPage.items,
      imagesPage,
    };
  }

  async findImages(userId: string, id: string, limit?: string, offset?: string) {
    const collection = await this.collectionModel.findOne({ _id: id, userId }).select('_id').lean();
    if (!collection) throw new NotFoundException('Collection not found');
    return this.findImagesPage({ collectionId: id, userId }, limit, offset);
  }

  async findPublicImages(identifier: string, email?: string, limit?: string, offset?: string, siteSlug?: string) {
    const collection = await this.findCollectionByIdentifier(identifier, siteSlug);
    if (collection.status !== 'published') throw new NotFoundException('Collection not found');
    const preset = collection.presetId
      ? await this.settingModel.findOne({ userId: collection.userId, type: DashboardSettingType.PRESET, localId: collection.presetId }).lean()
      : null;
    const presetData = preset?.data as any;
    const accessSourceSettings = {
      ...((collection.settings as any) ?? {}),
      general: {
        ...(presetData?.general ?? presetData?.presetGeneral ?? {}),
        ...((collection.settings as any)?.general ?? {}),
      },
    };
    const emailAccess = this.resolveEmailAccess(accessSourceSettings, email);
    if (!emailAccess.authorized) {
      return { items: [], total: 0, limit: this.pageLimit(limit), offset: this.pageOffset(offset), hasMore: false };
    }
    void this.ensureCollectionPreviews(collection._id.toString());
    return this.findImagesPage({ collectionId: collection._id.toString() }, limit, offset);
  }

  async requestPublicAccess(identifier: string, body: { email?: string; reason?: string }, siteSlug?: string) {
    const collection = await this.findCollectionByIdentifier(identifier, siteSlug);
    if (collection.status !== 'published') throw new NotFoundException('Collection not found');
    const email = this.cleanEmail(body.email);
    if (!email) throw new BadRequestException('Email is required');
    const reason = String(body.reason ?? '').trim().slice(0, 1000);
    const settings = (collection.settings as any) ?? {};
    const access = settings.access ?? {};
    const requests = Array.isArray(access.requests) ? access.requests : [];
    const existingIndex = requests.findIndex((request: any) => this.cleanEmail(request.email) === email);
    const nextRequest = {
      id: existingIndex >= 0 ? requests[existingIndex].id : `req-${Date.now()}`,
      email,
      reason,
      status: 'pending',
      createdAt: existingIndex >= 0 ? requests[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nextRequests = existingIndex >= 0
      ? requests.map((request: any, index: number) => index === existingIndex ? nextRequest : request)
      : [nextRequest, ...requests];
    await this.collectionModel.updateOne(
      { _id: collection._id },
      { $set: { settings: { ...settings, access: { ...access, requests: nextRequests } } } },
    );
    return { requested: true, email };
  }

  async listFavoriteCollections(userId: string) {
    const favorites = await this.favoriteModel.find({ userId }).sort({ createdAt: -1 }).lean();
    const collectionIds = favorites.map((favorite) => favorite.collectionId);
    const collections = collectionIds.length
      ? await this.collectionModel.find({ _id: { $in: collectionIds } }).lean()
      : [];
    const collectionMap = new Map(collections.map((collection) => [collection._id.toString(), collection]));

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
    const favorites = await this.imageFavoriteModel.find({ userId }).sort({ createdAt: -1 }).lean();
    const imageIds = favorites.map((favorite) => favorite.imageId);
    const images = imageIds.length
      ? await this.imageModel.find({ _id: { $in: imageIds } }).lean()
      : [];
    const imageMap = new Map(images.map((image) => [image._id.toString(), image]));
    const collectionIds = [...new Set(images.map((image) => image.collectionId))];
    const collections = collectionIds.length
      ? await this.collectionModel.find({ _id: { $in: collectionIds } }).select('_id name slug').lean()
      : [];
    const collectionMap = new Map(collections.map((collection) => [collection._id.toString(), collection]));

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
    const existing = await this.favoriteModel.findOne({ userId, collectionId }).lean();
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
    if (!Types.ObjectId.isValid(imageId)) throw new BadRequestException('Photo is required');
    const image = await this.imageModel.findOne({ _id: imageId }).lean();
    if (!image) throw new NotFoundException('Image not found');
    const existing = await this.imageFavoriteModel.findOne({ userId, imageId }).lean();
    if (existing) {
      await this.imageFavoriteModel.deleteOne({ _id: existing._id });
      return { favorited: false, imageId, collectionId: image.collectionId };
    }

    const collection = await this.collectionModel.findById(image.collectionId).select('settings').lean();
    const maxFavorites = Number((collection?.settings as any)?.favorite?.maxFavorites || 0);
    if (maxFavorites > 0) {
      const currentCount = await this.imageFavoriteModel.countDocuments({
        userId,
        collectionId: image.collectionId,
      });
      if (currentCount >= maxFavorites) {
        throw new BadRequestException(`Favorite limit reached (${maxFavorites})`);
      }
    }

    await this.imageFavoriteModel.updateOne(
      { userId, imageId },
      { $setOnInsert: { userId, imageId, collectionId: image.collectionId } },
      { upsert: true },
    );
    return { favorited: true, imageId, collectionId: image.collectionId };
  }

  async getCollectionActivity(userId: string, collectionId: string) {
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const [collectionFavorites, imageFavorites, downloads, images] = await Promise.all([
      this.favoriteModel.find({ collectionId }).sort({ createdAt: -1 }).lean(),
      this.imageFavoriteModel.find({ collectionId }).sort({ createdAt: -1 }).lean(),
      this.downloadActivityModel.find({ collectionId }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
      this.imageModel.find({ collectionId }).select('_id originalName url thumbnailUrl').lean(),
    ]);
    const userIds = [...new Set([
      ...collectionFavorites.map((favorite) => favorite.userId),
      ...imageFavorites.map((favorite) => favorite.userId),
    ])];
    const users = userIds.length
      ? await this.userModel.find({ _id: { $in: userIds } }).select('_id email name').lean()
      : [];
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const imageMap = new Map(images.map((image) => [image._id.toString(), image]));
    const imageFavoritesByUser = new Map<string, any[]>();

    for (const favorite of imageFavorites) {
      imageFavoritesByUser.set(favorite.userId, [
        ...(imageFavoritesByUser.get(favorite.userId) ?? []),
        favorite,
      ]);
    }

    const favoriteUserIds = [...new Set([
      ...collectionFavorites.map((favorite) => favorite.userId),
      ...imageFavorites.map((favorite) => favorite.userId),
    ])];
    const favoriteLists = favoriteUserIds.map((favoriteUserId) => {
      const user = userMap.get(favoriteUserId);
      const listImages = imageFavoritesByUser.get(favoriteUserId) ?? [];
      const collectionFavorite = collectionFavorites.find((favorite) => favorite.userId === favoriteUserId);
      const createdDates = [collectionFavorite?.createdAt, ...listImages.map((favorite) => favorite.createdAt)].filter(Boolean) as Date[];
      const updatedDates = [collectionFavorite?.updatedAt, ...listImages.map((favorite: any) => favorite.updatedAt)].filter(Boolean) as Date[];

      return {
        id: favoriteUserId,
        email: user?.email || user?.name || favoriteUserId,
        name: 'My Favorites',
        photos: listImages.length,
        filenames: listImages.map((favorite) => imageMap.get(favorite.imageId)?.originalName || favorite.imageId),
        images: listImages.map((favorite) => {
          const image = imageMap.get(favorite.imageId);
          return {
            imageId: favorite.imageId,
            name: image?.originalName || favorite.imageId,
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
    };
  }

  async recordPublicDownloadActivity(
    identifier: string,
    body: { email?: string; items?: Array<{ imageId?: string; imageName?: string; imageUrl?: string }>; downloadType?: 'single' | 'all' },
    siteSlug?: string,
  ) {
    const collection = await this.findCollectionByIdentifier(identifier, siteSlug);
    if (collection.status !== 'published') throw new NotFoundException('Collection not found');
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new BadRequestException('Email is required');
    const items = Array.isArray(body?.items) ? body.items.slice(0, 250) : [];
    if (!items.length) throw new BadRequestException('Download item is required');
    const downloadType = body.downloadType === 'all' ? 'all' : 'single';
    const collectionId = collection._id.toString();

    for (const item of items) {
      const imageId = item.imageId && Types.ObjectId.isValid(item.imageId) ? item.imageId : '';
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

  async deleteFavoriteInfo(userId: string, collectionId: string, favoriteUserId: string) {
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');
    const [collectionResult, imageResult] = await Promise.all([
      this.favoriteModel.deleteMany({ collectionId, userId: favoriteUserId }),
      this.imageFavoriteModel.deleteMany({ collectionId, userId: favoriteUserId }),
    ]);
    return {
      deleted: (collectionResult.deletedCount ?? 0) + (imageResult.deletedCount ?? 0),
    };
  }

  async deleteFavoriteImageInfo(userId: string, collectionId: string, favoriteUserId: string, imageId: string) {
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');
    if (!Types.ObjectId.isValid(imageId)) throw new BadRequestException('Photo is required');
    const result = await this.imageFavoriteModel.deleteOne({
      collectionId,
      userId: favoriteUserId,
      imageId,
    });
    return { deleted: result.deletedCount ?? 0 };
  }

  async copyFavoriteListToSet(userId: string, collectionId: string, favoriteUserId: string, name?: string) {
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId });
    if (!collection) throw new NotFoundException('Collection not found');
    const images = await this.favoriteImagesForUser(collectionId, favoriteUserId);
    if (!images.length) throw new BadRequestException('No favorite photos to copy');

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
    const copiedBytes = copies.reduce((sum, c) => sum + Math.max(0, Number(c.sizeBytes ?? 0)), 0);
    if (copiedBytes > 0) {
      await this.userModel.updateOne({ _id: userId }, { $inc: { storageUsedBytes: copiedBytes } });
    }
    return { set, copied: copies.length };
  }

  async copyFavoriteListToCollection(userId: string, collectionId: string, favoriteUserId: string, name?: string) {
    const source = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!source) throw new NotFoundException('Collection not found');
    const images = await this.favoriteImagesForUser(collectionId, favoriteUserId);
    if (!images.length) throw new BadRequestException('No favorite photos to copy');

    const set = { id: 'highlights', name: 'Highlights', createdAt: new Date() };
    const collection = await this.collectionModel.create({
      userId,
      name: name?.trim() || `${source.name} Favorites`,
      slug: await this.uniqueSlug(userId, name?.trim() || `${source.name} Favorites`),
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
    const copiedBytes = imageRecords.reduce((sum, r) => sum + Math.max(0, Number(r.sizeBytes ?? 0)), 0);
    if (copiedBytes > 0) {
      await this.userModel.updateOne({ _id: userId }, { $inc: { storageUsedBytes: copiedBytes } });
    }
    return { collection: collection.toObject(), copied: images.length };
  }

  private async favoriteImagesForUser(collectionId: string, favoriteUserId: string) {
    const favorites = await this.imageFavoriteModel.find({ collectionId, userId: favoriteUserId }).lean();
    const imageIds = favorites.map((favorite) => favorite.imageId).filter((id) => Types.ObjectId.isValid(id));
    if (!imageIds.length) return [];
    return this.imageModel.find({ collectionId, _id: { $in: imageIds } }).lean();
  }

  async findAllImages(userId: string) {
    const images = await this.imageModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    const collectionIds = [...new Set(images.map((image) => image.collectionId))];
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
        setName: set?.name ?? 'Highlights',
      };
    });
  }

  async update(userId: string, id: string, dto: UpdateCollectionDto) {
    const collection = await this.collectionModel.findOne({ _id: id, userId });
    if (!collection) throw new NotFoundException('Collection not found');
    dto = await this.sanitizeCollectionCapabilities(userId, dto);

    if (dto.name !== undefined) {
      collection.name = dto.name;
      collection.slug = await this.uniqueSlug(userId, dto.name, id);
    }
    if (dto.eventDate !== undefined) collection.eventDate = new Date(dto.eventDate);
    if (dto.presetId !== undefined) collection.presetId = dto.presetId || undefined;
    if (dto.coverImage !== undefined) collection.coverImage = dto.coverImage || undefined;
    if (dto.sets !== undefined) {
      const nextSets = dto.sets.map((set) => ({
        id: set.id,
        name: set.name,
        watermarkId: set.watermarkId || undefined,
        createdAt: set.createdAt ? new Date(set.createdAt) : new Date(),
      }));
      const nextSetIds = nextSets.map((set) => set.id);
      const fallbackSetId = nextSetIds[0] ?? 'highlights';
      await this.imageModel.updateMany(
        { userId, collectionId: id, setId: { $nin: nextSetIds } },
        { $set: { setId: fallbackSetId } },
      );
      collection.sets = nextSets.length ? nextSets : [{ id: 'highlights', name: 'Highlights', createdAt: new Date() }];
    }
    if (dto.tags !== undefined) collection.tags = dto.tags;
    if (dto.watermarkId !== undefined) collection.watermarkId = dto.watermarkId || undefined;
    if (dto.expiresAt !== undefined) collection.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    if (dto.status !== undefined) collection.status = dto.status;
    if (dto.design !== undefined) collection.design = dto.design;
    if (dto.settings !== undefined) collection.settings = dto.settings;

    await collection.save();
    return collection.toObject();
  }

  async duplicate(userId: string, id: string) {
    const source = await this.collectionModel.findOne({ _id: id, userId }).lean();
    if (!source) throw new NotFoundException('Collection not found');

    const images = await this.imageModel
      .find({ collectionId: id, userId })
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
      sets: source.sets ?? [{ id: 'highlights', name: 'Highlights', createdAt: new Date() }],
      tags: source.tags ?? [],
      watermarkId: source.watermarkId,
      expiresAt: source.expiresAt,
      design: source.design ?? {},
      settings: source.settings ?? {},
      imageCount: images.length,
      status: 'draft',
    });

    if (images.length) {
      await this.imageModel.insertMany(images.map((image) => ({
        userId,
        collectionId: collection._id.toString(),
        setId: image.setId,
        url: image.url,
        thumbnailUrl: image.thumbnailUrl,
        blurDataUrl: image.blurDataUrl,
        originalName: image.originalName,
        filename: image.filename,
        mimetype: image.mimetype,
        sizeBytes: image.sizeBytes,
        watermarked: image.watermarked,
        metadata: image.metadata ?? {},
        order: image.order,
      })));
      const duplicatedBytes = images.reduce((sum, img) => sum + Math.max(0, Number(img.sizeBytes ?? 0)), 0);
      if (duplicatedBytes > 0) {
        await this.userModel.updateOne({ _id: userId }, { $inc: { storageUsedBytes: duplicatedBytes } });
      }
    }

    return { collection: collection.toObject(), copied: images.length };
  }

  async remove(userId: string, id: string) {
    const collection = await this.collectionModel.findOne({ _id: id, userId });
    if (!collection) throw new NotFoundException('Collection not found');

    const images = await this.imageModel.find({ collectionId: id, userId });
    let reclaimedBytes = 0;
    for (const image of images) reclaimedBytes += Math.max(0, Number(image.sizeBytes ?? 0));

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

    const collection = await this.collectionModel.findOne({ _id: collectionId, userId });
    if (!collection) throw new NotFoundException('Collection not found');

    const set = {
      id: `set-${Date.now()}`,
      name: trimmed,
      createdAt: new Date(),
    };
    collection.sets = [...(collection.sets ?? []), set];
    await collection.save();
    return set;
  }

  async reorderImages(userId: string, collectionId: string, imageIds: string[]) {
    if (!Array.isArray(imageIds) || !imageIds.length) {
      throw new BadRequestException('Image order is required');
    }
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const images = await this.imageModel
      .find({ collectionId, userId, _id: { $in: imageIds } })
      .select('_id')
      .lean();
    const validIds = new Set(images.map((image) => image._id.toString()));
    const orderedIds = imageIds.filter((id) => validIds.has(id));
    if (!orderedIds.length) throw new BadRequestException('No valid images to reorder');

    await this.imageModel.bulkWrite(
      orderedIds.map((imageId, index) => ({
        updateOne: {
          filter: { _id: imageId, collectionId, userId },
          update: { $set: { order: index + 1 } },
        },
      })),
    );

    return { updated: orderedIds.length };
  }

  async uploadImages(userId: string, collectionId: string, files: Express.Multer.File[], setId?: string, uploadWatermarkId?: string) {
    if (!files?.length) throw new BadRequestException('Files are required');
    await this.ensureStorageAvailable(userId, files.reduce((sum, file) => sum + (file.size ?? 0), 0));

    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');
    const resolvedSetId = setId || collection.sets?.[0]?.id || 'highlights';

    const activeSet = collection.sets?.find((set) => set.id === resolvedSetId);
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
      (file, index) => this.processAndSaveImage(userId, collectionId, file, watermark, resolvedSetId, nextOrder + index + 1),
    );

    await this.collectionModel.updateOne(
      { _id: collectionId, userId },
      {
        $inc: { imageCount: uploaded.length },
        $set: { coverImage: collection.coverImage ?? uploaded[0]?.url },
      },
    );
    setTimeout(() => {
      void this.indexFacesInBackground(uploaded);
    }, 1500);

    return uploaded;
  }

  async createDirectUploads(userId: string, collectionId: string, files: Array<{ name: string; type: string; size: number }>) {
    if (!Array.isArray(files) || !files.length || files.length > 100) throw new BadRequestException('1 to 100 files are required');
    const collection = await this.collectionModel.exists({ _id: collectionId, userId });
    if (!collection) throw new NotFoundException('Collection not found');
    await this.ensureStorageAvailable(userId, files.reduce((sum, file) => sum + Math.max(0, Number(file.size)), 0));
    return Promise.all(files.map((file) => this.minioService.createDirectUpload(userId, file)));
  }

  async completeDirectUploads(
    userId: string,
    collectionId: string,
    files: Array<{ objectKey: string; name: string; type: string; size: number }>,
    setId?: string,
    watermarkId?: string,
  ) {
    if (!Array.isArray(files) || !files.length || files.length > 10) throw new BadRequestException('1 to 10 completed files are required');
    const localFiles: Express.Multer.File[] = [];
    try {
      for (const file of files) localFiles.push(await this.minioService.downloadDirectUpload(userId, file));
      return await this.uploadImages(userId, collectionId, localFiles, setId, watermarkId);
    } finally {
      await Promise.all(files.map((file) => this.minioService.deleteDirectUpload(userId, file.objectKey).catch(() => null)));
      await Promise.all(localFiles.map((file) => this.safeUnlink(file.path)));
    }
  }

  private async indexFacesInBackground(images: Array<CollectionImage & { _id?: unknown }>) {
    for (const image of images) {
      await this.faceSearchService.indexImage(image).catch((error) => {
        console.warn('Face indexing failed:', error?.message ?? error);
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  async removeImage(userId: string, collectionId: string, imageId: string) {
    const image = await this.imageModel.findOne({ _id: imageId, userId, collectionId });
    if (!image) throw new NotFoundException('Image not found');
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();

    await this.deleteStoredImageFiles(image);
    await this.imageModel.deleteOne({ _id: imageId, userId, collectionId });
    await this.imageFavoriteModel.deleteMany({ imageId });
    await this.faceSearchService.deleteImageFaces(collectionId, imageId);
    await this.decrementStorageUsedBytes(userId, image.sizeBytes ?? 0);
    const nextImage = await this.imageModel
      .findOne({ userId, collectionId })
      .sort({ createdAt: -1 })
      .lean();
    const update: Record<string, unknown> = { $inc: { imageCount: -1 } };
    if (collection?.coverImage === image.url) {
      if (nextImage?.url) update.$set = { coverImage: nextImage.url };
      else update.$unset = { coverImage: '' };
    }
    await this.collectionModel.updateOne({ _id: collectionId, userId }, update);

    return image.toObject();
  }

  async starImage(userId: string, collectionId: string, imageId: string, starred: boolean) {
    const image = await this.imageModel.findOne({ _id: imageId, userId, collectionId });
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
  ) {
    const metadata = await this.extractMetadata(file);
    const isImage = file.mimetype?.startsWith('image/');
    let uploadFile = file;
    let processedPath = '';
    let previewPath = '';
    let watermarked = false;
    let thumbnailUrl = '';
    let blurDataUrl = '';

    if (isImage && watermark) {
      const processed = await this.applyWatermark(file, watermark);
      if (processed) {
        processedPath = processed.path;
        uploadFile = { ...file, path: processed.path, filename: processed.filename };
        watermarked = true;
      }
    }

    let url = '';
    try {
      if (isImage) {
        const preview = await this.createImagePreview(uploadFile);
        previewPath = preview.path;
        blurDataUrl = preview.blurDataUrl;
        thumbnailUrl = await this.minioService.uploadFile({
          ...file,
          path: preview.path,
          filename: preview.filename,
          mimetype: 'image/jpeg',
        });
      }
      url = await this.minioService.uploadFile(uploadFile);
    } finally {
      await this.safeUnlink(file.path);
      if (processedPath) await this.safeUnlink(processedPath);
      if (previewPath) await this.safeUnlink(previewPath);
    }

    const image = await this.imageModel.create({
      userId,
      collectionId,
      setId,
      url,
      thumbnailUrl,
      blurDataUrl,
      originalName: file.originalname,
      filename: uploadFile.filename,
      mimetype: uploadFile.mimetype,
      sizeBytes: uploadFile.size ?? file.size ?? 0,
      watermarked,
      order,
      metadata,
    });
    await this.userModel.updateOne(
      { _id: userId },
      { $inc: { storageUsedBytes: Math.max(0, Number(image.sizeBytes ?? uploadFile.size ?? file.size ?? 0)) } },
    );

    return image.toObject();
  }

  private imageProcessingConcurrency() {
    const configured = Number(this.configService.get<string>('IMAGE_UPLOAD_PROCESSING_CONCURRENCY') ?? 2);
    return Math.max(1, Math.min(4, Number.isFinite(configured) ? Math.floor(configured) : 2));
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

  private sortImagesForGallery<T extends { order?: number; createdAt?: Date | string; _id?: unknown }>(images: T[]) {
    return [...images].sort((a, b) => {
      const aOrder = Number(a.order);
      const bOrder = Number(b.order);
      const aHasOrder = Number.isFinite(aOrder) && aOrder > 0;
      const bHasOrder = Number.isFinite(bOrder) && bOrder > 0;
      if (aHasOrder && bHasOrder) return aOrder - bOrder;
      if (aHasOrder) return -1;
      if (bHasOrder) return 1;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }

  private async findImagesPage(query: Record<string, unknown>, limitValue?: string, offsetValue?: string) {
    const limit = this.pageLimit(limitValue);
    const offset = this.pageOffset(offsetValue);
    const [items, total] = await Promise.all([
      this.imageModel
        .find(query)
        .sort({ order: 1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.imageModel.countDocuments(query),
    ]);
    return {
      items: this.sortImagesForGallery(items),
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
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
    return this.createImagePreviewFromSharp(sharp(file.path).rotate());
  }

  private async createImagePreviewFromSharp(image: Sharp) {
    const filename = `thumb-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const outputPath = join(cwd(), 'uploads', filename);
    const blurDataUrl = await image
      .clone()
      .resize({ width: 24, height: 24, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 35 })
      .toBuffer()
      .then((buffer) => `data:image/jpeg;base64,${buffer.toString('base64')}`)
      .catch(() => '');

    await image
      .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 74, mozjpeg: true })
      .toFile(outputPath);

    return { path: outputPath, filename, blurDataUrl };
  }

  private async ensureCollectionPreviews(collectionId: string) {
    const images = await this.imageModel
      .find({ collectionId, thumbnailUrl: { $in: [null, ''] } })
      .limit(30)
      .lean()
      .catch(() => []);

    for (const image of images) {
      const buffer = await this.readImageBuffer(image.url).catch(() => null);
      if (!buffer) continue;
      let previewPath = '';
      try {
        const preview = await this.createImagePreviewFromSharp(sharp(buffer).rotate());
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
    const sharpMeta: Partial<Metadata> = await sharp(file.path).metadata().catch(() => ({}));
    const exif = await exifr
      .parse(file.path, { exif: true, iptc: true, xmp: true })
      .catch(() => null);

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
      dateTaken: exif?.DateTimeOriginal ?? exif?.CreateDate,
      software: exif?.Software,
      artist: exif?.Artist,
      copyright: exif?.Copyright,
      gps: exif?.latitude && exif?.longitude
        ? { latitude: exif.latitude, longitude: exif.longitude, altitude: exif?.GPSAltitude }
        : undefined,
      title: exif?.title ?? '',
      caption: exif?.description ?? '',
      headline: exif?.Headline ?? '',
      keyword: exif?.keywords ?? exif?.Keywords ?? [],
      rating: exif?.Rating,
      colorLabel: exif?.Label,
      raw: this.compactMetadata(exif),
      starred: false,
    };
  }

  private async resolveWatermark(userId: string, presetId: string) {
    const preset = await this.settingModel
      .findOne({ userId, type: DashboardSettingType.PRESET, localId: presetId })
      .lean();
    const presetData = preset?.data as any;
    const defaultWatermark =
      presetData?.general?.defaultWatermark ?? presetData?.presetGeneral?.defaultWatermark;

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

  private async applyWatermark(file: Express.Multer.File, watermark: WatermarkData) {
    const image = sharp(file.path).rotate();
    const meta = await image.metadata();
    const width = meta.width ?? 1200;
    const height = meta.height ?? 800;
    const rawPosition = watermark.position ?? { x: 15, y: 85 };
    const opacity = (watermark.opacity ?? 90) / 100;
    const outputPath = join(cwd(), 'uploads', `wm-${file.filename}`);
    const outputFilename = `wm-${file.filename}`;

    if (watermark.type === 'text') {
      const text = this.escapeSvg(watermark.text || 'Watermark');
      const fontFamily = this.watermarkFontFamily(watermark.font);
      const fontSize = this.watermarkTextSize(width, watermark.scale);
      const estimatedTextWidth = (watermark.text || 'Watermark').length * fontSize * 0.55;
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

      await image.composite([{ input: svg, left: 0, top: 0 }]).toFile(outputPath);
      return { path: outputPath, filename: outputFilename };
    }

    const overlay = await this.readWatermarkImage(watermark.image);
    if (!overlay) return null;

    const overlayWidth = this.watermarkImageWidth(width, watermark.scale);
    const overlayBuffer = await sharp(overlay)
      .resize({ width: overlayWidth, withoutEnlargement: true })
      .ensureAlpha(opacity)
      .toBuffer();
    const overlayMeta = await sharp(overlayBuffer).metadata();
    const overlayHeight = overlayMeta.height ?? overlayWidth;
    const position = {
      x: this.clampPercent(rawPosition.x, ((overlayMeta.width ?? overlayWidth) / width) * 50, 100 - ((overlayMeta.width ?? overlayWidth) / width) * 50),
      y: this.clampPercent(rawPosition.y, (overlayHeight / height) * 50, 100 - (overlayHeight / height) * 50),
    };
    const left = Math.round((position.x / 100) * width - (overlayMeta.width ?? overlayWidth) / 2);
    const top = Math.round((position.y / 100) * height - overlayHeight / 2);

    await image.composite([{ input: overlayBuffer, left, top }]).toFile(outputPath);
    return { path: outputPath, filename: outputFilename };
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
    try {
      await unlink(path);
    } catch {
      return;
    }
  }

  private async deleteStoredImageFiles(image: CollectionImageDocument) {
    const references = [
      image.url,
      image.thumbnailUrl,
      image.filename,
    ].filter(Boolean) as string[];

    for (const reference of [...new Set(references)]) {
      await this.minioService.deleteService(reference);
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

  private async findCollectionByIdentifier(identifier: string, siteSlug?: string) {
    const query: Record<string, string>[] = [{ slug: identifier }, { name: identifier }];
    if (identifier.match(/^[a-f\d]{24}$/i)) query.unshift({ _id: identifier });
    const owner = siteSlug
      ? await this.homepageModel.findOne({ slug: siteSlug.toLowerCase(), enabled: true }).select('userId').lean()
      : null;
    if (siteSlug && !owner) throw new NotFoundException('Collection not found');
    const collection = await this.collectionModel
      .findOne({ $or: query, ...(owner ? { userId: owner.userId } : {}) })
      .sort({ createdAt: -1 })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
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
    ].map((family) => family.includes(' ') ? `"${this.escapeCssString(family)}"` : this.escapeCssString(family)).join(', ');
  }

  private serverWatermarkFont(font?: string) {
    const value = String(font || '').trim().toLowerCase();
    if (value.includes('times') || value.includes('georgia') || value.includes('playfair')) return 'Noto Serif';
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
        .filter(([, item]) => item !== undefined && item !== null && item !== '')
        .map(([key, item]) => [
          key,
          item instanceof Date ? item.toISOString() : item,
        ]),
    );
  }

  private async ensureStorageAvailable(userId: string, incomingBytes: number) {
    const user = await this.userModel.findById(userId).select('planName storageLimitGb storageUsedBytes planExpiresAt').lean();
    if (user?.planExpiresAt && user.planExpiresAt <= new Date()) {
      throw new BadRequestException('Plan expired. Purchase a plan to continue uploading images.');
    }
    const limitGb = Math.max(0, Number(user?.storageLimitGb ?? 0));
    const limitBytes = limitGb * 1024 * 1024 * 1024;
    const used = Number(user?.storageUsedBytes ?? 0);
    if (used + incomingBytes > limitBytes) {
      throw new BadRequestException('Storage limit exceeded. Upgrade plan to upload more images.');
    }
  }

  private async decrementStorageUsedBytes(userId: string, bytes: number) {
    const safeBytes = Math.max(0, Number(bytes ?? 0));
    if (safeBytes > 0) {
      const user = await this.userModel.findById(userId).select('storageUsedBytes').lean();
      const nextUsedBytes = Math.max(0, Number(user?.storageUsedBytes ?? 0) - safeBytes);
      await this.userModel.updateOne({ _id: userId }, { $set: { storageUsedBytes: nextUsedBytes } });
    }
    await this.clearStorageIfNoImages(userId);
  }

  private async clearStorageIfNoImages(userId: string) {
    const [collectionImages, mobileImages] = await Promise.all([
      this.imageModel.exists({ userId }),
      this.mobileGalleryImageModel.exists({ userId }),
    ]);
    if (!collectionImages && !mobileImages) {
      await this.userModel.updateOne({ _id: userId }, { $set: { storageUsedBytes: 0 } });
    }
  }

  private cleanEmail(value?: string) {
    const email = String(value ?? '').trim().toLowerCase();
    return email.includes('@') ? email : '';
  }

  private resolveEmailAccess(settings: any, email?: string) {
    const general = settings?.general ?? {};
    const access = settings?.access ?? {};
    const required = this.boolSetting(general.emailRegistration);
    if (!required) return { required: false, authorized: true, status: 'open', email: '' };
    const clean = this.cleanEmail(email);
    if (!clean) return { required: true, authorized: false, status: 'required', email: '' };
    const allowedEmails = Array.isArray(access.allowedEmails) ? access.allowedEmails.map((item: string) => this.cleanEmail(item)).filter(Boolean) : [];
    const requests = Array.isArray(access.requests) ? access.requests : [];
    const request = requests.find((item: any) => this.cleanEmail(item.email) === clean);
    const approved = request?.status === 'approved';
    const denied = request?.status === 'declined';
    return {
      required: true,
      authorized: allowedEmails.includes(clean) || approved,
      status: allowedEmails.includes(clean) || approved ? 'approved' : denied ? 'declined' : request ? 'pending' : 'unknown',
      email: clean,
    };
  }

  private boolSetting(value: unknown) {
    if (typeof value === 'boolean') return value;
    const text = String(value ?? '').toLowerCase();
    return ['true', 'on', 'yes', '1', 'enabled'].includes(text);
  }

  private async sanitizeCollectionCapabilities<T extends CreateCollectionDto | UpdateCollectionDto>(userId: string, dto: T): Promise<T> {
    const user = await this.userModel.findById(userId).select('planFeatures').lean();
    const features = user?.planFeatures ?? {};
    const next: any = { ...dto };
    const settings = { ...((next.settings ?? {}) as any) };
    const download = { ...(settings.download ?? {}) };
    const store = { ...(settings.store ?? {}) };
    const design = { ...((next.design ?? {}) as any) };

    if (next.coverImage && !features.coverImage) delete next.coverImage;

    if (!features.customCover) {
      delete design.customCoverTemplate;
      if (String(design.cover ?? '').startsWith('custom:')) design.cover = 'Center';
    }

    if (!features.advancedDesign) {
      delete design.typography;
      delete design.customFontName;
      delete design.customFontDataUrl;
      delete design.color;
      delete design.navigationStyle;
    }

    if (!features.layouts) {
      design.gridStyle = 'Vertical';
      design.thumbnailSize = 'Regular';
      design.gridSpacing = 'Regular';
    }

    if ((download.limitDownloads || download.restrictDownloads) && !features.downloadLimit) {
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
    }

    if (next.design) next.design = design;
    if (next.settings) next.settings = { ...settings, download, store };
    return next as T;
  }
}

function minDate(values: Date[]) {
  if (!values.length) return undefined;
  return new Date(Math.min(...values.map((value) => new Date(value).getTime())));
}

function maxDate(values: Date[]) {
  if (!values.length) return undefined;
  return new Date(Math.max(...values.map((value) => new Date(value).getTime())));
}

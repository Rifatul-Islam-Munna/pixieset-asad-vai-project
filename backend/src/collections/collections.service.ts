import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { Model } from 'mongoose';
import { join } from 'path';
import { cwd } from 'process';
import sharp, { type Metadata } from 'sharp';
import * as exifr from 'exifr';
import { MinioService } from 'src/lib/minio.service';
import { DashboardSetting, DashboardSettingDocument, DashboardSettingType } from 'src/settings/entities/dashboard-setting.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { Collection, CollectionDocument } from './entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from './entities/collection-image.entity';

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
    @InjectModel(DashboardSetting.name) private readonly settingModel: Model<DashboardSettingDocument>,
    private readonly minioService: MinioService,
  ) {}

  async create(userId: string, dto: CreateCollectionDto) {
    const collection = await this.collectionModel.create({
      userId,
      name: dto.name,
      slug: this.slugify(dto.name),
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
      presetId: dto.presetId,
      design: dto.design ?? {},
      settings: dto.settings ?? {},
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

  async findOne(userId: string, id: string) {
    const collection = await this.collectionModel.findOne({ _id: id, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const images = await this.imageModel
      .find({ collectionId: id, userId })
      .sort({ createdAt: -1 })
      .lean();

    return { ...collection, images };
  }

  async findPublic(identifier: string) {
    const query: Record<string, string>[] = [{ slug: identifier }, { name: identifier }];
    if (identifier.match(/^[a-f\d]{24}$/i)) query.unshift({ _id: identifier });
    const collection = await this.collectionModel
      .findOne({
        $or: query,
      })
      .sort({ createdAt: -1 })
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const images = await this.imageModel
      .find({ collectionId: collection._id.toString() })
      .sort({ createdAt: -1 })
      .lean();
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

    return {
      ...collection,
      design: {
        ...(presetData?.design ?? presetData?.presetDesign ?? {}),
        ...(collection.design ?? {}),
      },
      settings: {
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
      },
      images,
    };
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

    if (dto.name !== undefined) {
      collection.name = dto.name;
      collection.slug = this.slugify(dto.name);
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
    if (dto.design !== undefined) collection.design = dto.design;
    if (dto.settings !== undefined) collection.settings = dto.settings;

    await collection.save();
    return collection.toObject();
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

  async uploadImages(userId: string, collectionId: string, files: Express.Multer.File[], setId?: string, uploadWatermarkId?: string) {
    if (!files?.length) throw new BadRequestException('Files are required');

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

    const uploaded = await Promise.all(
      files.map((file) => this.processAndSaveImage(userId, collectionId, file, watermark, resolvedSetId)),
    );

    await this.collectionModel.updateOne(
      { _id: collectionId, userId },
      {
        $inc: { imageCount: uploaded.length },
        $set: { coverImage: collection.coverImage ?? uploaded[0]?.url },
      },
    );

    return uploaded;
  }

  async removeImage(userId: string, collectionId: string, imageId: string) {
    const image = await this.imageModel.findOne({ _id: imageId, userId, collectionId });
    if (!image) throw new NotFoundException('Image not found');
    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();

    await this.imageModel.deleteOne({ _id: imageId, userId, collectionId });
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

    const filename = image.filename || image.url?.split('/').pop();
    if (filename) await this.minioService.deleteService(filename).catch(() => false);
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
  ) {
    const metadata = await this.extractMetadata(file);
    const isImage = file.mimetype?.startsWith('image/');
    let uploadFile = file;
    let processedPath = '';
    let watermarked = false;

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
      url = await this.minioService.uploadFile(uploadFile);
    } finally {
      await this.safeUnlink(file.path);
      if (processedPath) await this.safeUnlink(processedPath);
    }

    const image = await this.imageModel.create({
      userId,
      collectionId,
      setId,
      url,
      originalName: file.originalname,
      filename: uploadFile.filename,
      mimetype: file.mimetype,
      watermarked,
      metadata,
    });

    return image.toObject();
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
      const fontSize = Math.max(24, (watermark.scale ?? 42) * 1.7);
      const estimatedTextWidth = (watermark.text || 'Watermark').length * fontSize * 0.55;
      const padX = Math.min(45, Math.max(5, (estimatedTextWidth / width) * 50));
      const padY = Math.min(45, Math.max(5, (fontSize / height) * 60));
      const position = {
        x: this.clampPercent(rawPosition.x, padX, 100 - padX),
        y: this.clampPercent(rawPosition.y, padY, 100 - padY),
      };
      const svg = Buffer.from(`
        <svg width="${width}" height="${height}">
          <text x="${position.x}%" y="${position.y}%"
            text-anchor="middle" dominant-baseline="middle"
            font-family="${this.escapeSvg(watermark.font || 'Arial')}"
            font-size="${fontSize}"
            fill="${watermark.color || '#ffffff'}"
            opacity="${opacity}">${text}</text>
        </svg>
      `);

      await image.composite([{ input: svg, left: 0, top: 0 }]).toFile(outputPath);
      return { path: outputPath, filename: outputFilename };
    }

    const overlay = await this.readWatermarkImage(watermark.image);
    if (!overlay) return null;

    const overlayWidth = Math.max(40, Math.round((watermark.scale ?? 42) * 2.4));
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

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private escapeSvg(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { Model } from 'mongoose';
import { join } from 'path';
import { cwd } from 'process';
import sharp from 'sharp';
import * as exifr from 'exifr';
import { MinioService } from 'src/lib/minio.service';
import { DashboardSetting, DashboardSettingDocument, DashboardSettingType } from 'src/settings/entities/dashboard-setting.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
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

  async uploadImages(userId: string, collectionId: string, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Files are required');

    const collection = await this.collectionModel.findOne({ _id: collectionId, userId }).lean();
    if (!collection) throw new NotFoundException('Collection not found');

    const watermark = collection.presetId
      ? await this.resolveWatermark(userId, collection.presetId)
      : null;

    const uploaded = await Promise.all(
      files.map((file) => this.processAndSaveImage(userId, collectionId, file, watermark)),
    );

    await this.collectionModel.updateOne(
      { _id: collectionId, userId },
      {
        $inc: { imageCount: uploaded.length },
        $set: { coverImage: uploaded[0]?.url ?? collection.coverImage },
      },
    );

    return uploaded;
  }

  private async processAndSaveImage(
    userId: string,
    collectionId: string,
    file: Express.Multer.File,
    watermark: WatermarkData | null,
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

    const url = await this.minioService.uploadFile(uploadFile);
    const keepPath = url.startsWith('/uploads/')
      ? join(cwd(), url.replace(/^\/+/, ''))
      : '';
    await this.safeUnlinkUnlessKept(file.path, keepPath);
    if (processedPath) await this.safeUnlinkUnlessKept(processedPath, keepPath);

    const image = await this.imageModel.create({
      userId,
      collectionId,
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
    const sharpMeta = await sharp(file.path).metadata().catch(() => ({}));
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
      camera: exif?.Make,
      lens: exif?.LensModel,
      focalLength: exif?.FocalLength,
      shutterSpeed: exif?.ExposureTime,
      aperture: exif?.FNumber,
      iso: exif?.ISO,
      flash: exif?.Flash,
      title: exif?.title ?? '',
      caption: exif?.description ?? '',
      headline: exif?.Headline ?? '',
      keyword: exif?.keywords ?? exif?.Keywords ?? [],
      rating: exif?.Rating,
      colorLabel: exif?.Label,
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

  private async applyWatermark(file: Express.Multer.File, watermark: WatermarkData) {
    const image = sharp(file.path).rotate();
    const meta = await image.metadata();
    const width = meta.width ?? 1200;
    const height = meta.height ?? 800;
    const position = watermark.position ?? { x: 15, y: 85 };
    const opacity = (watermark.opacity ?? 90) / 100;
    const outputPath = join(cwd(), 'uploads', `wm-${file.filename}`);
    const outputFilename = `wm-${file.filename}`;

    if (watermark.type === 'text') {
      const text = this.escapeSvg(watermark.text || 'Watermark');
      const fontSize = Math.max(24, (watermark.scale ?? 42) * 1.7);
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
    const left = Math.round((position.x / 100) * width - (overlayMeta.width ?? overlayWidth) / 2);
    const top = Math.round((position.y / 100) * height - (overlayMeta.height ?? overlayWidth) / 2);

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

  private async safeUnlinkUnlessKept(path: string, keepPath: string) {
    if (keepPath && path === keepPath) return;
    await this.safeUnlink(path);
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
}

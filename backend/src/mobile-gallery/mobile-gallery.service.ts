import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { unlink } from 'fs/promises';
import { Model } from 'mongoose';
import { extname } from 'path';
import { MinioService } from 'src/lib/minio.service';
import { MobileGalleryApp, MobileGalleryAppDocument } from './entities/mobile-gallery-app.entity';
import { MobileGalleryImage, MobileGalleryImageDocument } from './entities/mobile-gallery-image.entity';
import { MobileGallerySetting, MobileGallerySettingDocument } from './entities/mobile-gallery-setting.entity';

const defaultDesign = {
  coverStyle: 'none',
  focal: { x: 50, y: 50 },
  theme: 'lark',
  layout: 'vertical',
  gridStyle: 'masonry',
  backgroundColor: '#ffffff',
  textColor: '#222222',
  coverText: {},
};

const defaultSettings = {
  callToAction: {
    enabled: true,
    label: 'Visit Website',
    url: '',
  },
};

@Injectable()
export class MobileGalleryService {
  constructor(
    @InjectModel(MobileGalleryApp.name) private readonly appModel: Model<MobileGalleryAppDocument>,
    @InjectModel(MobileGalleryImage.name) private readonly imageModel: Model<MobileGalleryImageDocument>,
    @InjectModel(MobileGallerySetting.name) private readonly settingModel: Model<MobileGallerySettingDocument>,
    private readonly minioService: MinioService,
  ) {}

  async create(userId: string, body: Record<string, any>) {
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('App name is required');
    const app = await this.appModel.create({
      userId,
      name,
      slug: await this.uniqueSlug(name),
      eventDate: body.eventDate ? new Date(body.eventDate) : new Date(),
      status: body.status === 'draft' ? 'draft' : 'published',
      design: { ...defaultDesign, ...(body.design ?? {}) },
      settings: { ...defaultSettings, ...(body.settings ?? {}) },
      imageCount: 0,
    });
    return app.toObject();
  }

  async findAll(userId: string) {
    return this.appModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async findOne(userId: string, id: string, limit?: string, offset?: string) {
    const app = await this.appModel.findOne({ _id: id, userId }).lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    const imagesPage = await this.findImages(userId, id, limit, offset);
    return { ...app, images: imagesPage.items, imagesPage };
  }

  async findPublic(identifier: string, limit?: string, offset?: string) {
    const app = await this.appModel.findOne({
      $or: [{ slug: identifier }, ...(identifier.match(/^[a-f\d]{24}$/i) ? [{ _id: identifier }] : [])],
      status: 'published',
    }).lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    const [imagesPage, profile] = await Promise.all([
      this.findPublicImages(app._id.toString(), limit, offset),
      this.settingModel.findOne({ userId: app.userId }).lean(),
    ]);
    return { ...app, images: imagesPage.items, imagesPage, profile: profile ?? {} };
  }

  async findImages(userId: string, appId: string, limit?: string, offset?: string) {
    const app = await this.appModel.findOne({ _id: appId, userId }).select('_id').lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    return this.findImagesPage({ appId, userId }, limit, offset);
  }

  async findPublicImages(identifier: string, limit?: string, offset?: string) {
    const app = await this.appModel.findOne({
      $or: [{ slug: identifier }, ...(identifier.match(/^[a-f\d]{24}$/i) ? [{ _id: identifier }] : [])],
      status: 'published',
    }).select('_id').lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    return this.findImagesPage({ appId: app._id.toString() }, limit, offset);
  }

  async update(userId: string, id: string, body: Record<string, any>) {
    const app = await this.appModel.findOne({ _id: id, userId });
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestException('App name is required');
      app.name = name;
    }
    if (body.eventDate !== undefined) app.eventDate = body.eventDate ? new Date(body.eventDate) : undefined;
    if (body.coverImage !== undefined) app.coverImage = body.coverImage || undefined;
    if (body.iconUrl !== undefined) app.iconUrl = body.iconUrl || undefined;
    if (body.status !== undefined) app.status = body.status === 'draft' ? 'draft' : 'published';
    if (body.design !== undefined) app.design = { ...defaultDesign, ...(app.design ?? {}), ...body.design };
    if (body.settings !== undefined) app.settings = { ...defaultSettings, ...(app.settings ?? {}), ...body.settings };
    await app.save();
    return app.toObject();
  }

  async remove(userId: string, id: string) {
    const app = await this.appModel.findOne({ _id: id, userId }).lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    const images = await this.imageModel.find({ appId: id, userId }).select({ url: 1, thumbnailUrl: 1, filename: 1 }).lean();
    const filesToDelete = new Set<string>();
    for (const image of images) {
      [image.url, image.thumbnailUrl, image.filename].filter(Boolean).forEach((reference) => filesToDelete.add(String(reference)));
    }
    if (app.iconUrl) filesToDelete.add(app.iconUrl);
    const customFontUrl = String((app.design as any)?.coverText?.customFontUrl || '');
    if (customFontUrl) filesToDelete.add(customFontUrl);

    await Promise.all([
      this.imageModel.deleteMany({ appId: id, userId }),
      this.appModel.deleteOne({ _id: id, userId }),
    ]);
    await Promise.all(Array.from(filesToDelete).map((url) => this.minioService.deleteService(url).catch(() => null)));
    return { deleted: true, appId: id };
  }

  async uploadImages(userId: string, appId: string, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Files are required');
    this.assertImageFiles(files);
    const app = await this.appModel.findOne({ _id: appId, userId }).lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    const last = await this.imageModel.findOne({ appId, userId }).sort({ order: -1 }).lean();
    const start = Number(last?.order ?? 0);
    const uploaded: any[] = [];
    for (const [index, file] of files.entries()) {
      let url = '';
      try {
        url = await this.minioService.uploadFile(file);
      } finally {
        await unlink(file.path).catch(() => null);
      }
      const image = await this.imageModel.create({
        userId,
        appId,
        url,
        thumbnailUrl: url,
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        sizeBytes: file.size ?? 0,
        order: start + index + 1,
      });
      uploaded.push(image.toObject());
    }
    await this.appModel.updateOne(
      { _id: appId, userId },
      {
        $inc: { imageCount: uploaded.length },
        ...(app.coverImage ? {} : { $set: { coverImage: uploaded[0]?.url } }),
      },
    );
    return uploaded;
  }

  async reorderImages(userId: string, appId: string, imageIds: string[]) {
    if (!Array.isArray(imageIds) || !imageIds.length) throw new BadRequestException('Image order is required');
    const app = await this.appModel.findOne({ _id: appId, userId }).lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    await this.imageModel.bulkWrite(
      imageIds.map((imageId, index) => ({
        updateOne: {
          filter: { _id: imageId, appId, userId },
          update: { $set: { order: index + 1 } },
        },
      })),
    );
    return { updated: imageIds.length };
  }

  async removeImage(userId: string, appId: string, imageId: string) {
    const image = await this.imageModel.findOne({ _id: imageId, appId, userId });
    if (!image) throw new NotFoundException('Image not found');
    await this.imageModel.deleteOne({ _id: imageId, appId, userId });
    const [next, remaining, app] = await Promise.all([
      this.imageModel.findOne({ appId, userId }).sort({ order: 1 }).lean(),
      this.imageModel.countDocuments({ appId, userId }),
      this.appModel.findOne({ _id: appId, userId }).lean(),
    ]);
    const update: Record<string, any> = { $set: { imageCount: remaining } };
    if (app?.coverImage === image.url) update.$set.coverImage = next?.url ?? '';
    await this.appModel.updateOne({ _id: appId, userId }, update);
    await this.deleteStoredImageFiles(image);
    return image.toObject();
  }

  private async deleteStoredImageFiles(image: MobileGalleryImageDocument) {
    const references = [image.url, image.thumbnailUrl, image.filename].filter(Boolean) as string[];
    await Promise.all([...new Set(references)].map((reference) => this.minioService.deleteService(reference).catch(() => null)));
  }

  async uploadAsset(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    this.assertAssetFile(file);
    let url = '';
    try {
      url = await this.minioService.uploadFile(file);
    } finally {
      await unlink(file.path).catch(() => null);
    }
    return {
      url,
      userId,
      originalName: file.originalname,
      mimetype: file.mimetype,
      kind: this.isFontFile(file) ? 'font' : 'image',
    };
  }

  async getSettings(userId: string) {
    const setting = await this.settingModel.findOne({ userId }).lean();
    return setting ?? {
      userId,
      logoUrl: '',
      biography: '',
      socialLinks: {},
      contactEmail: '',
      phoneNumber: '',
      businessAddress: '',
      website: '',
    };
  }

  async updateSettings(userId: string, body: Record<string, any>) {
    const socialLinks = Object.fromEntries(
      Object.entries(body.socialLinks ?? {}).map(([key, value]) => [String(key).slice(0, 40), String(value ?? '').trim().slice(0, 500)]),
    );
    return this.settingModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          logoUrl: String(body.logoUrl ?? '').trim(),
          biography: String(body.biography ?? '').slice(0, 5000),
          socialLinks,
          contactEmail: String(body.contactEmail ?? '').trim(),
          phoneNumber: String(body.phoneNumber ?? '').trim(),
          businessAddress: String(body.businessAddress ?? '').slice(0, 1000),
          website: String(body.website ?? '').trim(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }

  private assertImageFiles(files: Express.Multer.File[]) {
    const invalid = files.find((file) => !String(file.mimetype || '').toLowerCase().startsWith('image/'));
    if (invalid) throw new BadRequestException(`${invalid.originalname || 'File'} is not a supported image`);
  }

  private assertAssetFile(file: Express.Multer.File) {
    if (String(file.mimetype || '').toLowerCase().startsWith('image/')) return;
    if (this.isFontFile(file)) return;
    throw new BadRequestException(`${file.originalname || 'File'} must be an image or a WOFF, WOFF2, TTF, or OTF font`);
  }

  private isFontFile(file: Express.Multer.File) {
    const extension = extname(file.originalname || file.filename || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    return ['.woff', '.woff2', '.ttf', '.otf'].includes(extension) || [
      'font/woff',
      'font/woff2',
      'font/ttf',
      'font/otf',
      'application/font-woff',
      'application/x-font-ttf',
      'application/x-font-opentype',
      'application/octet-stream',
    ].includes(mime) && ['.woff', '.woff2', '.ttf', '.otf'].includes(extension);
  }

  private async findImagesPage(query: Record<string, unknown>, limitValue?: string, offsetValue?: string) {
    const limit = this.pageLimit(limitValue);
    const offset = this.pageOffset(offsetValue);
    const [items, total] = await Promise.all([
      this.imageModel.find(query).sort({ order: 1, createdAt: -1 }).skip(offset).limit(limit).lean(),
      this.imageModel.countDocuments(query),
    ]);
    return { items, total, limit, offset, hasMore: offset + items.length < total };
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

  private async uniqueSlug(name: string) {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mobile-gallery';
    let slug = base;
    let index = 2;
    while (await this.appModel.exists({ slug })) slug = `${base}-${index++}`;
    return slug;
  }
}

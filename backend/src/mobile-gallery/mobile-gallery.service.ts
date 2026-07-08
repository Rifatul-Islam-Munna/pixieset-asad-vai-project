import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { unlink } from 'fs/promises';
import { Model } from 'mongoose';
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
    const apps = await this.appModel.find({ userId }).sort({ createdAt: -1 }).lean();
    return apps;
  }

  async findOne(userId: string, id: string) {
    const app = await this.appModel.findOne({ _id: id, userId }).lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    const images = await this.imageModel.find({ appId: id, userId }).sort({ order: 1, createdAt: -1 }).lean();
    return { ...app, images };
  }

  async findPublic(identifier: string) {
    const app = await this.appModel.findOne({
      $or: [{ slug: identifier }, ...(identifier.match(/^[a-f\d]{24}$/i) ? [{ _id: identifier }] : [])],
      status: 'published',
    }).lean();
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    const [images, profile] = await Promise.all([
      this.imageModel.find({ appId: app._id.toString() }).sort({ order: 1, createdAt: -1 }).lean(),
      this.settingModel.findOne({ userId: app.userId }).lean(),
    ]);
    return { ...app, images, profile: profile ?? {} };
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
    const app = await this.appModel.findOne({ _id: id, userId });
    if (!app) throw new NotFoundException('Mobile gallery app not found');
    await Promise.all([
      this.imageModel.deleteMany({ appId: id, userId }),
      this.appModel.deleteOne({ _id: id, userId }),
    ]);
    return { deleted: true, appId: id };
  }

  async uploadImages(userId: string, appId: string, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Files are required');
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
    const next = await this.imageModel.findOne({ appId, userId }).sort({ order: 1 }).lean();
    const app = await this.appModel.findOne({ _id: appId, userId }).lean();
    const update: Record<string, any> = { $inc: { imageCount: -1 } };
    if (app?.coverImage === image.url) {
      update.$set = { coverImage: next?.url ?? '' };
    }
    await this.appModel.updateOne({ _id: appId, userId }, update);
    return image.toObject();
  }

  async uploadAsset(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    let url = '';
    try {
      url = await this.minioService.uploadFile(file);
    } finally {
      await unlink(file.path).catch(() => null);
    }
    return { url, userId };
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
    return this.settingModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          logoUrl: String(body.logoUrl ?? ''),
          biography: String(body.biography ?? ''),
          socialLinks: body.socialLinks ?? {},
          contactEmail: String(body.contactEmail ?? ''),
          phoneNumber: String(body.phoneNumber ?? ''),
          businessAddress: String(body.businessAddress ?? ''),
          website: String(body.website ?? ''),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }

  private async uniqueSlug(name: string) {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mobile-gallery';
    let slug = base;
    let index = 2;
    while (await this.appModel.exists({ slug })) slug = `${base}-${index++}`;
    return slug;
  }
}

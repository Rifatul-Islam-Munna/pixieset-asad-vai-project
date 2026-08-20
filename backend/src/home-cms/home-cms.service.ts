import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { unlink } from 'fs/promises';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { MinioService } from 'src/lib/minio.service';
import { UpdateHomeCmsDto } from './dto/update-home-cms.dto';
import { HomeCms, HomeCmsDocument } from './entities/home-cms.entity';

@Injectable()
export class HomeCmsService {
  constructor(
    @InjectModel(HomeCms.name) private readonly homeCmsModel: Model<HomeCmsDocument>,
    private readonly minioService: MinioService,
  ) {}

  async getHomeCms() {
    const cms = await this.homeCmsModel.findOneAndUpdate(
      { key: 'home' },
      { $setOnInsert: { key: 'home', content: {}, seo: {}, auth: {}, brand: {}, legal: { en: {}, gr: {} }, coverTemplates: [], emailTemplates: [], fonts: [], media: { heroMediaType: 'image', heroMediaUrl: '' }, defaultLanguage: 'en' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return cms.toObject();
  }
  async uploadFont(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Font file is required');
    const extension = extname(file.originalname).toLowerCase();
    if (!['.woff', '.woff2', '.ttf', '.otf'].includes(extension)) {
      await unlink(file.path).catch(() => null);
      throw new BadRequestException('Only WOFF, WOFF2, TTF, and OTF fonts are allowed');
    }
    if (Number(file.size || 0) > 20 * 1024 * 1024) {
      await unlink(file.path).catch(() => null);
      throw new BadRequestException('Font must be 20 MB or smaller');
    }
    let url = '';
    try {
      url = await this.minioService.uploadFile(file);
    } finally {
      await unlink(file.path).catch(() => null);
    }
    const baseName = file.originalname.slice(0, Math.max(1, file.originalname.length - extension.length));
    const name = baseName.replace(/[^a-zA-Z0-9 _-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Uploaded Font';
    const font = {
      id: `admin-font-${randomUUID()}`,
      name,
      url,
      fileName: file.originalname,
      format: extension.slice(1),
      createdAt: new Date().toISOString(),
    };
    const cms = await this.homeCmsModel.findOneAndUpdate(
      { key: 'home' },
      { $push: { fonts: { $each: [font], $position: 0 } } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return {
      font,
      fonts: ((cms.toObject() as any).fonts ?? []) as Record<string, unknown>[],
    };
  }

  async removeFont(id: string) {
    const cms = await this.homeCmsModel.findOne({ key: 'home' }).lean();
    const fonts = Array.isArray((cms as any)?.fonts) ? (cms as any).fonts : [];
    if (!fonts.some((font: any) => String(font?.id) === id)) {
      throw new NotFoundException('Font not found');
    }
    const updated = await this.homeCmsModel.findOneAndUpdate(
      { key: 'home' },
      { $pull: { fonts: { id } } },
      { returnDocument: 'after' },
    );
    return {
      removed: true,
      fonts: (((updated?.toObject() as any)?.fonts) ?? []) as Record<string, unknown>[],
    };
  }
  async updateHomeCms(dto: UpdateHomeCmsDto) {
    console.log('[Home CMS] PATCH received', JSON.stringify({
      defaultLanguage: dto.defaultLanguage,
      enHero: dto.content?.en?.hero,
      grHero: dto.content?.gr?.hero,
      fullPayload: dto,
    }, null, 2));
    const cms = await this.homeCmsModel.findOneAndUpdate(
      { key: 'home' },
      {
        $set: {
          content: dto.content ?? {},
          seo: dto.seo ?? {},
          auth: dto.auth ?? {},
          brand: dto.brand ?? {},
          legal: dto.legal ?? { en: {}, gr: {} },
          coverTemplates: Array.isArray(dto.coverTemplates) ? dto.coverTemplates : [],
          emailTemplates: Array.isArray(dto.emailTemplates) ? dto.emailTemplates : [],
          media: dto.media ?? { heroMediaType: 'image', heroMediaUrl: '' },
          defaultLanguage: dto.defaultLanguage ?? 'en',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    const saved = cms.toObject();
    console.log('[Home CMS] Mongo saved', JSON.stringify({
      id: saved._id,
      defaultLanguage: saved.defaultLanguage,
      enHero: saved.content?.en?.hero,
      grHero: saved.content?.gr?.hero,
    }, null, 2));
    return saved;
  }
}

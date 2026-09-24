import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDynamicPageDto, UpdateDynamicPageDto } from './dynamic-page.dto';
import { DynamicPage, DynamicPageDocument } from './dynamic-page.entity';

@Injectable()
export class DynamicPageService {
  constructor(@InjectModel(DynamicPage.name) private readonly model: Model<DynamicPageDocument>) {}

  private slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `page-${Date.now()}`;
  }

  async publicList() {
    return this.model.find({ published: true, showInNavbar: true })
      .sort({ navOrder: 1, title: 1 })
      .select('title slug navLabel navDescription navOrder')
      .lean();
  }

  async publicOne(slug: string) {
    const page = await this.model.findOne({ slug: this.slugify(slug), published: true }).lean();
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async sitemapList() {
    return this.model.find({ published: true })
      .sort({ updatedAt: -1 })
      .select('title slug heroImageUrl heroEnabled columns legacyGridEnabled sections updatedAt createdAt robotsIndex')
      .lean();
  }

  async adminList() {
    return this.model.find().sort({ navOrder: 1, createdAt: -1 }).lean();
  }
  async create(dto: CreateDynamicPageDto) {
    const slug = this.slugify(dto.slug || dto.title);
    if (await this.model.exists({ slug })) throw new BadRequestException('Page slug already exists');
    const columnCount = Math.min(8, Math.max(3, dto.columnCount ?? 3));
    return (await this.model.create({ ...dto, slug, columnCount })).toObject();
  }

  async update(id: string, dto: UpdateDynamicPageDto) {
    const current = await this.model.findById(id);
    if (!current) throw new NotFoundException('Page not found');
    const slug = dto.slug !== undefined ? this.slugify(dto.slug || dto.title || current.title) : current.slug;
    if (await this.model.exists({ slug, _id: { $ne: id } })) throw new BadRequestException('Page slug already exists');
    const columnCount = dto.columnCount === undefined ? current.columnCount : Math.min(8, Math.max(3, dto.columnCount));
    Object.assign(current, dto, { slug, columnCount });
    await current.save();
    return current.toObject();
  }

  async remove(id: string) {
    const page = await this.model.findByIdAndDelete(id).lean();
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }
}

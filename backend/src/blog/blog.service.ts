import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Blog, BlogDocument } from './blog.entity';
import { CreateBlogDto, UpdateBlogDto } from './blog.dto';

@Injectable()
export class BlogService {
  constructor(@InjectModel(Blog.name) private readonly model: Model<BlogDocument>) {}

  private slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `post-${Date.now()}`;
  }

  async publicList() {
    return this.model.find({ published: true }).sort({ publishedAt: -1, createdAt: -1 }).lean();
  }

  async publicOne(slug: string) {
    const post = await this.model.findOne({ slug, published: true }).lean();
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async adminList() {
    return this.model.find().sort({ createdAt: -1 }).lean();
  }

  async create(dto: CreateBlogDto) {
    const slug = this.slugify(dto.slug || dto.title);
    if (await this.model.exists({ slug })) throw new BadRequestException('Blog slug already exists');
    return (await this.model.create({ ...dto, slug, published: dto.published ?? true, publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date() })).toObject();
  }

  async update(id: string, dto: UpdateBlogDto) {
    const current = await this.model.findById(id);
    if (!current) throw new NotFoundException('Blog post not found');
    const slug = dto.slug !== undefined ? this.slugify(dto.slug || dto.title || current.title) : current.slug;
    if (await this.model.exists({ slug, _id: { $ne: id } })) throw new BadRequestException('Blog slug already exists');
    Object.assign(current, dto, { slug, ...(dto.publishedAt ? { publishedAt: new Date(dto.publishedAt) } : {}) });
    await current.save();
    return current.toObject();
  }

  async remove(id: string) {
    const post = await this.model.findByIdAndDelete(id).lean();
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }
}

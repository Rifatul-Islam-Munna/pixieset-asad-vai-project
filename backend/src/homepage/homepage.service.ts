import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { DashboardSetting, DashboardSettingDocument, DashboardSettingType } from 'src/settings/entities/dashboard-setting.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { UpdateHomepageDto } from './dto/update-homepage.dto';
import { Homepage, HomepageDocument } from './entities/homepage.entity';

@Injectable()
export class HomepageService {
  constructor(
    @InjectModel(Homepage.name)
    private readonly homepageModel: Model<HomepageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Collection.name)
    private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name)
    private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(DashboardSetting.name)
    private readonly settingModel: Model<DashboardSettingDocument>,
  ) {}

  async getMine(userId: string) {
    const homepage = await this.getOrCreate(userId);
    return this.privatePayload(homepage);
  }

  async updateMine(userId: string, dto: UpdateHomepageDto) {
    const homepage = await this.getOrCreate(userId);
    const simpleFields: Array<keyof UpdateHomepageDto> = [
      'enabled',
      'brandName',
      'logoUrl',
      'biography',
      'website',
      'email',
      'phone',
      'address',
      'sortOrder',
    ];

    for (const key of simpleFields) {
      if (dto[key] !== undefined) (homepage as any)[key] = dto[key];
    }

    if (dto.socialLinks !== undefined) {
      homepage.socialLinks = {
        ...(homepage.socialLinks ?? {}),
        ...this.cleanStringMap(dto.socialLinks),
      };
      homepage.markModified('socialLinks');
    }

    if (dto.show !== undefined) {
      homepage.show = {
        ...(homepage.show ?? {}),
        ...Object.fromEntries(
          Object.entries(dto.show).map(([key, value]) => [key, Boolean(value)]),
        ),
      };
      homepage.markModified('show');
    }

    if (dto.password !== undefined) {
      homepage.passwordHash = dto.password
        ? this.hashPassword(userId, dto.password)
        : undefined;
    }

    await homepage.save();
    return this.privatePayload(homepage);
  }

  async getPublic(slug: string, password?: string) {
    const homepage = await this.homepageModel.findOne({ slug: slug.toLowerCase() }).lean();
    if (!homepage || !homepage.enabled) throw new NotFoundException('Homepage not found');

    const isLocked = Boolean(homepage.passwordHash);
    const passwordValid = !isLocked || this.hashPassword(homepage.userId, password ?? '') === homepage.passwordHash;
    const base = this.publicBase(homepage);

    if (!passwordValid) {
      return {
        ...base,
        locked: true,
        collections: [],
      };
    }

    const query = this.collectionModel.find({
      userId: homepage.userId,
      status: 'published',
    });
    if (homepage.sortOrder === 'oldest') query.sort('createdAt');
    else if (homepage.sortOrder === 'name') query.sort('name');
    else query.sort('-createdAt');
    const collections = await query.lean();

    const collectionIds = collections.map((collection) => collection._id.toString());
    const images = collectionIds.length
      ? await this.imageModel
          .find({ collectionId: { $in: collectionIds } })
          .sort({ order: 1, createdAt: -1 })
          .select('collectionId url thumbnailUrl')
          .lean()
      : [];

    const firstImage = new Map<string, any>();
    for (const image of images) {
      if (!firstImage.has(image.collectionId)) firstImage.set(image.collectionId, image);
    }

    return {
      ...base,
      locked: false,
      collections: collections.map((collection) => {
        const id = collection._id.toString();
        const fallback = firstImage.get(id);
        return {
          _id: id,
          name: collection.name,
          slug: collection.slug ?? id,
          eventDate: collection.eventDate,
          coverImage: collection.coverImage || fallback?.thumbnailUrl || fallback?.url || '',
          imageCount: collection.imageCount ?? 0,
          url: `/collection/${encodeURIComponent(collection.name)}/${encodeURIComponent(collection.slug ?? id)}`,
        };
      }),
    };
  }

  private async getOrCreate(userId: string) {
    let homepage = await this.homepageModel.findOne({ userId });
    if (homepage) return homepage;

    const [user, branding] = await Promise.all([
      this.userModel.findById(userId).lean(),
      this.settingModel.findOne({
        userId,
        type: DashboardSettingType.BRANDING,
        localId: 'branding',
      }).lean(),
    ]);
    if (!user) throw new NotFoundException('User not found');

    const brandingData = (branding?.data ?? {}) as Record<string, any>;
    homepage = await this.homepageModel.create({
      userId,
      slug: await this.uniqueSlug(user.name, userId),
      enabled: true,
      brandName: brandingData.brandText || user.name,
      logoUrl: brandingData.logoUrl || '',
      biography: '',
      website: '',
      email: user.email || '',
      phone: user.phoneNumber || '',
      address: '',
      socialLinks: {},
      show: {
        biography: true,
        social: true,
        website: true,
        email: true,
        phone: true,
        address: true,
      },
      sortOrder: 'newest',
    });
    return homepage;
  }

  private async uniqueSlug(name: string, userId: string) {
    const base = this.slugify(name) || 'gallery';
    const suffix = userId.slice(-6).toLowerCase();
    let candidate = `${base}-${suffix}`;
    let counter = 2;
    while (await this.homepageModel.exists({ slug: candidate })) {
      candidate = `${base}-${suffix}-${counter++}`;
    }
    return candidate;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 52);
  }

  private hashPassword(userId: string, password: string) {
    return createHash('sha256').update(`${userId}:${password}`).digest('hex');
  }

  private cleanStringMap(value: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, String(item ?? '').trim()]),
    );
  }

  private privatePayload(homepage: HomepageDocument) {
    const row = homepage.toObject();
    const { passwordHash: _passwordHash, ...safe } = row as any;
    return {
      ...safe,
      _id: row._id.toString(),
      hasPassword: Boolean(row.passwordHash),
      publicPath: `/home/${row.slug}`,
    };
  }

  private publicBase(homepage: any) {
    const show = homepage.show ?? {};
    return {
      slug: homepage.slug,
      brandName: homepage.brandName || 'Gallery',
      logoUrl: homepage.logoUrl || '',
      biography: show.biography ? homepage.biography || '' : '',
      website: show.website ? homepage.website || '' : '',
      email: show.email ? homepage.email || '' : '',
      phone: show.phone ? homepage.phone || '' : '',
      address: show.address ? homepage.address || '' : '',
      socialLinks: show.social ? homepage.socialLinks ?? {} : {},
      sortOrder: homepage.sortOrder ?? 'newest',
      hasPassword: Boolean(homepage.passwordHash),
    };
  }
}

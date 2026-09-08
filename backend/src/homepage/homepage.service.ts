import { createHash, randomBytes } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { DashboardSetting, DashboardSettingDocument, DashboardSettingType } from 'src/settings/entities/dashboard-setting.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { BookingSetting, BookingSettingDocument } from 'src/bookings/entities/booking-setting.entity';
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
    @InjectModel(BookingSetting.name)
    private readonly bookingSettingModel: Model<BookingSettingDocument>,
  ) {}

  async getMine(userId: string) {
    const homepage = await this.getOrCreate(userId);
    return this.privatePayload(homepage);
  }

  async provisionForUser(userId: string) {
    return this.getOrCreate(userId);
  }

  async setUsername(userId: string, username: string) {
    const collision = await this.homepageModel.exists({ slug: username, userId: { $ne: userId } });
    if (collision) throw new ConflictException('Username is not available');
    const homepage = await this.getOrCreate(userId);
    homepage.slug = username;
    await homepage.save();
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
      'showCategories',
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

    if (dto.featuredCollectionIds !== undefined) {
      homepage.featuredCollectionIds = [...new Set(
        dto.featuredCollectionIds.map((value) => String(value ?? '').trim()).filter(Boolean),
      )].slice(0, 12);
    }

    if (dto.password !== undefined) {
      const owner = await this.userModel.findById(userId).select('planFeatures').lean();
      if (dto.password && !owner?.planFeatures?.passwordProtection) {
        throw new ConflictException('Current plan does not allow Password Protection.');
      }
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
    const [integrations, bookingSettings, owner] = await Promise.all([
      this.settingModel
        .findOne({
          userId: homepage.userId,
          type: DashboardSettingType.INTEGRATION,
          localId: 'google-analytics',
        })
        .lean(),
      this.bookingSettingModel
        .findOne({ userId: homepage.userId })
        .select('enabled')
        .lean(),
      this.userModel.findById(homepage.userId).select('_id username').lean(),
    ]);
    const publicIntegrations = {
      googleAnalytics: (integrations?.data as any) ?? {},
    };
    const publicBooking = {
      enabled: Boolean(bookingSettings?.enabled),
      url: bookingSettings?.enabled && owner
        ? `/book/${encodeURIComponent(owner.username || owner._id.toString())}`
        : '',
    };

    if (!passwordValid) {
      return {
        ...base,
        integrations: publicIntegrations,
        booking: { enabled: false, url: '' },
        locked: true,
        collections: [],
      };
    }

    const query = this.collectionModel.find({
      userId: homepage.userId,
      status: 'published',
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });
    if (homepage.sortOrder === 'oldest') query.sort('createdAt');
    else if (homepage.sortOrder === 'name') query.sort('name');
    else query.sort('-createdAt');
    const [collections, blogSettings] = await Promise.all([
      query.lean(),
      this.settingModel
        .find({ userId: homepage.userId, type: DashboardSettingType.BLOG_POST })
        .sort({ updatedAt: -1 })
        .lean(),
    ]);
    const blogPosts = blogSettings
      .map((setting) => {
        const data = (setting.data ?? {}) as Record<string, unknown>;
        return { ...data, id: String(data.id ?? setting.localId) };
      })
      .filter((post) => post["published"] === true)
      .sort((a, b) => {
        const aFeatured = Boolean(a["featured"]);
        const bFeatured = Boolean(b["featured"]);
        if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
        const bDate = new Date(String(b["publishedAt"] || b["updatedAt"] || 0)).getTime();
        const aDate = new Date(String(a["publishedAt"] || a["updatedAt"] || 0)).getTime();
        return bDate - aDate;
      });

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
      integrations: publicIntegrations,
      booking: publicBooking,
      locked: false,
      blogPosts,
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
          tags: Array.isArray(collection.tags) ? collection.tags : [],
          featured: (homepage.featuredCollectionIds ?? []).includes(id),
          url: `/${encodeURIComponent(collection.slug ?? id)}`,
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
      slug: user.username || await this.uniqueSlug(user.name),
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
      showCategories: true,
      featuredCollectionIds: [],
    });
    return homepage;
  }

  private async uniqueSlug(name: string) {
    const base = this.slugify(name) || 'gallery';

    // Random suffix keeps public hostnames unguessable from Mongo IDs and makes
    // equal display names safe. The unique index remains the final authority.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `${base}-${randomBytes(6).toString('hex')}`;
      if (!(await this.homepageModel.exists({ slug: candidate }))) return candidate;
    }

    return `${base}-${randomBytes(6).toString('hex')}`;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
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
      showCategories: homepage.showCategories !== false,
      hasPassword: Boolean(homepage.passwordHash),
    };
  }
}

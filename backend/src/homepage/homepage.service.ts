import { createHash, randomBytes } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { DashboardSetting, DashboardSettingDocument, DashboardSettingType } from 'src/settings/entities/dashboard-setting.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { BookingSetting, BookingSettingDocument } from 'src/bookings/entities/booking-setting.entity';
import { Plan, PlanDocument } from 'src/admin/entities/plan.entity';
import { UpdateHomepageDto } from './dto/update-homepage.dto';
import { CreateHomepageSubdomainDto, UpdateHomepageSubdomainDto } from './dto/homepage-subdomain.dto';
import { Homepage, HomepageDocument } from './entities/homepage.entity';
import {
  ImagorService,
  type ImagorWatermark,
} from 'src/lib/imagor.service';

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
    @InjectModel(Plan.name)
    private readonly planModel: Model<PlanDocument>,
    private readonly imagorService: ImagorService,
  ) {}

  async getMine(userId: string) {
    const homepage = await this.getOrCreate(userId);
    return this.privatePayload(homepage);
  }

  async provisionForUser(userId: string) {
    return this.getOrCreate(userId);
  }

  async setUsername(userId: string, username: string) {
    const slug = this.normalizeSubdomainSlug(username);
    await this.ensureSubdomainAvailable(slug, userId, 'main');
    const homepage = await this.getOrCreate(userId);
    homepage.slug = slug;
    await homepage.save();
  }

  async createSubdomain(userId: string, dto: CreateHomepageSubdomainDto) {
    const [homepage, limit] = await Promise.all([
      this.getOrCreate(userId),
      this.subdomainLimitForUser(userId),
    ]);
    const used = 1 + (homepage.subdomains?.length ?? 0);
    if (limit > 0 && used >= limit) {
      throw new ConflictException(`Your plan allows ${limit} subdomain${limit === 1 ? '' : 's'} including the main subdomain.`);
    }

    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Subdomain name is required');
    const slug = this.normalizeSubdomainSlug(dto.slug);
    await this.ensureSubdomainAvailable(slug, userId);

    homepage.subdomains = [
      ...(homepage.subdomains ?? []),
      {
        id: randomBytes(8).toString('hex'),
        name: name.slice(0, 100),
        slug,
        enabled: true,
        createdAt: new Date(),
      },
    ];
    homepage.markModified('subdomains');
    await homepage.save();
    return this.privatePayload(homepage);
  }

  async updateSubdomain(userId: string, siteId: string, dto: UpdateHomepageSubdomainDto) {
    const homepage = await this.getOrCreate(userId);
    if (siteId === 'main') {
      if (dto.slug !== undefined) {
        const slug = this.normalizeSubdomainSlug(dto.slug);
        await this.ensureSubdomainAvailable(slug, userId, 'main');
        homepage.slug = slug;
      }
      if (dto.name !== undefined) {
        const name = String(dto.name).trim();
        if (!name) throw new BadRequestException('Subdomain name is required');
        homepage.mainSiteName = name.slice(0, 100);
      }
      if (dto.enabled !== undefined) homepage.enabled = Boolean(dto.enabled);
      await homepage.save();
      return this.privatePayload(homepage);
    }

    const sites = [...(homepage.subdomains ?? [])];
    const index = sites.findIndex((site) => String(site.id) === siteId);
    if (index < 0) throw new NotFoundException('Subdomain not found');
    const current = sites[index] as any;
    if (dto.slug !== undefined) {
      const slug = this.normalizeSubdomainSlug(dto.slug);
      await this.ensureSubdomainAvailable(slug, userId, siteId);
      current.slug = slug;
    }
    if (dto.name !== undefined) {
      const name = String(dto.name).trim();
      if (!name) throw new BadRequestException('Subdomain name is required');
      current.name = name.slice(0, 100);
    }
    if (dto.enabled !== undefined) current.enabled = Boolean(dto.enabled);
    homepage.subdomains = sites;
    homepage.markModified('subdomains');
    await homepage.save();
    return this.privatePayload(homepage);
  }

  async deleteSubdomain(userId: string, siteId: string) {
    if (siteId === 'main') throw new BadRequestException('The main subdomain cannot be deleted');
    const homepage = await this.getOrCreate(userId);
    const before = homepage.subdomains?.length ?? 0;
    homepage.subdomains = (homepage.subdomains ?? []).filter((site) => String(site.id) !== siteId);
    if (homepage.subdomains.length === before) throw new NotFoundException('Subdomain not found');
    homepage.markModified('subdomains');
    await homepage.save();

    await this.collectionModel.updateMany(
      { userId, homepageSiteIds: siteId },
      { $pull: { homepageSiteIds: siteId } },
    );
    await this.collectionModel.updateMany(
      { userId, homepageSiteIds: { $size: 0 } },
      { $set: { homepageSiteIds: ['main'] } },
    );
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
    const requestedSlug = String(slug ?? '').trim().toLowerCase();
    const homepage = await this.homepageModel.findOne({
      enabled: true,
      $or: [
        { slug: requestedSlug },
        { subdomains: { $elemMatch: { slug: requestedSlug, enabled: { $ne: false } } } },
      ],
    }).lean();
    if (!homepage) throw new NotFoundException('Homepage not found');
    const site = this.siteForSlug(homepage, requestedSlug);
    if (!site || site.enabled === false) throw new NotFoundException('Homepage not found');

    const isLocked = Boolean(homepage.passwordHash);
    const passwordValid = !isLocked || this.hashPassword(homepage.userId, password ?? '') === homepage.passwordHash;
    const base = this.publicBase(homepage, site);
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

    const siteVisibility = site.id === 'main'
      ? {
          $or: [
            { homepageSiteIds: { $exists: false } },
            { homepageSiteIds: { $size: 0 } },
            { homepageSiteIds: 'main' },
          ],
        }
      : { homepageSiteIds: site.id };
    const query = this.collectionModel.find({
      userId: homepage.userId,
      status: 'published',
      // showOnHomepage remains the master visibility switch. Legacy galleries
      // with no site assignment stay on the main subdomain by default.
      showOnHomepage: { $ne: false },
      $and: [
        siteVisibility,
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
      ],
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
          .select(
            'collectionId setId url thumbnailUrl mediaType metadata +originalObjectKey',
          )
          .lean()
      : [];

    const firstImage = new Map<string, any>();
    const imageByStoredUrl = new Map<string, any>();
    for (const image of images) {
      const collectionId = String(image.collectionId);
      if (!firstImage.has(collectionId)) firstImage.set(collectionId, image);
      for (const storedUrl of [image.url, image.thumbnailUrl]) {
        if (storedUrl) {
          imageByStoredUrl.set(
            `${collectionId}:${String(storedUrl)}`,
            image,
          );
        }
      }
    }

    const publicCollections = await Promise.all(
      collections.map(async (collection) => {
        const id = collection._id.toString();
        const fallback = firstImage.get(id);
        const storedCover = String(collection.coverImage ?? '').trim();
        const coverImage =
          (storedCover
            ? imageByStoredUrl.get(`${id}:${storedCover}`)
            : undefined) ?? fallback;
        const resolvedCover = await this.homepageImageUrl(
          homepage.userId,
          collection,
          coverImage,
        );
        return {
          _id: id,
          name: collection.name,
          slug: collection.slug ?? id,
          eventDate: collection.eventDate,
          coverImage:
            resolvedCover ||
            storedCover ||
            fallback?.thumbnailUrl ||
            fallback?.url ||
            '',
          imageCount: collection.imageCount ?? 0,
          tags: Array.isArray(collection.tags) ? collection.tags : [],
          featured: (homepage.featuredCollectionIds ?? []).includes(id),
          url: `/${encodeURIComponent(collection.slug ?? id)}`,
        };
      }),
    );

    return {
      ...base,
      integrations: publicIntegrations,
      booking: publicBooking,
      locked: false,
      blogPosts,
      collections: publicCollections,
    };
  }

  private async homepageImageUrl(
    userId: string,
    collection: any,
    image?: any,
  ) {
    const sourceObjectKey =
      String(image?.originalObjectKey ?? '').trim() ||
      String(image?.metadata?.directUploadObjectKey ?? '').trim();
    if (
      !this.imagorService.isEnabled() ||
      image?.mediaType === 'video' ||
      (!sourceObjectKey.startsWith('private-direct/') &&
        !sourceObjectKey.startsWith('direct/') &&
        !sourceObjectKey.startsWith('originals/'))
    ) {
      return '';
    }

    const watermark = await this.homepageWatermark(
      userId,
      collection,
      image,
    );
    const sourceDimensions =
      await this.imagorService.resolveSourceDimensions(sourceObjectKey, {
        width: image.width,
        height: image.height,
      });
    const urls = this.imagorService.imageUrls(
      sourceObjectKey,
      watermark,
      sourceDimensions,
    );
    return urls?.thumbnailUrl || urls?.url || '';
  }

  private async homepageWatermark(
    userId: string,
    collection: any,
    image: any,
  ): Promise<ImagorWatermark | undefined> {
    const explicit = String(image?.metadata?.watermarkId ?? '').trim();
    if (explicit === 'No watermark') return undefined;

    let watermarkId = explicit;
    if (!watermarkId) {
      const setId = String(image?.setId || 'highlights');
      const set = Array.isArray(collection?.sets)
        ? collection.sets.find((item: any) => String(item?.id) === setId)
        : undefined;
      watermarkId =
        String(set?.watermarkId ?? '').trim() ||
        String(collection?.watermarkId ?? '').trim();
    }

    if (!watermarkId && collection?.presetId) {
      const preset = await this.settingModel
        .findOne({
          userId,
          type: DashboardSettingType.PRESET,
          localId: String(collection.presetId),
        })
        .lean();
      const presetData = preset?.data as any;
      watermarkId = String(
        presetData?.general?.defaultWatermark ??
          presetData?.presetGeneral?.defaultWatermark ??
          '',
      ).trim();
    }

    if (!watermarkId || watermarkId === 'No watermark') return undefined;

    const setting = await this.settingModel
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
    const data = setting?.data as any;
    if (!data || !['text', 'image'].includes(String(data.type))) {
      return undefined;
    }

    return {
      type: data.type,
      text: data.text,
      font: data.font,
      color: data.color,
      scale: data.scale,
      opacity: data.opacity,
      position: data.position,
      image: data.image,
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
      mainSiteName: 'Main',
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
      if (!(await this.homepageModel.exists({ $or: [{ slug: candidate }, { 'subdomains.slug': candidate }] }))) return candidate;
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

  private normalizeSubdomainSlug(value: string) {
    const slug = String(value ?? '').trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
      throw new BadRequestException('Subdomain must use only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen');
    }
    const reserved = new Set(['www', 'api', 'admin', 'app', 'mail', 'ftp', 'cdn', 'assets', 'support', 'status']);
    if (reserved.has(slug)) throw new ConflictException('This subdomain is reserved');
    return slug;
  }

  private async ensureSubdomainAvailable(slug: string, userId: string, currentSiteId?: string) {
    const collision = await this.homepageModel
      .findOne({ $or: [{ slug }, { 'subdomains.slug': slug }] })
      .select('userId slug subdomains')
      .lean();
    if (!collision) return;
    if (String(collision.userId) !== String(userId)) {
      throw new ConflictException('This subdomain is already in use');
    }
    if (currentSiteId === 'main' && collision.slug === slug) return;
    const site = (collision.subdomains ?? []).find((item: any) => String(item.slug) === slug);
    if (site && String(site.id) === String(currentSiteId)) return;
    throw new ConflictException('This subdomain is already in use');
  }

  private siteForSlug(homepage: any, slug: string) {
    if (String(homepage.slug) === slug) {
      return {
        id: 'main',
        name: homepage.mainSiteName || homepage.brandName || 'Main',
        slug: homepage.slug,
        enabled: homepage.enabled !== false,
        isMain: true,
      };
    }
    const site = (homepage.subdomains ?? []).find((item: any) => String(item.slug) === slug);
    return site ? { ...site, isMain: false } : null;
  }

  private async subdomainLimitForUser(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('subdomainLimit planId')
      .lean();
    if (!user) throw new NotFoundException('User not found');

    if (user.planId) {
      const plan = await this.planModel
        .findById(user.planId)
        .select('subdomainLimit')
        .lean();
      if (plan) return Math.max(0, Number(plan.subdomainLimit ?? 1));
    }

    return Math.max(0, Number(user.subdomainLimit ?? 1));
  }

  private hashPassword(userId: string, password: string) {
    return createHash('sha256').update(`${userId}:${password}`).digest('hex');
  }

  private cleanStringMap(value: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, String(item ?? '').trim()]),
    );
  }

  private async privatePayload(homepage: HomepageDocument) {
    const row = homepage.toObject();
    const subdomainLimit = await this.subdomainLimitForUser(row.userId);
    const { passwordHash: _passwordHash, ...safe } = row as any;
    const sites = [
      {
        id: 'main',
        name: row.mainSiteName || row.brandName || 'Main',
        slug: row.slug,
        enabled: row.enabled !== false,
        isMain: true,
      },
      ...((row.subdomains ?? []).map((site: any) => ({
        id: String(site.id),
        name: String(site.name || site.slug),
        slug: String(site.slug),
        enabled: site.enabled !== false,
        isMain: false,
      }))),
    ];
    return {
      ...safe,
      _id: row._id.toString(),
      hasPassword: Boolean(row.passwordHash),
      publicPath: `/home/${row.slug}`,
      sites,
      subdomainLimit,
      subdomainsUsed: sites.length,
    };
  }

  private publicBase(homepage: any, site: any) {
    const show = homepage.show ?? {};
    return {
      slug: site.slug,
      siteId: site.id,
      siteName: site.name,
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

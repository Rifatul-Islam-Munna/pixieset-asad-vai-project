import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { User, UserDocument, UserType } from 'src/user/entities/user.entity';
import { AdminCreatePlanDto, AdminUpdatePlanDto } from './dto/admin-plan.dto';
import { AdminStripeSettingDto } from './dto/admin-stripe-setting.dto';
import { AdminCreateUserDto, AdminUpdateUserDto } from './dto/admin-user.dto';
import { AdminStripeSetting, AdminStripeSettingDocument } from './entities/admin-stripe-setting.entity';
import { Plan, PlanDocument } from './entities/plan.entity';
import { StoreOrder, StoreOrderDocument } from 'src/store/entities/store-order.entity';
import { FaceSearchService } from 'src/face-search/face-search.service';
import { StoreDefaultProductService } from 'src/store/store-default-product.service';
import { FreePlanSettingDto } from './dto/free-plan-setting.dto';
import { FreePlanSettingService } from './free-plan-setting.service';
import { PlanPurchase, PlanPurchaseDocument } from './entities/plan-purchase.entity';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
    @InjectModel(AdminStripeSetting.name)
    private readonly stripeSettingModel: Model<AdminStripeSettingDocument>,
    @InjectModel(StoreOrder.name) private readonly orderModel: Model<StoreOrderDocument>,
    @InjectModel(PlanPurchase.name) private readonly planPurchaseModel: Model<PlanPurchaseDocument>,
    private readonly faceSearchService: FaceSearchService,
    private readonly defaultProducts: StoreDefaultProductService,
    private readonly freePlanSettings: FreePlanSettingService,
  ) {}

  async onModuleInit() {
    const settings = await this.freePlanSettings.get();
    await this.syncFreeUsers(settings);
  }

  async dashboard() {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthKeys = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return date.toISOString().slice(0, 7);
    });

    const [users, collections, images, plans, orders, paidRevenue, usersByMonth, ordersByMonth, planMix, recentUsers] = await Promise.all([
      this.userModel.countDocuments(),
      this.collectionModel.countDocuments(),
      this.imageModel.countDocuments(),
      this.planModel.countDocuments(),
      this.orderModel.countDocuments(),
      this.orderModel.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, revenue: { $sum: '$total' } } },
      ]),
      this.userModel.aggregate([
        { $match: { createdAt: { $gte: startMonth } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, users: { $sum: 1 } } },
      ]),
      this.orderModel.aggregate([
        { $match: { createdAt: { $gte: startMonth } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } },
          },
        },
      ]),
      this.userModel.aggregate([
        { $group: { _id: { $ifNull: ['$planName', 'Free'] }, value: { $sum: 1 } } },
        { $sort: { value: -1 } },
      ]),
      this.userModel.find().select('name email phoneNumber role planName createdAt').sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const userMonthMap = new Map(usersByMonth.map((item) => [item._id, item.users]));
    const orderMonthMap = new Map(ordersByMonth.map((item) => [item._id, item]));
    const monthly = monthKeys.map((month) => ({
      month,
      users: userMonthMap.get(month) ?? 0,
      orders: orderMonthMap.get(month)?.orders ?? 0,
      revenue: orderMonthMap.get(month)?.revenue ?? 0,
    }));

    return {
      users,
      collections,
      images,
      plans,
      orders,
      revenue: paidRevenue[0]?.revenue ?? 0,
      monthly,
      planMix: planMix.map((item) => ({ name: item._id, value: item.value })),
      recentUsers,
    };
  }

  async findUsers() {
    const users = await this.userModel.find().select('-password').sort({ createdAt: -1 }).lean();
    const ids = users.map((user: any) => user._id.toString());
    const counts = await this.collectionModel.aggregate([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [item._id, item.count]));

    return users.map((user: any) => ({
      ...user,
      collectionCount: countMap.get(user._id.toString()) ?? 0,
    }));
  }

  async createUser(dto: AdminCreateUserDto) {
    await this.ensureUnique(dto.phoneNumber);
    const { planId, ...userDto } = dto;
    const freePlan = await this.freePlanSettings.get();
    const user = await this.userModel.create({
      ...userDto,
      email: userDto.email?.trim().toLowerCase(),
      role: userDto.role ?? UserType.USER,
      password: await bcrypt.hash(dto.password, 10),
      isOtpVerified: true,
      otpNumber: '000000',
      storageLimitGb: freePlan.storageGb,
      monthlyEmailLimit: freePlan.monthlyEmails,
      planFeatures: { marketingEmails: freePlan.monthlyEmails > 0 },
    });
    if (planId) await this.assignPlanToUser(user._id.toString(), planId);
    const { password, ...safeUser } = user.toObject();
    return (await this.userModel.findById(user._id).select('-password').lean()) ?? safeUser;
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (dto.phoneNumber && dto.phoneNumber !== user.phoneNumber) await this.ensureUnique(dto.phoneNumber, id);

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.email !== undefined) user.email = dto.email?.trim().toLowerCase();
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.password) user.password = await bcrypt.hash(dto.password, 10);

    await user.save();
    if (dto.planId !== undefined) {
      if (dto.planId) await this.assignPlanToUser(id, dto.planId);
      else await this.clearUserPlan(id);
    }
    return this.userModel.findById(id).select('-password').lean();
  }

  async deleteUser(id: string, currentAdminId: string) {
    if (id === currentAdminId) throw new BadRequestException('Admin cannot delete own account');
    const user = await this.userModel.findByIdAndDelete(id).select('-password').lean();
    if (!user) throw new NotFoundException('User not found');
    const collections = await this.collectionModel.find({ userId: id }).select('_id').lean();
    await Promise.all(collections.map((collection) => this.faceSearchService.deleteCollectionFaces(collection._id.toString())));
    await Promise.all([
      this.collectionModel.deleteMany({ userId: id }),
      this.imageModel.deleteMany({ userId: id }),
    ]);
    return user;
  }

  async findCollections(userId?: string) {
    const filter = userId ? { userId } : {};
    const collections = await this.collectionModel.find(filter).sort({ createdAt: -1 }).lean();
    const userIds = [...new Set(collections.map((collection) => collection.userId))];
    const users = await this.userModel.find({ _id: { $in: userIds } }).select('name email phoneNumber').lean();
    const userMap = new Map(users.map((user: any) => [user._id.toString(), user]));

    return collections.map((collection: any) => ({
      ...collection,
      user: userMap.get(collection.userId) ?? null,
    }));
  }

  async findPlans() {
    return this.planModel.find().sort({ createdAt: -1 }).lean();
  }

  async findDefaultStoreProducts() {
    return this.defaultProducts.list();
  }

  async updateDefaultStoreProduct(id: string, dto: Record<string, unknown>) {
    return this.defaultProducts.update(id, dto);
  }

  async createPlan(dto: AdminCreatePlanDto) {
    if (dto.yearlyEnabled && Number(dto.priceYearly ?? 0) <= 0) {
      throw new BadRequestException('Yearly price must be greater than zero');
    }
    const plan = await this.planModel.create({
      name: dto.name.trim(),
      storageGb: Number(dto.storageGb ?? 0),
      monthlyEmails: Number(dto.monthlyEmails ?? 0),
      priceMonthly: Number(dto.priceMonthly ?? 0),
      yearlyEnabled: Boolean(dto.yearlyEnabled),
      priceYearly: Number(dto.priceYearly ?? 0),
      features: (dto.features ?? {}) as any,
      active: dto.active ?? true,
    });
    return plan.toObject();
  }

  async updatePlan(id: string, dto: AdminUpdatePlanDto) {
    const plan = await this.planModel.findById(id);
    if (!plan) throw new NotFoundException('Plan not found');
    const yearlyEnabled = dto.yearlyEnabled ?? plan.yearlyEnabled;
    const priceYearly = dto.priceYearly ?? plan.priceYearly;
    if (yearlyEnabled && Number(priceYearly ?? 0) <= 0) {
      throw new BadRequestException('Yearly price must be greater than zero');
    }
    if (dto.name !== undefined) plan.name = dto.name.trim();
    if (dto.storageGb !== undefined) plan.storageGb = Number(dto.storageGb);
    if (dto.monthlyEmails !== undefined) plan.monthlyEmails = Number(dto.monthlyEmails);
    if (dto.priceMonthly !== undefined) plan.priceMonthly = Number(dto.priceMonthly);
    if (dto.yearlyEnabled !== undefined) plan.yearlyEnabled = Boolean(dto.yearlyEnabled);
    if (dto.priceYearly !== undefined) plan.priceYearly = Number(dto.priceYearly);
    if (dto.features !== undefined) plan.features = dto.features as any;
    if (dto.active !== undefined) plan.active = dto.active;
    await plan.save();
    return plan.toObject();
  }

  async deletePlan(id: string) {
    const plan = await this.planModel.findByIdAndDelete(id).lean();
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async getStripeSettings() {
    const settings = await this.getRawStripeSettings();
    return this.hideStripeSecrets(settings);
  }

  async getFreePlanSettings() {
    return this.freePlanSettings.get();
  }

  async updateFreePlanSettings(dto: FreePlanSettingDto) {
    const settings = await this.freePlanSettings.update(dto);
    await this.syncFreeUsers(settings);
    return settings;
  }

  private async syncFreeUsers(settings: { storageGb: number; monthlyEmails: number }) {
    await this.userModel.updateMany(
      { planName: 'Free' },
      {
        $set: {
          storageLimitGb: settings.storageGb,
          monthlyEmailLimit: settings.monthlyEmails,
          'planFeatures.marketingEmails': settings.monthlyEmails > 0,
        },
      },
    );
  }

  async updateStripeSettings(dto: AdminStripeSettingDto) {
    const existing = await this.getRawStripeSettings();
    const settings = await this.stripeSettingModel.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          enabled: Boolean(dto.enabled),
          publishableKey: dto.publishableKey ?? existing.publishableKey ?? '',
          secretKey: dto.secretKey && dto.secretKey !== '********' ? dto.secretKey : existing.secretKey ?? '',
          webhookSecret: dto.webhookSecret && dto.webhookSecret !== '********' ? dto.webhookSecret : existing.webhookSecret ?? '',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return this.hideStripeSecrets(settings.toObject());
  }

  async createPlanCheckout(userId: string, planId: string, requestedInterval?: string, successUrl?: string, cancelUrl?: string) {
    const [plan, settings, user] = await Promise.all([
      this.planModel.findOne({ _id: planId, active: true }).lean(),
      this.getRawStripeSettings(),
      this.userModel.findById(userId).lean(),
    ]);
    if (!plan) throw new NotFoundException('Plan not found');
    const billingInterval: 'month' | 'year' = requestedInterval === 'year' ? 'year' : 'month';
    if (billingInterval === 'year' && (!plan.yearlyEnabled || Number(plan.priceYearly ?? 0) <= 0)) {
      throw new BadRequestException('Yearly billing is not available for this plan');
    }
    const amount = billingInterval === 'year' ? Number(plan.priceYearly ?? 0) : Number(plan.priceMonthly ?? 0);
    if (amount <= 0) {
      const activatedPlan = await this.assignPlanToUser(userId, plan._id.toString(), 'free', undefined, billingInterval);
      return { activated: true, checkoutUrl: null, sessionId: null, plan: activatedPlan };
    }
    if (!settings.enabled || !settings.secretKey) throw new BadRequestException('Stripe is not configured');

    const stripe = new Stripe(settings.secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: plan.name,
            description: `${plan.storageGb} GB storage, ${plan.monthlyEmails} emails/month, ${billingInterval === 'year' ? '1 year' : '1 month'} access`,
          },
        },
      }],
      customer_email: user?.email || undefined,
      success_url: successUrl || `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard/client-gallery/storage?plan=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard/client-gallery/storage?plan=cancel`,
      metadata: {
        type: 'plan',
        userId,
        planId: plan._id.toString(),
        billingInterval,
      },
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  async confirmPlanCheckout(sessionId: string, userId: string) {
    const settings = await this.getRawStripeSettings();
    if (!settings.secretKey) throw new BadRequestException('Stripe secret key is missing');
    const stripe = new Stripe(settings.secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.type !== 'plan' || session.metadata.userId !== userId || !session.metadata.planId) {
      throw new BadRequestException('Invalid checkout session');
    }
    if (session.payment_status !== 'paid') {
      throw new BadRequestException('Checkout is not paid');
    }
    const billingInterval = session.metadata.billingInterval === 'year' ? 'year' : 'month';
    const plan = await this.assignPlanToUser(userId, session.metadata.planId, 'checkout', session.id, billingInterval);
    return plan;
  }

  async handleStripeWebhook(signature: string | undefined, rawBody: Buffer) {
    const settings = await this.getRawStripeSettings();
    if (!settings.secretKey) throw new BadRequestException('Stripe secret key is missing');
    const stripe = new Stripe(settings.secretKey);
    let event: any;

    if (settings.webhookSecret) {
      if (!signature) throw new BadRequestException('Stripe signature is missing');
      event = stripe.webhooks.constructEvent(rawBody, signature, settings.webhookSecret);
    } else {
      event = JSON.parse(rawBody.toString()) as any;
    }

    if (event.type === 'checkout.session.completed') {
      const webhookSession = event.data.object as any;
      const session = webhookSession?.id
        ? await stripe.checkout.sessions.retrieve(webhookSession.id)
        : webhookSession;
      if (session.metadata?.type === 'plan' && session.payment_status === 'paid' && session.metadata.userId && session.metadata.planId) {
        const billingInterval = session.metadata.billingInterval === 'year' ? 'year' : 'month';
        await this.assignPlanToUser(session.metadata.userId, session.metadata.planId, 'checkout', session.id, billingInterval);
      }
    }

    return { received: true };
  }

  async assignPlanToUser(userId: string, planId: string, source: 'admin' | 'checkout' | 'free' = 'admin', stripeSessionId?: string, billingInterval: 'month' | 'year' = 'month') {
    const plan = await this.planModel.findById(planId).lean();
    if (!plan) throw new NotFoundException('Plan not found');
    if (stripeSessionId && await this.planPurchaseModel.exists({ stripeSessionId })) return plan;
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + (billingInterval === 'year' ? 365 : 30));
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          planId: plan._id.toString(),
          planName: plan.name,
          storageLimitGb: plan.storageGb,
          monthlyEmailLimit: plan.monthlyEmails,
          planFeatures: plan.features ?? {},
          monthlyEmailsUsed: 0,
          monthlyUsageKey: this.currentMonthKey(),
          planActivatedAt: new Date(),
          planBillingInterval: billingInterval,
          ...(source === 'checkout' ? { planExpiresAt: expiresAt } : {}),
        },
        ...(source !== 'checkout' ? { $unset: { planExpiresAt: '' } } : {}),
      },
    );
    const amount = billingInterval === 'year' ? Number(plan.priceYearly ?? 0) : Number(plan.priceMonthly ?? 0);
    const purchase = { userId, planId: plan._id.toString(), planName: plan.name, amount, billingInterval, source, stripeSessionId, status: source === 'checkout' ? 'paid' : 'active' } as const;
    if (stripeSessionId) await this.planPurchaseModel.updateOne({ stripeSessionId }, { $setOnInsert: purchase }, { upsert: true });
    else await this.planPurchaseModel.create(purchase);
    return plan;
  }

  async purchaseHistory(userId: string) {
    return this.planPurchaseModel.find({ userId }).sort('-createdAt').lean();
  }

  async clearUserPlan(userId: string) {
    const freePlan = await this.freePlanSettings.get();
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          planName: 'Free',
          storageLimitGb: freePlan.storageGb,
          monthlyEmailLimit: freePlan.monthlyEmails,
          planFeatures: { marketingEmails: freePlan.monthlyEmails > 0 },
          monthlyEmailsUsed: 0,
          monthlyUsageKey: this.currentMonthKey(),
        },
        $unset: {
          planId: '',
          planActivatedAt: '',
          planBillingInterval: '',
          planExpiresAt: '',
        },
      },
    );
  }

  async userCapabilities(userId: string) {
    const user = await this.userModel.findById(userId).select('planName planFeatures storageLimitGb monthlyEmailLimit').lean();
    return {
      planName: user?.planName ?? 'Free',
      storageLimitGb: user?.storageLimitGb ?? 0,
      monthlyEmailLimit: user?.monthlyEmailLimit ?? 0,
      features: user?.planFeatures ?? {},
    };
  }

  async addEmailUsage(userId: string, count: number) {
    const safeCount = Math.max(1, Number(count ?? 1));
    const monthKey = this.currentMonthKey();
    const user = await this.userModel.findById(userId).select('monthlyEmailLimit monthlyEmailsUsed monthlyUsageKey planFeatures planExpiresAt').lean();
    if (user?.planExpiresAt && user.planExpiresAt <= new Date()) {
      await this.clearUserPlan(userId);
      throw new BadRequestException('Plan expired. Purchase a plan to continue sending emails.');
    }
    if (!user?.planFeatures?.marketingEmails) {
      throw new BadRequestException('Marketing email is not included in your current plan.');
    }
    const limit = Number(user?.monthlyEmailLimit ?? 0);
    const used = user?.monthlyUsageKey === monthKey ? Number(user?.monthlyEmailsUsed ?? 0) : 0;
    if (limit > 0 && used + safeCount > limit) {
      throw new BadRequestException('Monthly email limit exceeded. Upgrade plan to send more emails.');
    }
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { monthlyUsageKey: monthKey, monthlyEmailsUsed: used + safeCount } },
    );
    return { monthlyEmailsUsed: used + safeCount, monthlyEmailLimit: limit };
  }

  async deleteCollection(id: string) {
    const collection = await this.collectionModel.findByIdAndDelete(id).lean();
    if (!collection) throw new NotFoundException('Collection not found');
    const images = await this.imageModel.find({ collectionId: id }).select('sizeBytes').lean();
    const reclaimedBytes = images.reduce((sum, img) => sum + Math.max(0, Number(img.sizeBytes ?? 0)), 0);
    await this.imageModel.deleteMany({ collectionId: id });
    await this.faceSearchService.deleteCollectionFaces(id);
    if (reclaimedBytes > 0 && collection.userId) {
      const user = await this.userModel.findById(collection.userId).select('storageUsedBytes').lean();
      const nextUsedBytes = Math.max(0, Number(user?.storageUsedBytes ?? 0) - reclaimedBytes);
      await this.userModel.updateOne({ _id: collection.userId }, { $set: { storageUsedBytes: nextUsedBytes } });
    }
    return collection;
  }

  async reindexCollectionFaces(id: string) {
    const collection = await this.collectionModel.findById(id).select('_id').lean();
    if (!collection) throw new NotFoundException('Collection not found');
    return this.faceSearchService.reindexCollectionFaces(id);
  }

  private async ensureUnique(phoneNumber: string, excludeId?: string) {
    const existing = await this.userModel.findOne({ phoneNumber }).lean();
    if (existing && existing._id.toString() !== excludeId) {
      throw new BadRequestException('User already exists');
    }
  }

  private async getRawStripeSettings() {
    const settings = await this.stripeSettingModel.findOneAndUpdate(
      { key: 'global' },
      { $setOnInsert: { key: 'global', enabled: false, publishableKey: '', secretKey: '', webhookSecret: '' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return settings.toObject();
  }

  private hideStripeSecrets(settings: any) {
    return {
      ...settings,
      secretKey: settings.secretKey ? '********' : '',
      webhookSecret: settings.webhookSecret ? '********' : '',
      hasSecretKey: Boolean(settings.secretKey),
      hasWebhookSecret: Boolean(settings.webhookSecret),
    };
  }

  private currentMonthKey() {
    return new Date().toISOString().slice(0, 7);
  }
}

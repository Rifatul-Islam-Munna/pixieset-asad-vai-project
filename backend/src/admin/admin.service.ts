import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
    @InjectModel(AdminStripeSetting.name)
    private readonly stripeSettingModel: Model<AdminStripeSettingDocument>,
  ) {}

  async dashboard() {
    const [users, collections, images] = await Promise.all([
      this.userModel.countDocuments(),
      this.collectionModel.countDocuments(),
      this.imageModel.countDocuments(),
    ]);
    return { users, collections, images };
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
    const user = await this.userModel.create({
      ...dto,
      email: dto.email?.trim().toLowerCase(),
      role: dto.role ?? UserType.USER,
      password: await bcrypt.hash(dto.password, 10),
      isOtpVerified: true,
      otpNumber: '000000',
    });
    const { password, ...safeUser } = user.toObject();
    return safeUser;
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
    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  async deleteUser(id: string, currentAdminId: string) {
    if (id === currentAdminId) throw new BadRequestException('Admin cannot delete own account');
    const user = await this.userModel.findByIdAndDelete(id).select('-password').lean();
    if (!user) throw new NotFoundException('User not found');
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

  async createPlan(dto: AdminCreatePlanDto) {
    const plan = await this.planModel.create({
      name: dto.name.trim(),
      storageGb: Number(dto.storageGb ?? 0),
      monthlyEmails: Number(dto.monthlyEmails ?? 0),
      priceMonthly: Number(dto.priceMonthly ?? 0),
      features: (dto.features ?? {}) as any,
      active: dto.active ?? true,
    });
    return plan.toObject();
  }

  async updatePlan(id: string, dto: AdminUpdatePlanDto) {
    const plan = await this.planModel.findById(id);
    if (!plan) throw new NotFoundException('Plan not found');
    if (dto.name !== undefined) plan.name = dto.name.trim();
    if (dto.storageGb !== undefined) plan.storageGb = Number(dto.storageGb);
    if (dto.monthlyEmails !== undefined) plan.monthlyEmails = Number(dto.monthlyEmails);
    if (dto.priceMonthly !== undefined) plan.priceMonthly = Number(dto.priceMonthly);
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

  async createPlanCheckout(userId: string, planId: string, successUrl?: string, cancelUrl?: string) {
    const [plan, settings, user] = await Promise.all([
      this.planModel.findOne({ _id: planId, active: true }).lean(),
      this.getRawStripeSettings(),
      this.userModel.findById(userId).lean(),
    ]);
    if (!plan) throw new NotFoundException('Plan not found');
    if (!settings.enabled || !settings.secretKey) throw new BadRequestException('Stripe is not configured');
    if (Number(plan.priceMonthly ?? 0) <= 0) throw new BadRequestException('Plan price is required for Stripe checkout');

    const stripe = new Stripe(settings.secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(plan.priceMonthly ?? 0) * 100),
          recurring: { interval: 'month' },
          product_data: {
            name: plan.name,
            description: `${plan.storageGb} GB storage/month, ${plan.monthlyEmails} emails/month`,
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
    const plan = await this.assignPlanToUser(userId, session.metadata.planId);
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
        await this.assignPlanToUser(session.metadata.userId, session.metadata.planId);
      }
    }

    return { received: true };
  }

  async assignPlanToUser(userId: string, planId: string) {
    const plan = await this.planModel.findById(planId).lean();
    if (!plan) throw new NotFoundException('Plan not found');
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
        },
      },
    );
    return plan;
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
    const user = await this.userModel.findById(userId).select('monthlyEmailLimit monthlyEmailsUsed monthlyUsageKey').lean();
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
    await this.imageModel.deleteMany({ collectionId: id });
    return collection;
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

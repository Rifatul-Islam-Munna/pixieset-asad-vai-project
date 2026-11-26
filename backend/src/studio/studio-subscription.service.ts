import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { Plan, PlanDocument } from '../admin/entities/plan.entity';
import { FreePlanSettingService } from '../admin/free-plan-setting.service';
import { StudioRecord, StudioRecordDocument } from './studio-record.entity';
import { BookingService, BookingServiceDocument } from '../bookings/entities/booking-service.entity';

export const STUDIO_LIMIT_KEYS = ['contacts','products','questionnaires','quotes','projects','emails'] as const;
export type StudioLimitKey = typeof STUDIO_LIMIT_KEYS[number];

@Injectable()
export class StudioSubscriptionService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Plan.name) private readonly plans: Model<PlanDocument>,
    @InjectModel(StudioRecord.name) private readonly records: Model<StudioRecordDocument>,
    @InjectModel(BookingService.name) private readonly products: Model<BookingServiceDocument>,
    private readonly free: FreePlanSettingService,
  ) {}

  private month() { return new Date().toISOString().slice(0,7); }

  // Resolve the default dashboard using current subscription data, without counting records.
  async dashboardDestination(userId: string) {
    const user = await this.users.findById(userId)
      .select('role studioPlanId studioPlanExpiresAt studioPlanBillingInterval').lean();
    if (!user) throw new NotFoundException('Account not found');
    if (user.role === 'admin') return '/admin';
    const gallery = '/dashboard/client-gallery';
    if (!user.studioPlanId) return gallery;
    const expiresAt = user.studioPlanExpiresAt;
    if (expiresAt && !(new Date(expiresAt).getTime() > Date.now())) return gallery;
    const plan = await this.plans.findOne({_id:user.studioPlanId,productType:'studio-manager'})
      .select('priceMonthly priceYearly yearlyEnabled').lean();
    if (!plan) return gallery;
    // Paid checkout has an expiry; also honor an admin-assigned paid plan with no expiry.
    const price = user.studioPlanBillingInterval === 'year' && plan.yearlyEnabled
      ? Number(plan.priceYearly ?? 0) : Number(plan.priceMonthly ?? 0);
    return expiresAt || price > 0 ? '/dashboard/studio-management/home' : gallery;
  }

  private async resolve(userId: string) {
    const user = await this.users.findById(userId).lean();
    if (!user) throw new NotFoundException('Account not found');
    const expired = Boolean(user.studioPlanExpiresAt && new Date(user.studioPlanExpiresAt).getTime() <= Date.now());
    const plan = user.studioPlanId && !expired
      ? await this.plans.findOne({_id:user.studioPlanId,productType:'studio-manager'}).lean() : null;
    const source = plan ?? await this.free.get();
    return { user, plan, expired, limits: {
      contacts: Number(source.studioContactLimit ?? 0),
      products: Number(source.studioProductLimit ?? 0),
      questionnaires: Number(source.studioQuestionnaireLimit ?? 0),
      quotes: Number(source.studioQuoteLimit ?? 0),
      projects: Number(source.studioProjectLimit ?? 0),
      emails: Number(source.studioMonthlyEmails ?? 0),
    }};
  }

  private count(userId: string, key: Exclude<StudioLimitKey,'emails'>) {
    if (key === 'products') return this.products.countDocuments({userId});
    const filter = key === 'contacts' || key === 'projects'
      ? {userId,kind:key}
      : {userId,kind:'documents' as const,type:key === 'quotes' ? 'quote' : 'questionnaire'};
    return this.records.countDocuments(filter);
  }

  async overview(userId: string) {
    const {user,plan,expired,limits} = await this.resolve(userId);
    const [contacts,products,questionnaires,quotes,projects] = await Promise.all([
      this.count(userId,'contacts'), this.count(userId,'products'), this.count(userId,'questionnaires'),
      this.count(userId,'quotes'), this.count(userId,'projects'),
    ]);
    const emails = user.studioMonthlyUsageKey === this.month() ? Number(user.studioMonthlyEmailsUsed ?? 0) : 0;
    return {planId:plan?._id.toString() ?? null,planName:plan?.name ?? 'Free',
      expiresAt:plan ? user.studioPlanExpiresAt ?? null : null,
      previousExpiresAt:expired ? user.studioPlanExpiresAt : null,
      billingInterval:plan ? user.studioPlanBillingInterval : null, activatedAt:plan ? user.studioPlanActivatedAt ?? null : null,
      status:plan ? 'active' : expired ? 'expired' : 'free', limits,usage:{contacts,products,questionnaires,quotes,projects,emails},
      gallery:{planName:user.planName || 'Free',expiresAt:user.planExpiresAt ?? null,planId:user.planId ?? null}};
  }

  // Serialize count-and-create across backend workers. The lease is recovered if a worker dies.
  async withRecordLock<T>(userId:string, work:()=>Promise<T>):Promise<T> {
    const token=randomUUID();
    const deadline=Date.now()+5000;
    do {
      const now=new Date();
      const acquired=await this.users.updateOne({_id:userId,$or:[{studioQuotaLock:{$exists:false}},{studioQuotaLock:null},{'studioQuotaLock.expiresAt':{$lte:now}}]},{$set:{studioQuotaLock:{token,expiresAt:new Date(Date.now()+120000)}}});
      if(acquired.modifiedCount){
        try {return await work();}
        finally {await this.users.updateOne({_id:userId,'studioQuotaLock.token':token},{$unset:{studioQuotaLock:''}}).catch(()=>undefined);}
      }
      await new Promise(resolve=>setTimeout(resolve,50));
    } while(Date.now()<deadline);
    throw new ServiceUnavailableException('Studio Manager is busy. Please try again.');
  }

  async withRecordQuota<T>(userId:string,key:Exclude<StudioLimitKey,'emails'>,work:()=>Promise<T>):Promise<T> {
    return this.withRecordLock(userId,async()=>{await this.assertRecord(userId,key);return work();});
  }

  async assertRecord(userId: string, key: Exclude<StudioLimitKey,'emails'>) {
    const {limits} = await this.resolve(userId);
    const limit = limits[key];
    if (limit > 0 && await this.count(userId,key) >= limit)
      throw new BadRequestException('Studio Manager '+key+' limit reached. Upgrade your Studio Manager plan.');
  }

  async reserveEmail(userId:string) {
    const {limits} = await this.resolve(userId);
    if (limits.emails <= 0) throw new BadRequestException('Your Studio Manager plan does not include email sending.');
    const key = this.month();
    // Reset only an older period. The conditional increment prevents parallel sends from exceeding the quota.
    await this.users.updateOne({_id:userId,studioMonthlyUsageKey:{$ne:key}},
      {$set:{studioMonthlyUsageKey:key,studioMonthlyEmailsUsed:0}});
    const result = await this.users.updateOne({_id:userId,studioMonthlyUsageKey:key,studioMonthlyEmailsUsed:{$lt:limits.emails}},
      {$inc:{studioMonthlyEmailsUsed:1}});
    if (!result.modifiedCount) throw new BadRequestException('Studio Manager monthly email limit reached. Upgrade your plan.');
    return key;
  }

  async releaseEmail(userId:string,key:string) {
    await this.users.updateOne({_id:userId,studioMonthlyUsageKey:key,studioMonthlyEmailsUsed:{$gt:0}},{$inc:{studioMonthlyEmailsUsed:-1}});
  }
}

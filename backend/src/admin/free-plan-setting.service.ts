import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FreePlanSettingDto } from './dto/free-plan-setting.dto';
import { FreePlanSetting, FreePlanSettingDocument } from './entities/free-plan-setting.entity';

export const DEFAULT_FREE_PLAN = { storageGb: 3, subdomainLimit: 1, monthlyEmails: 1000, studioProjectLimit: 10, studioContactLimit: 10, studioProductLimit: 3, studioQuestionnaireLimit: 3, studioQuoteLimit: 3, studioMonthlyEmails: 25 } as const;

@Injectable()
export class FreePlanSettingService {
  constructor(
    @InjectModel(FreePlanSetting.name)
    private readonly settingModel: Model<FreePlanSettingDocument>,
  ) {}

  async get() {
    const setting = await this.settingModel.findOneAndUpdate(
      { key: 'global' },
      { $setOnInsert: { key: 'global', ...DEFAULT_FREE_PLAN } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    return {
      storageGb: Number(setting?.storageGb ?? DEFAULT_FREE_PLAN.storageGb),
      subdomainLimit: Number(setting?.subdomainLimit ?? DEFAULT_FREE_PLAN.subdomainLimit),
      monthlyEmails: Number(setting?.monthlyEmails ?? DEFAULT_FREE_PLAN.monthlyEmails),
      studioProjectLimit: Number(setting?.studioProjectLimit ?? DEFAULT_FREE_PLAN.studioProjectLimit),
      studioContactLimit: Number(setting?.studioContactLimit ?? DEFAULT_FREE_PLAN.studioContactLimit),
      studioProductLimit: Number(setting?.studioProductLimit ?? DEFAULT_FREE_PLAN.studioProductLimit),
      studioQuestionnaireLimit: Number(setting?.studioQuestionnaireLimit ?? DEFAULT_FREE_PLAN.studioQuestionnaireLimit),
      studioQuoteLimit: Number(setting?.studioQuoteLimit ?? DEFAULT_FREE_PLAN.studioQuoteLimit),
      studioMonthlyEmails: Number(setting?.studioMonthlyEmails ?? DEFAULT_FREE_PLAN.studioMonthlyEmails),
    };
  }

  async update(dto: FreePlanSettingDto) {
    const setting = await this.settingModel.findOneAndUpdate(
      { key: 'global' },
      { $set: { storageGb: Number(dto.storageGb), subdomainLimit: Number(dto.subdomainLimit), monthlyEmails: Number(dto.monthlyEmails), ...(dto.studioProjectLimit === undefined ? {} : {studioProjectLimit: dto.studioProjectLimit}), ...(dto.studioContactLimit === undefined ? {} : {studioContactLimit: dto.studioContactLimit}), ...(dto.studioProductLimit === undefined ? {} : {studioProductLimit: dto.studioProductLimit}), ...(dto.studioQuestionnaireLimit === undefined ? {} : {studioQuestionnaireLimit: dto.studioQuestionnaireLimit}), ...(dto.studioQuoteLimit === undefined ? {} : {studioQuoteLimit: dto.studioQuoteLimit}), ...(dto.studioMonthlyEmails === undefined ? {} : {studioMonthlyEmails: dto.studioMonthlyEmails}) } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    return {
      storageGb: Number(setting?.storageGb ?? 0),
      subdomainLimit: Number(setting?.subdomainLimit ?? 1),
      monthlyEmails: Number(setting?.monthlyEmails ?? 0),
      studioProjectLimit: Number(setting?.studioProjectLimit ?? DEFAULT_FREE_PLAN.studioProjectLimit),
      studioContactLimit: Number(setting?.studioContactLimit ?? DEFAULT_FREE_PLAN.studioContactLimit),
      studioProductLimit: Number(setting?.studioProductLimit ?? DEFAULT_FREE_PLAN.studioProductLimit),
      studioQuestionnaireLimit: Number(setting?.studioQuestionnaireLimit ?? DEFAULT_FREE_PLAN.studioQuestionnaireLimit),
      studioQuoteLimit: Number(setting?.studioQuoteLimit ?? DEFAULT_FREE_PLAN.studioQuoteLimit),
      studioMonthlyEmails: Number(setting?.studioMonthlyEmails ?? DEFAULT_FREE_PLAN.studioMonthlyEmails),
    };
  }
}

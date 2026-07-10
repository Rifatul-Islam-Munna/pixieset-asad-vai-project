import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FreePlanSettingDto } from './dto/free-plan-setting.dto';
import { FreePlanSetting, FreePlanSettingDocument } from './entities/free-plan-setting.entity';

export const DEFAULT_FREE_PLAN = { storageGb: 3, monthlyEmails: 1000 } as const;

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
      monthlyEmails: Number(setting?.monthlyEmails ?? DEFAULT_FREE_PLAN.monthlyEmails),
    };
  }

  async update(dto: FreePlanSettingDto) {
    const setting = await this.settingModel.findOneAndUpdate(
      { key: 'global' },
      { $set: { storageGb: Number(dto.storageGb), monthlyEmails: Number(dto.monthlyEmails) } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    return {
      storageGb: Number(setting?.storageGb ?? 0),
      monthlyEmails: Number(setting?.monthlyEmails ?? 0),
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpsertDashboardSettingDto } from './dto/upsert-dashboard-setting.dto';
import {
  DashboardSetting,
  DashboardSettingDocument,
  DashboardSettingType,
} from './entities/dashboard-setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(DashboardSetting.name)
    private readonly settingModel: Model<DashboardSettingDocument>,
  ) {}

  findAll(userId: string, type: DashboardSettingType, collectionId?: string) {
    const query = collectionId ? { userId, type, collectionId } : { userId, type };

    return this.settingModel
      .find(query)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
  }

  async upsert(userId: string, type: DashboardSettingType, dto: UpsertDashboardSettingDto) {
    const setting = await this.settingModel
      .findOneAndUpdate(
        { userId, type, localId: dto.localId },
        {
          $set: {
            name: dto.name,
            collectionId: dto.collectionId,
            data: dto.data,
          },
        },
        { new: true, upsert: true },
      )
      .lean()
      .exec();

    if (!setting) {
      throw new BadRequestException('Setting not saved');
    }

    return setting;
  }

  async remove(userId: string, type: DashboardSettingType, localId: string) {
    const deleted = await this.settingModel
      .findOneAndDelete({ userId, type, localId })
      .lean()
      .exec();

    if (!deleted) {
      throw new NotFoundException('Setting not found');
    }

    return deleted;
  }
}

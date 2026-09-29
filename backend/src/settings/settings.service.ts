import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { UpsertDashboardSettingDto } from './dto/upsert-dashboard-setting.dto';
import {
  DashboardSetting,
  DashboardSettingDocument,
  DashboardSettingType,
} from './entities/dashboard-setting.entity';

const IMAGE_CACHE_VERSION = 1;

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(DashboardSetting.name)
    private readonly settingModel: Model<DashboardSettingDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
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
    if (type === DashboardSettingType.BRANDING) {
      const user = await this.userModel.findById(userId).select('planFeatures').lean();
      if (!user?.planFeatures?.advancedBranding) {
        throw new BadRequestException('Current plan does not allow Advanced Branding.');
      }
    }
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
        { returnDocument: 'after', upsert: true },
      )
      .lean()
      .exec();

    if (!setting) {
      throw new BadRequestException('Setting not saved');
    }

    if (
      type === DashboardSettingType.WATERMARK ||
      type === DashboardSettingType.PRESET
    ) {
      await this.invalidateAffectedImageCaches(userId, type, dto.localId).catch(
        () => undefined,
      );
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

    if (
      type === DashboardSettingType.WATERMARK ||
      type === DashboardSettingType.PRESET
    ) {
      await this.invalidateAffectedImageCaches(userId, type, localId).catch(
        () => undefined,
      );
    }

    return deleted;
  }

  private async invalidateAffectedImageCaches(
    userId: string,
    type: DashboardSettingType,
    localId: string,
  ) {
    const collectionIds = new Set<string>();
    if (type === DashboardSettingType.PRESET) {
      const rows = await this.collectionModel
        .find({ userId, presetId: localId })
        .select('_id')
        .lean();
      rows.forEach((row) => collectionIds.add(String(row._id)));
    } else {
      const [directCollections, directImageCollectionIds, presets] =
        await Promise.all([
          this.collectionModel
            .find({
              userId,
              $or: [
                { watermarkId: localId },
                { 'sets.watermarkId': localId },
              ],
            })
            .select('_id')
            .lean(),
          this.imageModel.distinct('collectionId', {
            userId,
            'metadata.watermarkId': localId,
          }),
          this.settingModel
            .find({
              userId,
              type: DashboardSettingType.PRESET,
              $or: [
                { 'data.general.defaultWatermark': localId },
                { 'data.presetGeneral.defaultWatermark': localId },
              ],
            })
            .select('localId')
            .lean(),
        ]);
      directCollections.forEach((row) => collectionIds.add(String(row._id)));
      directImageCollectionIds.forEach((id) => collectionIds.add(String(id)));
      const presetIds = presets.map((preset) => String(preset.localId));
      if (presetIds.length) {
        const presetCollections = await this.collectionModel
          .find({ userId, presetId: { $in: presetIds } })
          .select('_id')
          .lean();
        presetCollections.forEach((row) => collectionIds.add(String(row._id)));
      }
    }

    const ids = [...collectionIds];
    if (!ids.length) return;
    const now = new Date();
    await Promise.all([
      this.collectionModel.updateMany(
        { _id: { $in: ids }, userId },
        {
          $set: {
            imageCacheStatus: 'warming',
            imageCacheVersion: IMAGE_CACHE_VERSION,
          },
          $unset: { imageCacheReadyAt: 1 },
        },
      ),
      this.imageModel.updateMany(
        { collectionId: { $in: ids }, userId, mediaType: { $ne: 'video' } },
        {
          $set: {
            'metadata.imageCache.status': 'stale',
            'metadata.imageCache.version': IMAGE_CACHE_VERSION,
            'metadata.imageCache.nextAttemptAt': now,
          },
        },
      ),
    ]);
  }
}

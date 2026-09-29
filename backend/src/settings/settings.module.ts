import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DashboardSetting,
  DashboardSettingSchema,
} from './entities/dashboard-setting.entity';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { ImagorService } from 'src/lib/imagor.service';
import { Collection, CollectionSchema } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageSchema } from 'src/collections/entities/collection-image.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DashboardSetting.name, schema: DashboardSettingSchema },
      { name: User.name, schema: UserSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, ImagorService],
})
export class SettingsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Collection, CollectionSchema } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageSchema } from 'src/collections/entities/collection-image.entity';
import { DashboardSetting, DashboardSettingSchema } from 'src/settings/entities/dashboard-setting.entity';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { Homepage, HomepageSchema } from './entities/homepage.entity';
import { HomepageController, PublicHomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Homepage.name, schema: HomepageSchema },
      { name: User.name, schema: UserSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: DashboardSetting.name, schema: DashboardSettingSchema },
    ]),
  ],
  controllers: [HomepageController, PublicHomepageController],
  providers: [HomepageService],
  exports: [HomepageService],
})
export class HomepageModule {}

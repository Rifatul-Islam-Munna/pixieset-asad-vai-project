import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinioService } from 'src/lib/minio.service';
import {
  DashboardSetting,
  DashboardSettingSchema,
} from 'src/settings/entities/dashboard-setting.entity';
import {
  CollectionsController,
  PublicCollectionsController,
} from './collections.controller';
import { CollectionsService } from './collections.service';
import { CollectionDownloadDeliveryService } from './collection-download-delivery.service';
import { Collection, CollectionSchema } from './entities/collection.entity';
import { CollectionDownloadDelivery, CollectionDownloadDeliverySchema } from './entities/collection-download-delivery.entity';
import {
  CollectionImage,
  CollectionImageSchema,
} from './entities/collection-image.entity';
import {
  CollectionFavorite,
  CollectionFavoriteSchema,
} from './entities/collection-favorite.entity';
import {
  CollectionImageFavorite,
  CollectionImageFavoriteSchema,
} from './entities/collection-image-favorite.entity';
import {
  CollectionDownloadActivity,
  CollectionDownloadActivitySchema,
} from './entities/collection-download-activity.entity';
import {
  CollectionEmailRegistration,
  CollectionEmailRegistrationSchema,
} from './entities/collection-email-registration.entity';
import {
  CollectionPrivatePhoto,
  CollectionPrivatePhotoSchema,
} from './entities/collection-private-photo.entity';
import {
  CollectionView,
  CollectionViewSchema,
} from './entities/collection-view.entity';
import {
  StoreOrder,
  StoreOrderSchema,
} from 'src/store/entities/store-order.entity';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { FaceSearchModule } from 'src/face-search/face-search.module';
import { ImageMetadataAiModule } from 'src/image-metadata-ai/image-metadata-ai.module';
import { MarketingScheduleModule } from 'src/marketing-schedule/marketing-schedule.module';
import {
  MobileGalleryImage,
  MobileGalleryImageSchema,
} from 'src/mobile-gallery/entities/mobile-gallery-image.entity';
import {
  Homepage,
  HomepageSchema,
} from 'src/homepage/entities/homepage.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionDownloadDelivery.name, schema: CollectionDownloadDeliverySchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: CollectionFavorite.name, schema: CollectionFavoriteSchema },
      {
        name: CollectionImageFavorite.name,
        schema: CollectionImageFavoriteSchema,
      },
      {
        name: CollectionDownloadActivity.name,
        schema: CollectionDownloadActivitySchema,
      },
      {
        name: CollectionEmailRegistration.name,
        schema: CollectionEmailRegistrationSchema,
      },
      {
        name: CollectionPrivatePhoto.name,
        schema: CollectionPrivatePhotoSchema,
      },
      { name: CollectionView.name, schema: CollectionViewSchema },
      { name: StoreOrder.name, schema: StoreOrderSchema },
      { name: DashboardSetting.name, schema: DashboardSettingSchema },
      { name: User.name, schema: UserSchema },
      { name: MobileGalleryImage.name, schema: MobileGalleryImageSchema },
      { name: Homepage.name, schema: HomepageSchema },
    ]),
    FaceSearchModule,
    ImageMetadataAiModule,
    MarketingScheduleModule,
  ],
  controllers: [CollectionsController, PublicCollectionsController],
  providers: [CollectionsService, CollectionDownloadDeliveryService, MinioService],
})
export class CollectionsModule {}

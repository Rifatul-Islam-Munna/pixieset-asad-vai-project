import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinioService } from 'src/lib/minio.service';
import {
  DashboardSetting,
  DashboardSettingSchema,
} from 'src/settings/entities/dashboard-setting.entity';
import { CollectionsController, PublicCollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { Collection, CollectionSchema } from './entities/collection.entity';
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
import { User, UserSchema } from 'src/user/entities/user.entity';
import { FaceSearchModule } from 'src/face-search/face-search.module';
import { MobileGalleryImage, MobileGalleryImageSchema } from 'src/mobile-gallery/entities/mobile-gallery-image.entity';
import { Homepage, HomepageSchema } from 'src/homepage/entities/homepage.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: CollectionFavorite.name, schema: CollectionFavoriteSchema },
      { name: CollectionImageFavorite.name, schema: CollectionImageFavoriteSchema },
      { name: CollectionDownloadActivity.name, schema: CollectionDownloadActivitySchema },
      { name: CollectionEmailRegistration.name, schema: CollectionEmailRegistrationSchema },
      { name: CollectionPrivatePhoto.name, schema: CollectionPrivatePhotoSchema },
      { name: DashboardSetting.name, schema: DashboardSettingSchema },
      { name: User.name, schema: UserSchema },
      { name: MobileGalleryImage.name, schema: MobileGalleryImageSchema },
      { name: Homepage.name, schema: HomepageSchema },
    ]),
    FaceSearchModule,
  ],
  controllers: [CollectionsController, PublicCollectionsController],
  providers: [CollectionsService, MinioService],
})
export class CollectionsModule {}

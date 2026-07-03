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
import { User, UserSchema } from 'src/user/entities/user.entity';
import { FaceSearchModule } from 'src/face-search/face-search.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: CollectionFavorite.name, schema: CollectionFavoriteSchema },
      { name: DashboardSetting.name, schema: DashboardSettingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    FaceSearchModule,
  ],
  controllers: [CollectionsController, PublicCollectionsController],
  providers: [CollectionsService, MinioService],
})
export class CollectionsModule {}

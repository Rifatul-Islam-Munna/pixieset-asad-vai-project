import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinioService } from 'src/lib/minio.service';
import {
  DashboardSetting,
  DashboardSettingSchema,
} from 'src/settings/entities/dashboard-setting.entity';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { Collection, CollectionSchema } from './entities/collection.entity';
import {
  CollectionImage,
  CollectionImageSchema,
} from './entities/collection-image.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: DashboardSetting.name, schema: DashboardSettingSchema },
    ]),
  ],
  controllers: [CollectionsController],
  providers: [CollectionsService, MinioService],
})
export class CollectionsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinioService } from 'src/lib/minio.service';
import { User, UserSchema } from 'src/user/entities/user.entity';
import {
  CollectionImage,
  CollectionImageSchema,
} from 'src/collections/entities/collection-image.entity';
import {
  ImageMetadataJob,
  ImageMetadataJobSchema,
} from './entities/image-metadata-job.entity';
import {
  ImageMetadataWorkerLock,
  ImageMetadataWorkerLockSchema,
} from './entities/image-metadata-worker-lock.entity';
import { ImageMetadataAiService } from './image-metadata-ai.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: User.name, schema: UserSchema },
      { name: ImageMetadataJob.name, schema: ImageMetadataJobSchema },
      {
        name: ImageMetadataWorkerLock.name,
        schema: ImageMetadataWorkerLockSchema,
      },
    ]),
  ],
  providers: [ImageMetadataAiService, MinioService],
  exports: [ImageMetadataAiService],
})
export class ImageMetadataAiModule {}

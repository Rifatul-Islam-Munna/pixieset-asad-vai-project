import { Module } from '@nestjs/common';
import { ImageUploadService } from './image-upload.service';
import { ImageUploadController } from './image-upload.controller';
import { MinioService } from 'src/lib/minio.service';

@Module({
  controllers: [ImageUploadController],
  providers: [ImageUploadService, MinioService],
})
export class ImageUploadModule {}

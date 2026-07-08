import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinioService } from 'src/lib/minio.service';
import { MobileGalleryApp, MobileGalleryAppSchema } from './entities/mobile-gallery-app.entity';
import { MobileGalleryImage, MobileGalleryImageSchema } from './entities/mobile-gallery-image.entity';
import { MobileGallerySetting, MobileGallerySettingSchema } from './entities/mobile-gallery-setting.entity';
import { MobileGalleryController, PublicMobileGalleryController } from './mobile-gallery.controller';
import { MobileGalleryService } from './mobile-gallery.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MobileGalleryApp.name, schema: MobileGalleryAppSchema },
      { name: MobileGalleryImage.name, schema: MobileGalleryImageSchema },
      { name: MobileGallerySetting.name, schema: MobileGallerySettingSchema },
    ]),
  ],
  controllers: [MobileGalleryController, PublicMobileGalleryController],
  providers: [MobileGalleryService, MinioService],
})
export class MobileGalleryModule {}

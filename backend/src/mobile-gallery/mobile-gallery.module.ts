import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollectionImage, CollectionImageSchema } from 'src/collections/entities/collection-image.entity';
import { MinioService } from 'src/lib/minio.service';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { MobileGalleryApp, MobileGalleryAppSchema } from './entities/mobile-gallery-app.entity';
import { MobileGalleryImage, MobileGalleryImageSchema } from './entities/mobile-gallery-image.entity';
import { MobileGallerySetting, MobileGallerySettingSchema } from './entities/mobile-gallery-setting.entity';
import { MobileGalleryController, PublicMobileGalleryController } from './mobile-gallery.controller';
import { MobileGalleryMailService } from './mobile-gallery-mail.service';
import { MobileGalleryService } from './mobile-gallery.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MobileGalleryApp.name, schema: MobileGalleryAppSchema },
      { name: MobileGalleryImage.name, schema: MobileGalleryImageSchema },
      { name: MobileGallerySetting.name, schema: MobileGallerySettingSchema },
      { name: User.name, schema: UserSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
    ]),
  ],
  controllers: [MobileGalleryController, PublicMobileGalleryController],
  providers: [MobileGalleryService, MobileGalleryMailService, MinioService],
})
export class MobileGalleryModule {}

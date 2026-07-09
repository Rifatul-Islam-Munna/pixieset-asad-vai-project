import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollectionImage, CollectionImageSchema } from 'src/collections/entities/collection-image.entity';
import { MobileGalleryImage, MobileGalleryImageSchema } from 'src/mobile-gallery/entities/mobile-gallery-image.entity';
import { User, UserSchema } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: MobileGalleryImage.name, schema: MobileGalleryImageSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}

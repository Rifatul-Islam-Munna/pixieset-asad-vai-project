import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Collection, CollectionSchema } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageSchema } from 'src/collections/entities/collection-image.entity';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { FaceIdentity, FaceIdentitySchema } from './entities/face-identity.entity';
import { FacePerson, FacePersonSchema } from './entities/face-person.entity';
import { FaceSearchController, FaceIdentityController } from './face-search.controller';
import { FaceSearchService } from './face-search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: FaceIdentity.name, schema: FaceIdentitySchema },
      { name: FacePerson.name, schema: FacePersonSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FaceSearchController, FaceIdentityController],
  providers: [FaceSearchService],
  exports: [FaceSearchService],
})
export class FaceSearchModule {}

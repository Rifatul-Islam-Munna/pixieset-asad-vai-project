import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Collection, CollectionSchema } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageSchema } from 'src/collections/entities/collection-image.entity';
import { FaceSearchController } from './face-search.controller';
import { FaceSearchService } from './face-search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
    ]),
  ],
  controllers: [FaceSearchController],
  providers: [FaceSearchService],
  exports: [FaceSearchService],
})
export class FaceSearchModule {}

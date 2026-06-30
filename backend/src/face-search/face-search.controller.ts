import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FaceSearchService } from './face-search.service';

@Controller('public/face-search')
export class FaceSearchController {
  constructor(private readonly faceSearchService: FaceSearchService) {}

  @Get(':collectionId/faces')
  async faces(@Param('collectionId') collectionId: string) {
    const data = await this.faceSearchService.listCollectionFaces(collectionId);
    return { data };
  }

  @Get(':collectionId/faces/:faceId')
  async face(@Param('collectionId') collectionId: string, @Param('faceId') faceId: string) {
    const data = await this.faceSearchService.searchCollectionByFaceId(collectionId, faceId);
    return { data };
  }

  @Post(':collectionId')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 8 },
  }))
  async search(
    @Param('collectionId') collectionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.faceSearchService.searchCollection(collectionId, file);
    return { data };
  }
}

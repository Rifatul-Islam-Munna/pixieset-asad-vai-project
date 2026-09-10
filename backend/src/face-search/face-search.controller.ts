import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
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
    limits: { fileSize: 1024 * 1024 * 40 },
  }))
  async search(
    @Param('collectionId') collectionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.faceSearchService.searchCollection(collectionId, file);
    return { data };
  }
}

@Controller('face-identities')
@UseGuards(AuthGuard)
export class FaceIdentityController {
  constructor(private readonly faceSearchService: FaceSearchService) {}

  @Get()
  async list(@Req() req: ExpressRequest) {
    return { data: await this.faceSearchService.listUserFaceIdentities(req.user.id) };
  }

  @Patch(':identityKey')
  async rename(
    @Param('identityKey') identityKey: string,
    @Body() body: { name?: string },
    @Req() req: ExpressRequest,
  ) {
    const data = await this.faceSearchService.renameUserFaceIdentity(
      req.user.id,
      identityKey,
      body?.name,
    );
    return { message: 'Face identity updated', data };
  }
}

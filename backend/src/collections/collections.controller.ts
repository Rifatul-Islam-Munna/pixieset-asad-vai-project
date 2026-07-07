import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { cwd } from 'process';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

const uploadDir = join(cwd(), 'uploads');

const uploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 30 },
};

@Controller('public/collections')
export class PublicCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get(':identifier')
  async findPublic(@Param('identifier') identifier: string) {
    const data = await this.collectionsService.findPublic(identifier);
    return { data };
  }

  @Post(':identifier/download-activity')
  async recordDownloadActivity(
    @Param('identifier') identifier: string,
    @Body() body: { email?: string; items?: Array<{ imageId?: string; imageName?: string; imageUrl?: string }>; downloadType?: 'single' | 'all' },
  ) {
    const data = await this.collectionsService.recordPublicDownloadActivity(identifier, body);
    return { message: 'Download activity saved', data };
  }
}

@Controller('collections')
@UseGuards(AuthGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  async create(@Body() dto: CreateCollectionDto, @Req() req: ExpressRequest) {
    const data = await this.collectionsService.create(req.user.id, dto);
    return { message: 'Collection saved', data };
  }

  @Get()
  async findAll(@Req() req: ExpressRequest) {
    const data = await this.collectionsService.findAll(req.user.id);
    return { data };
  }

  @Get('images')
  async findAllImages(@Req() req: ExpressRequest) {
    const data = await this.collectionsService.findAllImages(req.user.id);
    return { data };
  }

  @Get('favorites')
  async favorites(@Req() req: ExpressRequest) {
    const data = await this.collectionsService.listFavoriteCollections(req.user.id);
    return { data };
  }

  @Get('image-favorites')
  async imageFavorites(@Req() req: ExpressRequest) {
    const data = await this.collectionsService.listFavoriteImages(req.user.id);
    return { data };
  }

  @Get(':id/activity')
  async collectionActivity(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.collectionsService.getCollectionActivity(req.user.id, id);
    return { data };
  }

  @Delete(':id/activity/favorites/:favoriteUserId')
  async deleteFavoriteInfo(
    @Param('id') id: string,
    @Param('favoriteUserId') favoriteUserId: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.deleteFavoriteInfo(req.user.id, id, favoriteUserId);
    return { message: 'Favorite info deleted', data };
  }

  @Delete(':id/activity/favorites/:favoriteUserId/images/:imageId')
  async deleteFavoriteImageInfo(
    @Param('id') id: string,
    @Param('favoriteUserId') favoriteUserId: string,
    @Param('imageId') imageId: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.deleteFavoriteImageInfo(req.user.id, id, favoriteUserId, imageId);
    return { message: 'Favorite image deleted', data };
  }

  @Post(':id/activity/favorites/:favoriteUserId/copy-to-set')
  async copyFavoriteListToSet(
    @Param('id') id: string,
    @Param('favoriteUserId') favoriteUserId: string,
    @Body('name') name: string | undefined,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.copyFavoriteListToSet(req.user.id, id, favoriteUserId, name);
    return { message: 'Favorite list copied to set', data };
  }

  @Post(':id/activity/favorites/:favoriteUserId/copy-to-collection')
  async copyFavoriteListToCollection(
    @Param('id') id: string,
    @Param('favoriteUserId') favoriteUserId: string,
    @Body('name') name: string | undefined,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.copyFavoriteListToCollection(req.user.id, id, favoriteUserId, name);
    return { message: 'Favorite list copied to collection', data };
  }

  @Post('favorites/:identifier')
  async favorite(@Param('identifier') identifier: string, @Req() req: ExpressRequest) {
    const data = await this.collectionsService.toggleFavoriteCollection(req.user.id, identifier);
    return { message: data.favorited ? 'Collection favorited' : 'Collection unfavorited', data };
  }

  @Post('image-favorites/:imageId')
  async favoriteImage(@Param('imageId') imageId: string, @Req() req: ExpressRequest) {
    const data = await this.collectionsService.toggleFavoriteImage(req.user.id, imageId);
    return { message: data.favorited ? 'Photo favorited' : 'Photo unfavorited', data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.collectionsService.findOne(req.user.id, id);
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.update(req.user.id, id, dto);
    return { message: 'Collection updated', data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.collectionsService.remove(req.user.id, id);
    return { message: 'Collection deleted', data };
  }

  @Post(':id/sets')
  async addSet(
    @Param('id') id: string,
    @Body('name') name: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.addSet(req.user.id, id, name);
    return { message: 'Set saved', data };
  }

  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 100, uploadOptions))
  async uploadImages(
    @Param('id') id: string,
    @Body('setId') setId: string | undefined,
    @Body('watermarkId') watermarkId: string | undefined,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.uploadImages(req.user.id, id, files, setId, watermarkId);
    return { message: 'Images uploaded', data };
  }

  @Patch(':id/images/reorder')
  async reorderImages(
    @Param('id') id: string,
    @Body('imageIds') imageIds: string[],
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.reorderImages(req.user.id, id, imageIds);
    return { message: 'Images reordered', data };
  }

  @Delete(':id/images/:imageId')
  async removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.removeImage(req.user.id, id, imageId);
    return { message: 'Image deleted', data };
  }

  @Patch(':id/images/:imageId/star')
  async starImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body('starred') starred: boolean,
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.starImage(req.user.id, id, imageId, starred);
    return { message: 'Image updated', data };
  }
}

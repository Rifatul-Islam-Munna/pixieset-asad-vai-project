import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { cwd } from 'process';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { MobileGalleryMailService } from './mobile-gallery-mail.service';
import { MobileGalleryService } from './mobile-gallery.service';

const uploadDir = join(cwd(), 'uploads');
const uploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 30 },
};

@Controller('public/mobile-gallery/apps')
export class PublicMobileGalleryController {
  constructor(private readonly service: MobileGalleryService) {}

  @Get(':identifier')
  async findPublic(@Param('identifier') identifier: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return { data: await this.service.findPublic(identifier, limit, offset) };
  }

  @Get(':identifier/images')
  async findPublicImages(@Param('identifier') identifier: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return { data: await this.service.findPublicImages(identifier, limit, offset) };
  }
}

@Controller('mobile-gallery')
@UseGuards(AuthGuard)
export class MobileGalleryController {
  constructor(
    private readonly service: MobileGalleryService,
    private readonly mailService: MobileGalleryMailService,
  ) {}

  @Get('apps')
  async apps(@Req() req: ExpressRequest) {
    return { data: await this.service.findAll(req.user.id) };
  }

  @Post('apps')
  async create(@Body() body: Record<string, any>, @Req() req: ExpressRequest) {
    return { message: 'Mobile gallery app created', data: await this.service.create(req.user.id, body) };
  }

  @Get('apps/:id')
  async findOne(@Param('id') id: string, @Req() req: ExpressRequest, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return { data: await this.service.findOne(req.user.id, id, limit, offset) };
  }

  @Get('apps/:id/images')
  async findImages(@Param('id') id: string, @Req() req: ExpressRequest, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return { data: await this.service.findImages(req.user.id, id, limit, offset) };
  }

  @Patch('apps/:id')
  async update(@Param('id') id: string, @Body() body: Record<string, any>, @Req() req: ExpressRequest) {
    return { message: 'Mobile gallery app updated', data: await this.service.update(req.user.id, id, body) };
  }

  @Delete('apps/:id')
  async remove(@Param('id') id: string, @Req() req: ExpressRequest) {
    return { message: 'Mobile gallery app deleted', data: await this.service.remove(req.user.id, id) };
  }

  @Post('apps/:id/share-email')
  async shareEmail(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Req() req: ExpressRequest,
  ) {
    return {
      message: 'Mobile gallery invitation processed',
      data: await this.mailService.sendInvite(req.user.id, id, body),
    };
  }

  @Post('apps/:id/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 100, uploadOptions))
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: ExpressRequest,
  ) {
    return { message: 'Photos uploaded', data: await this.service.uploadImages(req.user.id, id, files) };
  }

  @Patch('apps/:id/images/reorder')
  async reorder(
    @Param('id') id: string,
    @Body('imageIds') imageIds: string[],
    @Req() req: ExpressRequest,
  ) {
    return { message: 'Photos reordered', data: await this.service.reorderImages(req.user.id, id, imageIds) };
  }

  @Delete('apps/:id/images/:imageId')
  async removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() req: ExpressRequest,
  ) {
    return { message: 'Photo deleted', data: await this.service.removeImage(req.user.id, id, imageId) };
  }

  @Post('assets')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async uploadAsset(@UploadedFile() file: Express.Multer.File, @Req() req: ExpressRequest) {
    return { message: 'Asset uploaded', data: await this.service.uploadAsset(req.user.id, file) };
  }

  @Get('settings/profile')
  async getSettings(@Req() req: ExpressRequest) {
    return { data: await this.service.getSettings(req.user.id) };
  }

  @Patch('settings/profile')
  async updateSettings(@Body() body: Record<string, any>, @Req() req: ExpressRequest) {
    return { message: 'Settings updated', data: await this.service.updateSettings(req.user.id, body) };
  }
}

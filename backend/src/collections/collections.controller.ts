import {
  Body,
  Controller,
  Get,
  Param,
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

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.collectionsService.findOne(req.user.id, id);
    return { data };
  }

  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 100, uploadOptions))
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: ExpressRequest,
  ) {
    const data = await this.collectionsService.uploadImages(req.user.id, id, files);
    return { message: 'Images uploaded', data };
  }
}

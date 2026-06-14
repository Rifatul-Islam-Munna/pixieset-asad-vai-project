import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateImageUploadDto } from './dto/create-image-upload.dto';
import { UpdateImageUploadDto } from './dto/update-image-upload.dto';
import { unlink } from 'fs/promises';
import { MinioService } from 'src/lib/minio.service';

@Injectable()
export class ImageUploadService {
  constructor(private readonly minioService: MinioService) {}

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    const url = await this.minioService.uploadFile(file);
    await this.safeUnlink(file.path);
    return { message: 'File uploaded successfully', data: url };
  }

  async uploadImages(files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new HttpException('Files are required', HttpStatus.BAD_REQUEST);
    }

    const data = await Promise.all(
      files.map(async (file) => {
        const url = await this.minioService.uploadFile(file);
        await this.safeUnlink(file.path);
        return url;
      }),
    );

    return { message: 'Files uploaded successfully', data };
  }

  create(createImageUploadDto: CreateImageUploadDto) {
    return 'This action adds a new imageUpload';
  }

  findAll() {
    return `This action returns all imageUpload`;
  }

  findOne(id: number) {
    return `This action returns a #${id} imageUpload`;
  }

  update(id: number, updateImageUploadDto: UpdateImageUploadDto) {
    return `This action updates a #${id} imageUpload`;
  }

  remove(id: number) {
    return `This action removes a #${id} imageUpload`;
  }

  private async safeUnlink(path: string) {
    try {
      await unlink(path);
    } catch {
      return;
    }
  }
}

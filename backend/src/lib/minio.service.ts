import {
  CreateBucketCommand,
  DeleteObjectCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import sharp from 'sharp';

const DEFAULT_BUCKET_NAME = 'gallerista.app';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private s3?: S3Client;
  private bucketName = DEFAULT_BUCKET_NAME;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const minioUrl = this.configService.get<string>('MINIO_URL')?.trim();
    const accessKeyId = this.configService.get<string>('MINIO_ACCESS_KEY')?.trim();
    const secretAccessKey = this.configService.get<string>('MINIO_SECRET_KEY')?.trim();
    const region = this.configService.get<string>('MINIO_REGION')?.trim() || 'us-east-1';
    this.bucketName = this.configService.get<string>('MINIO_BUCKET')?.trim() || DEFAULT_BUCKET_NAME;

    if (!minioUrl || !accessKeyId || !secretAccessKey) {
      this.logger.error('MinIO env missing; uploads will fail until MINIO_URL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY are set');
      return;
    }

    this.s3 = new S3Client({
      region,
      endpoint: minioUrl,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: false,
    });

    await this.createBucketIfNotExists(this.bucketName);
    await this.makeBucketPublic(this.bucketName);
    await this.enablePublicAssetCors(this.bucketName);
  }

  async createBucketIfNotExists(bucketName: string) {
    if (!this.s3) return;
    try {
      await this.s3.send(new CreateBucketCommand({ Bucket: bucketName }));
      this.logger.log(`Bucket '${bucketName}' created or already exists.`);
    } catch (error: any) {
      if (error?.name === 'BucketAlreadyOwnedByYou' || error?.name === 'BucketAlreadyExists') {
        this.logger.log(`Bucket '${bucketName}' already exists.`);
      } else {
        this.logger.warn(`MinIO bucket creation failed: ${error?.message || error}`);
      }
    }
  }

  async makeBucketPublic(bucketName: string) {
    if (!this.s3) return;
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };

    try {
      await this.s3.send(new PutBucketPolicyCommand({ Bucket: bucketName, Policy: JSON.stringify(policy) }));
    } catch (error: any) {
      this.logger.warn(`MinIO bucket policy failed: ${error?.message || error}`);
    }
  }

  async enablePublicAssetCors(bucketName: string) {
    if (!this.s3) return;
    try {
      await this.s3.send(
        new PutBucketCorsCommand({
          Bucket: bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'HEAD'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
                MaxAgeSeconds: 86400,
              },
            ],
          },
        }),
      );
    } catch (error: any) {
      this.logger.warn(`MinIO CORS setup failed: ${error?.message || error}`);
    }
  }

  async uploadFile(file: Express.Multer.File) {
    try {
      if (!this.s3) throw new HttpException('MinIO is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
      const optimized = await this.optimizedUploadBody(file);
      const key = optimized.key;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: optimized.body,
          ContentType: optimized.contentType,
        }),
      );
      file.filename = key;
      file.mimetype = optimized.contentType;
      file.size = optimized.size;
      return `${this.configService.get('MINIO_URL')}/${this.bucketName}/${key}`;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`);
      throw new HttpException('Failed to upload file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async optimizedUploadBody(file: Express.Multer.File) {
    if (!String(file.mimetype || '').toLowerCase().startsWith('image/')) {
      return {
        key: file.filename,
        body: createReadStream(file.path),
        contentType: file.mimetype,
        size: file.size ?? 0,
      };
    }

    const maxBytes = this.configNumber('IMAGE_UPLOAD_MAX_BYTES', 900 * 1024, 100 * 1024, 5 * 1024 * 1024);
    const maxWidth = this.configNumber('IMAGE_UPLOAD_MAX_WIDTH', 1920, 640, 4096);
    const maxHeight = this.configNumber('IMAGE_UPLOAD_MAX_HEIGHT', 1920, 640, 4096);
    const base = file.filename.replace(/\.[^.]+$/, '');

    let best: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    for (const scale of [1, 0.85, 0.7, 0.55]) {
      for (const quality of [64, 58, 52, 46, 40, 34]) {
        const output = await sharp(file.path)
          .rotate()
          .resize({
            width: Math.round(maxWidth * scale),
            height: Math.round(maxHeight * scale),
            fit: 'inside',
            withoutEnlargement: true,
          })
          .avif({ quality, effort: 4 })
          .toBuffer();

        if (!best.length || output.length < best.length) best = output;
        if (output.length <= maxBytes) {
          best = output;
          break;
        }
      }
      if (best.length <= maxBytes) break;
    }

    return {
      key: `${base}.avif`,
      body: best,
      contentType: 'image/avif',
      size: best.length,
    };
  }

  private configNumber(key: string, fallback: number, min: number, max: number) {
    const raw = this.configService.get<string>(key);
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  async deleteService(fileReference: string) {
    const fileName = this.objectKey(fileReference);
    if (!fileName) throw new HttpException('Invalid file name', HttpStatus.BAD_REQUEST);
    try {
      if (!this.s3) return true;
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: fileName }));
      return true;
    } catch (error) {
      this.logger.error(`Error deleting file: ${error instanceof Error ? error.message : String(error)}`);
      throw new HttpException('Can not Delete File', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private objectKey(fileReference: string) {
    if (!fileReference || typeof fileReference !== 'string') return '';
    const trimmed = fileReference.trim();
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      const bucketIndex = parts.indexOf(this.bucketName);
      const keyParts = bucketIndex >= 0 ? parts.slice(bucketIndex + 1) : parts.slice(-1);
      return decodeURIComponent(keyParts.join('/'));
    } catch {
      const withoutQuery = trimmed.split(/[?#]/)[0].replace(/^\/+/, '');
      const bucketPrefix = `${this.bucketName}/`;
      const key = withoutQuery.startsWith(bucketPrefix) ? withoutQuery.slice(bucketPrefix.length) : withoutQuery;
      return decodeURIComponent(key);
    }
  }
}

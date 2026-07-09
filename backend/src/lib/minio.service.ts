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
    const forcePathStyle = this.configBoolean('MINIO_FORCE_PATH_STYLE', false);
    this.bucketName = this.configService.get<string>('MINIO_BUCKET')?.trim() || DEFAULT_BUCKET_NAME;

    if (!minioUrl || !accessKeyId || !secretAccessKey) {
      this.logger.error('MinIO env missing; uploads will fail until MINIO_URL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY are set');
      return;
    }

    this.s3 = new S3Client({
      region,
      endpoint: minioUrl,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
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
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: file.filename,
          Body: createReadStream(file.path),
          ContentType: file.mimetype,
        }),
      );
      return `${this.configService.get('MINIO_URL')}/${this.bucketName}/${file.filename}`;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`);
      throw new HttpException('Failed to upload file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private configBoolean(key: string, fallback: boolean) {
    const raw = this.configService.get<string>(key);
    if (raw === undefined || raw === null || raw.trim() === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
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

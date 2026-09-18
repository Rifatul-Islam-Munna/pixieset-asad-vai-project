import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream } from 'fs';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { cwd } from 'process';
import { Readable } from 'stream';
import { finished, pipeline } from 'stream/promises';

const DEFAULT_BUCKET_NAME = 'gallerista.app';
const IMAGE_MAX_BYTES = 150 * 1024 * 1024;
const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;

function parseS3ApiUrl(value: string, fallbackBucket: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    const pathParts = url.pathname.split('/').filter(Boolean);
    const bucket = decodeURIComponent(pathParts[0] || fallbackBucket).trim();
    if (!bucket) return undefined;
    const endpoint = url.origin;
    return {
      endpoint,
      bucket,
      apiBaseUrl: `${endpoint}/${encodeURIComponent(bucket)}`,
      isCloudflareR2: url.hostname.endsWith('.r2.cloudflarestorage.com'),
    };
  } catch {
    return undefined;
  }
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private s3?: S3Client;
  private bucketName = DEFAULT_BUCKET_NAME;
  private privateBucketName = `${DEFAULT_BUCKET_NAME}-private`;
  private endpointUrl = '';
  private publicBaseUrl = '';
  private isCloudflareR2 = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const rawS3Url =
      this.configService.get<string>('STORAGE_S3_URL')?.trim() ||
      this.configService.get<string>('R2_S3_API_URL')?.trim() ||
      this.configService.get<string>('MINIO_URL')?.trim() ||
      '';
    const configuredBucket =
      this.configService.get<string>('STORAGE_BUCKET')?.trim() ||
      this.configService.get<string>('MINIO_BUCKET')?.trim() ||
      DEFAULT_BUCKET_NAME;
    const connection = parseS3ApiUrl(rawS3Url, configuredBucket);
    const accessKeyId =
      this.configService.get<string>('STORAGE_ACCESS_KEY')?.trim() ||
      this.configService.get<string>('R2_ACCESS_KEY_ID')?.trim() ||
      this.configService.get<string>('MINIO_ACCESS_KEY')?.trim();
    const secretAccessKey =
      this.configService.get<string>('STORAGE_SECRET_KEY')?.trim() ||
      this.configService.get<string>('R2_SECRET_ACCESS_KEY')?.trim() ||
      this.configService.get<string>('MINIO_SECRET_KEY')?.trim();
    const region =
      this.configService.get<string>('STORAGE_REGION')?.trim() ||
      (connection?.isCloudflareR2
        ? 'auto'
        : this.configService.get<string>('MINIO_REGION')?.trim() || 'us-east-1');
    const hasStoragePathStyle =
      this.configService.get<string>('STORAGE_FORCE_PATH_STYLE') !== undefined;
    const forcePathStyle = hasStoragePathStyle
      ? this.configBoolean('STORAGE_FORCE_PATH_STYLE', connection?.isCloudflareR2 ?? false)
      : connection?.isCloudflareR2
        ? true
        : this.configBoolean('MINIO_FORCE_PATH_STYLE', false);
    const explicitPublicUrl =
      this.configService.get<string>('STORAGE_PUBLIC_URL')?.trim() ||
      this.configService.get<string>('R2_PUBLIC_URL')?.trim() ||
      '';

    if (!connection || !accessKeyId || !secretAccessKey) {
      this.logger.error(
        'Object storage is not configured. Set STORAGE_S3_URL, STORAGE_ACCESS_KEY, and STORAGE_SECRET_KEY.',
      );
      return;
    }

    this.endpointUrl = connection.endpoint;
    this.bucketName = connection.bucket;
    this.privateBucketName =
      this.configService.get<string>('STORAGE_PRIVATE_BUCKET')?.trim() ||
      `${this.bucketName}-private`;
    this.isCloudflareR2 = connection.isCloudflareR2;
    this.publicBaseUrl = explicitPublicUrl.replace(/\/+$/, '') || connection.apiBaseUrl;

    this.s3 = new S3Client({
      region,
      endpoint: this.endpointUrl,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });

    await this.createBucketIfNotExists(this.privateBucketName);
    await this.enablePrivateUploadCors(this.privateBucketName);

    if (this.isCloudflareR2) {
      this.logger.log(`Cloudflare R2 storage configured for bucket '${this.bucketName}'.`);
      if (!explicitPublicUrl) {
        this.logger.warn(
          'R2 S3 API URLs are private for asset delivery. Enable an r2.dev/custom domain and set STORAGE_PUBLIC_URL for public galleries.',
        );
      }
      await this.enablePublicAssetCors(this.bucketName);
      return;
    }

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
                AllowedMethods: ['GET', 'HEAD', 'PUT'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
                MaxAgeSeconds: 86400,
              },
            ],
          },
        }),
      );
    } catch (error: any) {
      this.logger.warn(`Object storage CORS setup failed: ${error?.message || error}`);
    }
  }

  async enablePrivateUploadCors(bucketName: string) {
    if (!this.s3) return;
    try {
      await this.s3.send(
        new PutBucketCorsCommand({
          Bucket: bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['PUT'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 86400,
              },
            ],
          },
        }),
      );
    } catch (error: any) {
      this.logger.warn(
        `Private object-storage CORS setup failed: ${error?.message || error}`,
      );
    }
  }

  async uploadFile(file: Express.Multer.File) {
    const body = createReadStream(file.path);
    try {
      if (!this.s3) throw new HttpException('Object storage is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: file.filename,
          Body: body,
          ContentType: file.mimetype,
        }),
      );
      await finished(body);
      return this.publicUrl(file.filename);
    } catch (error) {
      this.logger.error(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`);
      throw new HttpException('Failed to upload file', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      body.destroy();
    }
  }

  async uploadPrivateFile(file: Express.Multer.File, objectKey: string) {
    const body = createReadStream(file.path);
    try {
      if (!this.s3)
        throw new HttpException(
          'Object storage is not configured',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.privateBucketName,
          Key: objectKey,
          Body: body,
          ContentType: file.mimetype,
        }),
      );
      await finished(body);
      return {
        objectKey,
        size: Math.max(0, Number(file.size ?? 0)),
        contentType: file.mimetype,
      };
    } catch (error) {
      this.logger.error(
        `Error uploading private file: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        'Failed to upload private file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      body.destroy();
    }
  }

  async createDirectUpload(
    userId: string,
    input: { name: string; type: string; size: number },
    options: { privateImage?: boolean } = {},
  ) {
    if (!this.s3) throw new HttpException('Object storage is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    const size = Math.max(0, Number(input.size));
    const type = String(input.type || '').toLowerCase();
    const isVideo = type.startsWith('video/');
    const isImage = type.startsWith('image/');
    if (!isImage && !isVideo) throw new HttpException('Only image and video files are allowed', HttpStatus.BAD_REQUEST);
    if (!size || size > (isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES)) {
      throw new HttpException(isVideo ? 'Each video must be 2 GB or smaller' : 'Each image must be 150 MB or smaller', HttpStatus.BAD_REQUEST);
    }
    const extension = extname(String(input.name || '')).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    const privateImage = isImage && options.privateImage === true;
    const objectKey = `${privateImage ? 'private-direct' : 'direct'}/${userId}/${randomUUID()}${extension}`;
    const uploadUrl = await getSignedUrl(this.s3, new PutObjectCommand({
      Bucket: privateImage ? this.privateBucketName : this.bucketName,
      Key: objectKey,
      ContentType: type,
    }), { expiresIn: 15 * 60 });
    return { objectKey, uploadUrl, expiresInSeconds: 15 * 60 };
  }

  async verifyDirectUpload(userId: string, input: { objectKey: string; name: string; type: string; size: number }) {
    if (!this.s3) throw new HttpException('Object storage is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    const objectKey = this.assertDirectObjectKey(userId, input.objectKey);
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.directBucket(objectKey), Key: objectKey }),
    );
    const actualSize = Math.max(0, Number(head.ContentLength ?? 0));
    const expectedSize = Math.max(0, Number(input.size ?? 0));
    const contentType = String(head.ContentType || input.type || '').toLowerCase();
    const isVideo = contentType.startsWith('video/');
    const isImage = contentType.startsWith('image/');
    if (!isImage && !isVideo) throw new HttpException('Only image and video files are allowed', HttpStatus.BAD_REQUEST);
    if (!actualSize || actualSize > (isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES) || actualSize !== expectedSize) {
      throw new HttpException('Uploaded file size does not match', HttpStatus.BAD_REQUEST);
    }
    return {
      objectKey,
      size: actualSize,
      type: contentType,
      url: objectKey.startsWith('private-direct/') ? '' : this.publicUrl(objectKey),
      name: String(input.name || (isVideo ? 'video' : 'image')),
    };
  }

  async downloadDirectUpload(userId: string, input: { objectKey: string; name: string; type: string; size: number }) {
    const verified = await this.verifyDirectUpload(userId, input);
    const response = await this.s3!.send(
      new GetObjectCommand({
        Bucket: this.directBucket(verified.objectKey),
        Key: verified.objectKey,
      }),
    );
    if (!response.Body) throw new HttpException('Uploaded file is unavailable', HttpStatus.BAD_REQUEST);
    const path = join(cwd(), 'uploads', `direct-${randomUUID()}${extname(verified.name)}`);
    await pipeline(response.Body as Readable, createWriteStream(path));
    return {
      fieldname: 'files',
      originalname: verified.name,
      encoding: '7bit',
      mimetype: verified.type,
      destination: join(cwd(), 'uploads'),
      filename: `${randomUUID()}${extname(verified.name)}`,
      path,
      size: verified.size,
    } as Express.Multer.File;
  }

  async deleteDirectUpload(userId: string, objectKey: string) {
    const key = this.assertDirectObjectKey(userId, objectKey);
    if (key.startsWith('private-direct/')) return this.deletePrivateFile(key);
    return this.deleteService(key);
  }

  private assertDirectObjectKey(userId: string, objectKey: string) {
    const value = String(objectKey || '').trim();
    const validPrefix =
      value.startsWith(`direct/${userId}/`) ||
      value.startsWith(`private-direct/${userId}/`);
    if (!validPrefix || value.includes('..')) {
      throw new HttpException('Invalid direct upload key', HttpStatus.BAD_REQUEST);
    }
    return value;
  }

  private directBucket(objectKey: string) {
    return objectKey.startsWith('private-direct/')
      ? this.privateBucketName
      : this.bucketName;
  }

  private publicUrl(objectKey: string) {
    const encodedKey = objectKey
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    return `${this.publicBaseUrl}/${encodedKey}`;
  }

  private configBoolean(key: string, fallback: boolean) {
    const raw = this.configService.get<string>(key);
    if (raw === undefined || raw === null || raw.trim() === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
  }

  async openReadStream(fileReference: string) {
    const fileName = this.objectKey(fileReference);
    if (!fileName) throw new HttpException('Invalid file name', HttpStatus.BAD_REQUEST);
    if (!this.s3) throw new HttpException('Object storage is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucketName, Key: fileName }));
    if (!response.Body) throw new HttpException('File is unavailable', HttpStatus.NOT_FOUND);
    return {
      body: response.Body as Readable,
      contentLength: Math.max(0, Number(response.ContentLength ?? 0)),
      contentType: String(response.ContentType || 'application/octet-stream'),
    };
  }

  async openPrivateReadStream(objectKey: string) {
    const key = String(objectKey || '').trim().replace(/^\/+/, '');
    if (!key || key.includes('..'))
      throw new HttpException('Invalid private file key', HttpStatus.BAD_REQUEST);
    if (!this.s3)
      throw new HttpException(
        'Object storage is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.privateBucketName, Key: key }),
    );
    if (!response.Body)
      throw new HttpException('File is unavailable', HttpStatus.NOT_FOUND);
    return {
      body: response.Body as Readable,
      contentLength: Math.max(0, Number(response.ContentLength ?? 0)),
      contentType: String(response.ContentType || 'application/octet-stream'),
    };
  }

  async deletePrivateFile(objectKey: string) {
    const key = String(objectKey || '').trim().replace(/^\/+/, '');
    if (!key || key.includes('..'))
      throw new HttpException('Invalid private file key', HttpStatus.BAD_REQUEST);
    try {
      if (!this.s3) return true;
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.privateBucketName, Key: key }),
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting private file: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        'Can not Delete File',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
      const publicPrefix = this.publicBaseUrl ? `${this.publicBaseUrl}/` : '';
      if (publicPrefix && trimmed.startsWith(publicPrefix)) {
        return decodeURIComponent(trimmed.slice(publicPrefix.length).split(/[?#]/)[0]);
      }
      const parts = url.pathname.split('/').filter(Boolean);
      const bucketIndex = parts.indexOf(this.bucketName);
      const keyParts = bucketIndex >= 0 ? parts.slice(bucketIndex + 1) : parts;
      return decodeURIComponent(keyParts.join('/'));
    } catch {
      const withoutQuery = trimmed.split(/[?#]/)[0].replace(/^\/+/, '');
      const bucketPrefix = `${this.bucketName}/`;
      const key = withoutQuery.startsWith(bucketPrefix) ? withoutQuery.slice(bucketPrefix.length) : withoutQuery;
      return decodeURIComponent(key);
    }
  }
}

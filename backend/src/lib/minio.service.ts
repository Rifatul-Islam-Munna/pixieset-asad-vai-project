import { CreateBucketCommand, DeleteObjectCommand, PutBucketPolicyCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createReadStream, } from "fs";

const BUCKET_NAME = 'niqha-public-bukcet';

@Injectable()
export class MinioService implements OnModuleInit { 
    private logger = new Logger(MinioService.name)
    constructor( private configService:ConfigService) {}
      private s3?: S3Client;
 /*  private readonly s3 = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.MINIO_URL,

    credentials: {
      accessKeyId:"admin", 
      secretAccessKey:  "admin1234",
    },
    forcePathStyle: true,
  }); */

  async onModuleInit() {
    const minioUrl = this.configService.get<string>('MINIO_URL')?.trim() as string;
    const accessKeyId = this.configService.get<string>('MINIO_ACCESS_KEY')?.trim() as string;
    const secretAccessKey = this.configService.get<string>('MINIO_SECRET_KEY')?.trim() as string;

    if (!minioUrl || !accessKeyId || !secretAccessKey) {
      this.logger.error('MinIO env missing; uploads will fail until MINIO_URL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY are set');
      return;
    }
  
       this.s3 = new S3Client({
      region: 'us-east-1',
      endpoint: minioUrl,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
    await this.createBucketIfNotExists(BUCKET_NAME);
    await this.makeBucketPublic(BUCKET_NAME);
  }

  async createBucketIfNotExists(bucketName: string) {
    if (!this.s3) return;
    try {
      await this.s3.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket '${bucketName}' created or already exists.`);
    } catch (err) {
      if (err?.name === 'BucketAlreadyOwnedByYou' || err?.name === 'BucketAlreadyExists') {
        console.log(`Bucket '${bucketName}' already exists.`);
      } else {
        console.error('Error creating bucket:', err);
        this.logger.warn('MinIO bucket creation failed; continuing with local fallback');
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

    const command = new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(policy),
    });

    try {
      await this.s3.send(command);
      console.log(`Bucket '${bucketName}' is now public.`);
    } catch (err) {
      console.error('Error setting bucket policy:', err);
      this.logger.warn('MinIO bucket policy failed; continuing with local fallback');
    }
  }





  async uploadFile( filePath:  Express.Multer.File) {
    try {
      if (!this.s3) {
        throw new HttpException('MinIO is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    
      const fileContent = createReadStream(filePath.path);

      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key:filePath.filename , 
        Body: fileContent,
        ContentType:filePath.mimetype ,
        
      });

      // Upload to MinIO
     const s =  await this.s3.send(command);
      this.logger.debug(s)
      this.logger.debug(`${this.configService.get('MINIO_URL')}/${BUCKET_NAME}/${filePath.filename}`)
      // Return the public URL
      return `${this.configService.get('MINIO_URL')}/${BUCKET_NAME}/${filePath.filename}`;
    } catch (err) {
      console.error('Error uploading file:', err);
      throw new HttpException('Failed to upload file',HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteService(fileReference:string){
    const fileName = this.objectKey(fileReference);
    if (!fileName) {
    throw new HttpException('Invalid file name', HttpStatus.BAD_REQUEST);
  }
    try {
      if (!this.s3) {
        return true;
      }
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
       Key:fileName,
      });
      await this.s3.send(command);
      this.logger.debug("file deleted",fileName)
      return true
    } catch (err) {
      console.error('Error Delete file:', err);
      throw new HttpException('Can not Delete File',HttpStatus.INTERNAL_SERVER_ERROR);
    }

  }

  private objectKey(fileReference: string) {
    if (!fileReference || typeof fileReference !== 'string') return '';

    const trimmed = fileReference.trim();
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      const bucketIndex = parts.indexOf(BUCKET_NAME);
      const keyParts = bucketIndex >= 0 ? parts.slice(bucketIndex + 1) : parts.slice(-1);
      return decodeURIComponent(keyParts.join('/'));
    } catch {
      const withoutQuery = trimmed.split(/[?#]/)[0].replace(/^\/+/, '');
      const bucketPrefix = `${BUCKET_NAME}/`;
      const key = withoutQuery.startsWith(bucketPrefix)
        ? withoutQuery.slice(bucketPrefix.length)
        : withoutQuery;
      return decodeURIComponent(key);
    }
  }




}

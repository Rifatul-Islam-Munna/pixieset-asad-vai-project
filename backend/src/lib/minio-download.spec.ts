import { S3Client } from '@aws-sdk/client-s3';
import { MinioService } from './minio.service';

function storage() {
  const service: any = new MinioService({} as any);
  Object.assign(service, {
    s3: new S3Client({ region: 'auto', endpoint: 'https://account.r2.cloudflarestorage.com',
      credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' }, forcePathStyle: true }),
    endpointUrl: 'https://account.r2.cloudflarestorage.com',
    publicBaseUrl: 'https://images.test', bucketName: 'public', privateBucketName: 'private',
  });
  return service;
}

describe('direct R2 signed downloads', () => {
  it('signs private originals with attachment disposition and bounded expiry', async () => {
    const service = storage();
    const url = new URL(await service.createDownloadUrl('private-direct/user/photo.jpg', 'photo.jpg', 86400, true));
    expect(url.hostname).toBe('account.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/private/private-direct/user/photo.jpg');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('86400');
    expect(url.searchParams.get('response-content-disposition')).toContain('attachment;');
    expect(url.searchParams.has('X-Amz-Signature')).toBe(true);
    service.s3.destroy();
  });
  it('resolves public bucket keys without proxying a GET', async () => {
    const service = storage();
    const url = new URL(await service.createDownloadUrl('https://images.test/folder/photo%20one.jpg', 'photo one.jpg', 60));
    expect(url.pathname).toBe('/public/folder/photo%20one.jpg');
    service.s3.destroy();
  });
  it('rejects expired lifetimes and unknown storage hosts', async () => {
    const service = storage();
    await expect(service.createDownloadUrl('key', 'photo', 0)).rejects.toThrow('expired');
    await expect(service.createDownloadUrl('key', 'photo', 86401)).rejects.toThrow('expired');
    await expect(service.createDownloadUrl('https://other.test/private', 'photo', 60)).rejects.toThrow('legacy photo');
    service.s3.destroy();
  });
});

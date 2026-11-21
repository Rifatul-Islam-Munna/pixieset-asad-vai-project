import { S3Client } from '@aws-sdk/client-s3';
import { MinioService } from './minio.service';

function storage() {
  const service: any = new MinioService({ get: () => undefined } as any);
  Object.assign(service, {
    s3: new S3Client({
      region: 'auto',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
      forcePathStyle: true,
    }),
    endpointUrl: 'https://account.r2.cloudflarestorage.com',
    publicBaseUrl: 'https://images.test',
    bucketName: 'public',
    privateBucketName: 'private',
  });
  return service;
}

describe('direct browser photo downloads', () => {
  it('signs private originals with attachment disposition and bounded expiry', async () => {
    const service = storage();
    const url = new URL(await service.createBrowserDownloadUrl('private-direct/user/photo.jpg', 'photo.jpg', 86400, true));
    expect(url.hostname).toBe('account.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/private/private-direct/user/photo.jpg');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('86400');
    expect(url.searchParams.get('response-content-disposition')).toContain('attachment;');
    expect(url.searchParams.has('X-Amz-Signature')).toBe(true);
    service.s3.destroy();
  });

  it('signs public bucket URLs without proxying a GET', async () => {
    const service = storage();
    const url = new URL(await service.createBrowserDownloadUrl('https://images.test/folder/photo%20one.jpg', 'photo one.jpg', 60));
    expect(url.pathname).toBe('/public/folder/photo%20one.jpg');
    service.s3.destroy();
  });

  it('returns external legacy HTTPS photos directly without requiring object-storage migration', async () => {
    const service = storage();
    const legacyUrl = 'https://legacy-cdn.example.test/old-photo.jpg';
    expect(await service.createBrowserDownloadUrl(legacyUrl, 'old-photo.jpg', 60)).toBe(legacyUrl);
    service.s3.destroy();
  });

  it('resolves legacy backend uploads against the public backend origin', async () => {
    const service = storage();
    service.configService = {
      get: (key: string) => key === 'PUBLIC_API_URL'
        ? 'https://ai-photo-book-moment-backend.wrtsxa.easypanel.host'
        : undefined,
    };
    expect(await service.createBrowserDownloadUrl('/uploads/old-photo.jpg', 'old-photo.jpg', 60))
      .toBe('https://ai-photo-book-moment-backend.wrtsxa.easypanel.host/uploads/old-photo.jpg');
    service.s3.destroy();
  });

  it('rejects expired signed lifetimes', async () => {
    const service = storage();
    await expect(service.createDownloadUrl('key', 'photo', 0)).rejects.toThrow('expired');
    await expect(service.createDownloadUrl('key', 'photo', 86401)).rejects.toThrow('expired');
    service.s3.destroy();
  });
});

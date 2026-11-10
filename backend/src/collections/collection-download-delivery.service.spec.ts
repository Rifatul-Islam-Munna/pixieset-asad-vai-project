import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { CollectionDownloadDeliveryService } from './collection-download-delivery.service';

const token = 'a'.repeat(64);
const imageId = '123456789012345678901234';
const query = (value: unknown) => {
  const chain: any = { lean: jest.fn().mockResolvedValue(value) };
  chain.select = jest.fn().mockReturnValue(chain);
  return chain;
};

function fixture() {
  const job = { _id: imageId, token, collectionId: 'gallery', collectionName: '<script>bad</script>',
    imageIds: [imageId], status: 'ready', expiresAt: new Date(Date.now() + 86400000), emailAttempts: 1 };
  const service: any = Object.create(CollectionDownloadDeliveryService.prototype);
  Object.assign(service, {
    deliveryModel: { findOne: jest.fn(() => query(job)), updateOne: jest.fn().mockResolvedValue({}) },
    imageModel: { findOne: jest.fn(() => query({ _id: imageId, originalObjectKey: 'private-direct/owner/photo.jpg', originalName: 'photo.jpg' })),
      find: jest.fn(() => query([{ _id: imageId, originalName: '<img onerror=bad>' }])) },
    privatePhotoModel: { exists: jest.fn().mockResolvedValue(null) },
    minioService: { createDownloadUrl: jest.fn().mockResolvedValue('https://storage.test/signed') },
    brandingEmailService: { sendBranded: jest.fn().mockResolvedValue({ sent: false, reason: 'SMTP_SEND_FAILED' }) },
    configService: { get: (key: string) => key === 'PUBLIC_API_URL' ? 'https://api.test' : undefined },
    logger: { error: jest.fn() },
  });
  return { service, job };
}

describe('direct gallery downloads', () => {
  it('returns a ready 24-hour link without waiting for image processing or email', async () => {
    const { service } = fixture();
    const collection = { _id: imageId, userId: 'owner', name: 'Gallery' };
    Object.assign(service, {
      findPublicCollection: jest.fn().mockResolvedValue(collection),
      userModel: { findById: () => query({ planFeatures: { downloads: true } }) },
      downloadAndAccessSettings: jest.fn().mockResolvedValue({ download: {} }),
      assertGalleryAccess: jest.fn(),
      resolveRequestedImages: jest.fn().mockResolvedValue([{ _id: imageId }]),
      recordActivity: jest.fn().mockResolvedValue(undefined),
      processQueue: jest.fn(),
    });
    service.deliveryModel.create = jest.fn().mockResolvedValue({ _id: imageId });
    const before = Date.now();
    const result = await service.request('gallery', { email: 'client@test.dev' });
    expect(result.status).toBe('ready'); expect(result.expiresInHours).toBe(24);
    expect(result.downloadUrl).toMatch(/^https:\/\/api.test\/public\/collections\/download-deliveries\/[a-f0-9]{64}$/);
    expect(service.deliveryModel.create.mock.calls[0][0].expiresAt.getTime() - before).toBeGreaterThanOrEqual(86400000);
    expect(service.brandingEmailService.sendBranded).not.toHaveBeenCalled();
  });
  it('rejects expired tokens without touching image storage', async () => {
    const { service, job } = fixture(); job.expiresAt = new Date(0);
    await expect(service.fileLink(token, imageId)).rejects.toBeInstanceOf(GoneException);
    expect(service.minioService.createDownloadUrl).not.toHaveBeenCalled();
  });
  it('rejects malformed tokens and photos outside the request', async () => {
    const { service } = fixture();
    await expect(service.open('bad')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.fileLink(token, '223456789012345678901234')).rejects.toBeInstanceOf(NotFoundException);
    expect(service.imageModel.findOne).not.toHaveBeenCalled();
  });
  it('rejects photos made private after the request', async () => {
    const { service } = fixture(); service.privatePhotoModel.exists.mockResolvedValue({ _id: imageId });
    await expect(service.fileLink(token, imageId)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('signs original directly with remaining lifetime and never reads image bytes', async () => {
    const { service } = fixture();
    expect(await service.fileLink(token, imageId)).toBe('https://storage.test/signed');
    const args = service.minioService.createDownloadUrl.mock.calls[0];
    expect(args[0]).toBe('private-direct/owner/photo.jpg');
    expect(args[2]).toBeGreaterThan(86390); expect(args[2]).toBeLessThanOrEqual(86400);
    expect(args[3]).toBe(true);
  });
  it('keeps restricted downloads on the small cached variant', async () => {
    const { service, job } = fixture(); Object.assign(job, { preferThumbnails: true });
    service.imageModel.findOne.mockReturnValue(query({ originalObjectKey: 'private-direct/owner/photo.jpg', originalName: 'photo.jpg', metadata: { imageCache: { urls: { small: 'https://storage.test/small.avif' } } } }));
    await service.fileLink(token, imageId);
    expect(service.minioService.createDownloadUrl.mock.calls[0].slice(0, 2)).toEqual(['https://storage.test/small.avif', 'photo.avif']);
  });
  it('renders escaped filenames and limits image queries to 100 IDs', async () => {
    const { service, job } = fixture(); job.imageIds = Array(250).fill(imageId);
    const html = await service.open(token);
    expect(service.imageModel.find.mock.calls[0][0]._id.$in).toHaveLength(100);
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('&lt;img onerror=bad&gt;');
    expect(html).not.toContain('<script>'); expect(html).toContain('?page=1');
  });
  it('retries SMTP failures while keeping the download ready', async () => {
    const { service, job } = fixture();
    await service.sendReadyEmail(job);
    const update = service.deliveryModel.updateOne.mock.calls[0][1].$set;
    expect(update.lastError).toBe('SMTP_SEND_FAILED'); expect(update.emailNextAttemptAt).toBeInstanceOf(Date);
    expect(update.status).toBeUndefined();
  });
  it('records successful email delivery', async () => {
    const { service, job } = fixture(); service.brandingEmailService.sendBranded.mockResolvedValue({ sent: true });
    await service.sendReadyEmail(job);
    expect(service.deliveryModel.updateOne.mock.calls[0][1].$set.emailSentAt).toBeInstanceOf(Date);
  });
  it('rejects unready delivery links', async () => {
    const { service, job } = fixture(); job.status = 'processing';
    await expect(service.open(token)).rejects.toBeInstanceOf(BadRequestException);
  });
});

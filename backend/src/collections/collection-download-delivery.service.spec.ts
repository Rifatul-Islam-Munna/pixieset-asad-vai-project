import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { CollectionDownloadDeliveryService } from './collection-download-delivery.service';
import { streamPhotoZip } from 'src/lib/stream-photo-zip';

jest.mock('src/lib/stream-photo-zip', () => ({ streamPhotoZip: jest.fn(async () => undefined) }));

const token = 'a'.repeat(64);
const imageId = '123456789012345678901234';
const query = (value: unknown) => {
  const chain: any = { lean: jest.fn().mockResolvedValue(value) };
  chain.select = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  return chain;
};

function fixture() {
  const job = { _id: imageId, token, collectionId: 'gallery', collectionName: '<script>bad</script>',
    scope: 'all', fileName: 'gallery', downloadUrl: `https://api.test/public/collections/download-deliveries/${token}`,
    imageIds: [imageId], status: 'ready', expiresAt: new Date(Date.now() + 86400000), emailAttempts: 1 };
  const service: any = Object.create(CollectionDownloadDeliveryService.prototype);
  Object.assign(service, {
    emailTasks: 0, activeDownloads: 0,
    deliveryModel: { findOne: jest.fn(() => query(job)), updateOne: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue(job), updateMany: jest.fn().mockResolvedValue({}) },
    imageModel: { findOne: jest.fn(() => query({ _id: imageId, originalObjectKey: 'private-direct/owner/photo.jpg', originalName: 'photo.jpg' })),
      find: jest.fn(() => query([{ _id: imageId, originalName: '<img onerror=bad>' }])) },
    privatePhotoModel: { exists: jest.fn().mockResolvedValue(null), find: jest.fn(() => query([])) },
    minioService: { createDownloadUrl: jest.fn().mockResolvedValue('https://storage.test/signed') },
    brandingEmailService: { sendBranded: jest.fn().mockResolvedValue({ sent: false, reason: 'SMTP_SEND_FAILED' }) },
    configService: { get: (key: string) => key === 'PUBLIC_API_URL' ? 'https://api.test' : undefined },
    logger: { error: jest.fn() },
  });
  return { service, job };
}

function response() {
  const { PassThrough } = require('node:stream');
  const res = new PassThrough();
  res.setHeader = jest.fn(); res.redirect = jest.fn();
  return res;
}

describe('one-click gallery downloads', () => {
  beforeEach(() => jest.clearAllMocks());
  it('attempts email immediately with the exact URL returned to the browser', async () => {
    const { service } = fixture();
    const collection = { _id: imageId, userId: 'owner', name: 'Gallery' };
    Object.assign(service, {
      findPublicCollection: jest.fn().mockResolvedValue(collection),
      userModel: { findById: () => query({ planFeatures: { downloads: true } }) },
      downloadAndAccessSettings: jest.fn().mockResolvedValue({ download: {} }),
      assertGalleryAccess: jest.fn(),
      resolveRequestedImages: jest.fn().mockResolvedValue([{ _id: imageId }]),
      recordActivity: jest.fn().mockResolvedValue(undefined),
    });
    service.deliveryModel.create = jest.fn(async (data) => ({ _id: imageId, ...data }));
    service.deliveryModel.findOneAndUpdate.mockImplementation(async () => ({ _id: imageId,
      ...service.deliveryModel.create.mock.calls[0][0], emailAttempts: 1 }));
    service.brandingEmailService.sendBranded.mockResolvedValue({ sent: true });
    const before = Date.now();
    const result = await service.request('gallery', { email: 'client@test.dev' });
    expect(result.status).toBe('ready'); expect(result.expiresInHours).toBe(24);
    expect(result.downloadUrl).toMatch(/^https:\/\/api.test\/public\/collections\/download-deliveries\/[a-f0-9]{64}$/);
    expect(service.deliveryModel.create.mock.calls[0][0].expiresAt.getTime() - before).toBeGreaterThanOrEqual(86400000);
    expect(result.emailStatus).toBe('sent');
    expect(service.brandingEmailService.sendBranded.mock.calls[0][0].buttonLink).toBe(result.downloadUrl);
    expect(service.deliveryModel.create.mock.calls[0][0].downloadUrl).toBe(result.downloadUrl);
  });
  it('rejects expired tokens without touching image storage', async () => {
    const { service, job } = fixture(); job.expiresAt = new Date(0);
    await expect(service.fileLink(token, imageId)).rejects.toBeInstanceOf(GoneException);
    expect(service.minioService.createDownloadUrl).not.toHaveBeenCalled();
  });
  it('rejects malformed tokens and photos outside the request', async () => {
    const { service } = fixture();
    await expect(service.download('bad', response())).rejects.toBeInstanceOf(NotFoundException);
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
  it('streams an automatic attachment and releases its concurrency slot', async () => {
    const { service } = fixture(); const res = response();
    await service.download(token, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment;'));
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('.zip'));
    expect(streamPhotoZip).toHaveBeenCalled(); expect(service.activeDownloads).toBe(0);
    res.destroy();
  });
  it('deduplicates filenames inside a safe folder and queries at most 100 photos at a time', async () => {
    const { service, job } = fixture(); job.imageIds = Array(250).fill(imageId);
    const entries = service.archiveEntries(job, 'Gallery', new AbortController().signal);
    expect((await entries.next()).value.name).toBe('Gallery/-img onerror=bad-');
    expect((await entries.next()).value.name).toBe('Gallery/-img onerror=bad--2');
    expect(service.imageModel.find.mock.calls[0][0]._id.$in).toHaveLength(100);
    await entries.return();
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
    expect(service.brandingEmailService.sendBranded.mock.calls[0][0].buttonLink).toBe(job.downloadUrl);
  });
  it('rejects unready delivery links', async () => {
    const { service, job } = fixture(); job.status = 'processing';
    await expect(service.download(token, response())).rejects.toBeInstanceOf(BadRequestException);
  });
  it('runs transactional email retries even when other background workers are disabled', async () => {
    const { service } = fixture(); const previous = process.env.APP_BACKGROUND_WORKER;
    process.env.APP_BACKGROUND_WORKER = 'false';
    service.lastCleanupAt = Date.now();
    service.sendRequestedEmail = jest.fn().mockResolvedValue('queued');
    try { await service.processQueue(); expect(service.sendRequestedEmail).toHaveBeenCalled(); }
    finally { if (previous === undefined) delete process.env.APP_BACKGROUND_WORKER; else process.env.APP_BACKGROUND_WORKER = previous; }
  });
  it('reports failed email attempts without failing the ready download', async () => {
    const { service } = fixture();
    expect(await service.sendRequestedEmail(imageId)).toBe('failed');
    expect(service.emailTasks).toBe(0);
  });
  it('caps archive and email concurrency without opening more storage streams', async () => {
    const { service } = fixture(); const res = response();
    service.activeDownloads = 2; service.emailTasks = 2;
    await expect(service.download(token, res)).rejects.toThrow('Downloads are busy');
    expect(streamPhotoZip).not.toHaveBeenCalled();
    expect(await service.sendRequestedEmail(imageId)).toBe('queued');
    expect(service.deliveryModel.findOneAndUpdate).not.toHaveBeenCalled();
    res.destroy();
  });
  it('keeps single-photo clicks as direct storage downloads', async () => {
    const { service, job } = fixture(); job.scope = 'single'; const res = response();
    await service.download(token, res);
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://storage.test/signed');
    expect(streamPhotoZip).not.toHaveBeenCalled(); res.destroy();
  });
  it('never includes photos made private after the original request', async () => {
    const { service } = fixture(); const res = response();
    service.privatePhotoModel.find.mockReturnValue(query([{ imageId }]));
    await expect(service.download(token, res)).rejects.toThrow('No downloadable photos remain');
    expect(streamPhotoZip).not.toHaveBeenCalled(); expect(service.activeDownloads).toBe(0); res.destroy();
  });
  it('releases its download slot when archive streaming fails', async () => {
    const { service } = fixture(); const res = response();
    (streamPhotoZip as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(service.download(token, res)).rejects.toThrow('Storage unavailable');
    expect(service.activeDownloads).toBe(0); res.destroy();
  });
  it('recovers unsent legacy requests once, preserving the same 24-hour token URL', async () => {
    const { service } = fixture();
    service.deliveryModel.find = jest.fn().mockReturnValueOnce(query([{ _id: imageId, token }])).mockReturnValueOnce(query([]));
    await service.cleanupExpired();
    expect(service.deliveryModel.find.mock.calls[0][0]).toMatchObject({ emailSentAt: null, downloadUrl: { $in: ['', null] } });
    const update = service.deliveryModel.updateOne.mock.calls[0][1].$set;
    expect(update.downloadUrl).toBe(`https://api.test/public/collections/download-deliveries/${token}`);
    expect(update.emailAttempts).toBe(0); expect(update.emailNextAttemptAt).toBeInstanceOf(Date);
  });
});

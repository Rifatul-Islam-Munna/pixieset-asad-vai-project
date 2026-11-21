import { BadRequestException, GoneException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CollectionDownloadDeliveryService } from './collection-download-delivery.service';
import { streamPhotoZip } from 'src/lib/stream-photo-zip';

jest.mock('src/lib/stream-photo-zip', () => ({
  streamPhotoZip: jest.fn(async () => undefined),
}));

const token = 'a'.repeat(64);
const imageId = '123456789012345678901234';

const query = (value: unknown) => {
  const chain: any = { lean: jest.fn().mockResolvedValue(value) };
  chain.select = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  return chain;
};

function fixture() {
  const job = {
    _id: imageId,
    token,
    collectionId: 'gallery',
    collectionName: 'Gallery',
    scope: 'all',
    preferThumbnails: false,
    fileName: 'gallery-all',
    downloadUrl: `https://gallerista.app/download/${token}`,
    imageIds: [imageId],
    status: 'ready',
    expiresAt: new Date(Date.now() + 86400000),
    emailAttempts: 1,
  };
  const image = {
    _id: imageId,
    originalObjectKey: 'private-direct/owner/photo.jpg',
    originalFilename: 'photo.jpg',
    originalName: 'photo.jpg',
    url: 'https://storage.test/photo.jpg',
    mimetype: 'image/jpeg',
    sizeBytes: 100,
    originalSizeBytes: 100,
  };
  const service: any = Object.create(CollectionDownloadDeliveryService.prototype);
  Object.assign(service, {
    emailTasks: 0,
    activeDownloads: 0,
    lastCleanupAt: Date.now(),
    deliveryModel: {
      findOne: jest.fn(() => query(job)),
      updateOne: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue(job),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    imageModel: {
      findOne: jest.fn(() => query(image)),
      find: jest.fn(() => query([image])),
      aggregate: jest.fn().mockResolvedValue([{ totalSizeBytes: 100 }]),
    },
    privatePhotoModel: {
      exists: jest.fn().mockResolvedValue(null),
      find: jest.fn(() => query([])),
    },
    minioService: {
      createBrowserDownloadUrl: jest.fn().mockResolvedValue('https://storage.test/signed'),
      createDownloadUrl: jest.fn().mockResolvedValue('https://storage.test/signed'),
      deleteService: jest.fn().mockResolvedValue(true),
    },
    brandingEmailService: {
      sendBranded: jest.fn().mockResolvedValue({ sent: false, reason: 'SMTP_SEND_FAILED' }),
    },
    configService: {
      get: (key: string) => key === 'FRONTEND_URL' ? 'https://gallerista.app' : undefined,
    },
    logger: { error: jest.fn() },
  });
  return { service, job, image };
}

function response() {
  const { PassThrough } = require('node:stream');
  const res = new PassThrough();
  res.setHeader = jest.fn();
  res.redirect = jest.fn();
  return res;
}

describe('browser-side gallery downloads', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a frontend download page URL and emails the same URL returned to the client', async () => {
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
    service.deliveryModel.findOneAndUpdate.mockImplementation(async () => ({
      _id: imageId,
      ...service.deliveryModel.create.mock.calls[0][0],
      emailAttempts: 1,
    }));
    service.brandingEmailService.sendBranded.mockResolvedValue({ sent: true });

    const result = await service.request('gallery', { email: 'client@test.dev' });
    expect(result.status).toBe('ready');
    expect(result.expiresInHours).toBe(24);
    expect(result.downloadUrl).toMatch(/^https:\/\/gallerista\.app\/download\/[a-f0-9]{64}$/);
    expect(result.emailStatus).toBe('sent');
    expect(service.brandingEmailService.sendBranded.mock.calls[0][0].buttonLink).toBe(result.downloadUrl);
    expect(service.deliveryModel.create.mock.calls[0][0].downloadUrl).toBe(result.downloadUrl);
  });

  it('redirects old backend download links to the frontend page without streaming a server ZIP', async () => {
    const { service } = fixture();
    const res = response();
    await service.download(token, res);
    expect(res.redirect).toHaveBeenCalledWith(302, `https://gallerista.app/download/${token}`);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('offers a native ZIP attachment for browsers without showSaveFilePicker', async () => {
    const { service } = fixture();
    const res = response();
    await service.downloadArchive(token, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment;'));
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(service.minioService.createDownloadUrl).toHaveBeenCalledWith(
      'private-direct/owner/photo.jpg',
      'photo.jpg',
      86400,
      true,
    );
    expect(streamPhotoZip).toHaveBeenCalledTimes(1);
    expect(service.activeDownloads).toBe(0);
    res.destroy();
  });

  it('uses a direct single-photo redirect for Safari, not a ZIP', async () => {
    const { service, job } = fixture();
    job.scope = 'single';
    const res = response();
    await service.downloadArchive(token, res);
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://storage.test/signed');
    expect(streamPhotoZip).not.toHaveBeenCalled();
    res.destroy();
  });

  it('rejects expired Safari ZIP links without accessing object storage', async () => {
    const { service, job } = fixture();
    job.expiresAt = new Date(0);
    await expect(service.downloadArchive(token, response())).rejects.toBeInstanceOf(GoneException);
    expect(service.minioService.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('caps simultaneous Safari ZIP streams to keep backend memory bounded', async () => {
    const { service } = fixture();
    service.activeDownloads = 2;
    const res = response();
    await expect(service.downloadArchive(token, res)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '10');
    expect(streamPhotoZip).not.toHaveBeenCalled();
    res.destroy();
  });

  it('does not stream photos made private after the Safari link was issued', async () => {
    const { service } = fixture();
    service.privatePhotoModel.find.mockReturnValue(query([{ imageId }]));
    const res = response();
    await expect(service.downloadArchive(token, res)).rejects.toBeInstanceOf(NotFoundException);
    expect(service.minioService.createDownloadUrl).not.toHaveBeenCalled();
    expect(streamPhotoZip).not.toHaveBeenCalled();
    expect(service.activeDownloads).toBe(0);
    res.destroy();
  });

  it('returns paginated presigned URLs and metadata without reading photo bytes', async () => {
    const { service, job } = fixture();
    job.imageIds = Array(250).fill(imageId);
    const page = await service.manifest(token, 0, 100);
    expect(page.totalCount).toBe(250);
    expect(page.totalSizeBytes).toBe(100);
    expect(page.files).toHaveLength(100);
    expect(page.nextOffset).toBe(100);
    expect(page.files[0]).toMatchObject({
      id: imageId,
      name: 'Gallery/photo.jpg',
      url: 'https://storage.test/signed',
      contentType: 'image/jpeg',
      sizeBytes: 100,
    });
    expect(service.imageModel.find.mock.calls[0][0]._id.$in).toHaveLength(100);
    expect(service.minioService.createBrowserDownloadUrl).toHaveBeenCalledTimes(100);
  });

  it('returns existing external legacy URLs directly instead of requiring an object-storage migration', async () => {
    const { service } = fixture();
    service.imageModel.find.mockReturnValue(query([{
      _id: imageId,
      url: 'https://legacy-cdn.example.test/old-photo.jpg',
      originalName: 'old-photo.jpg',
      mimetype: 'image/jpeg',
      sizeBytes: 120,
    }]));
    service.minioService.createBrowserDownloadUrl.mockImplementation(async (reference: string) => reference);
    const page = await service.manifest(token, 0, 50);
    expect(page.files[0].url).toBe('https://legacy-cdn.example.test/old-photo.jpg');
    expect(service.minioService.createBrowserDownloadUrl).toHaveBeenCalledWith(
      'https://legacy-cdn.example.test/old-photo.jpg',
      'old-photo.jpg',
      expect.any(Number),
      false,
    );
  });

  it('does not include photos made private after the download was requested', async () => {
    const { service } = fixture();
    service.privatePhotoModel.find.mockReturnValue(query([{ imageId }]));
    const page = await service.manifest(token, 0, 50);
    expect(page.files).toHaveLength(0);
    expect(service.minioService.createBrowserDownloadUrl).not.toHaveBeenCalled();
  });

  it('rejects expired tokens without signing photo URLs', async () => {
    const { service, job } = fixture();
    job.expiresAt = new Date(0);
    await expect(service.manifest(token, 0, 50)).rejects.toBeInstanceOf(GoneException);
    expect(service.minioService.createBrowserDownloadUrl).not.toHaveBeenCalled();
  });

  it('rejects malformed tokens and photos outside the request', async () => {
    const { service } = fixture();
    await expect(service.manifest('bad', 0, 50)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.fileLink(token, '223456789012345678901234')).rejects.toBeInstanceOf(NotFoundException);
    expect(service.imageModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects a single photo made private after the original request', async () => {
    const { service } = fixture();
    service.privatePhotoModel.exists.mockResolvedValue({ _id: imageId });
    await expect(service.fileLink(token, imageId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('signs an original object key directly for a single-photo download', async () => {
    const { service } = fixture();
    expect(await service.fileLink(token, imageId)).toBe('https://storage.test/signed');
    const args = service.minioService.createBrowserDownloadUrl.mock.calls[0];
    expect(args[0]).toBe('private-direct/owner/photo.jpg');
    expect(args[2]).toBeGreaterThan(86390);
    expect(args[2]).toBeLessThanOrEqual(86400);
    expect(args[3]).toBe(true);
  });

  it('keeps restricted single-photo downloads on the small cached variant', async () => {
    const { service, job } = fixture();
    job.preferThumbnails = true;
    service.imageModel.findOne.mockReturnValue(query({
      originalName: 'photo.jpg',
      url: 'https://storage.test/original.jpg',
      metadata: { imageCache: { urls: { small: 'https://storage.test/small.avif' } } },
    }));
    await service.fileLink(token, imageId);
    expect(service.minioService.createBrowserDownloadUrl.mock.calls[0].slice(0, 2)).toEqual([
      'https://storage.test/small.avif',
      'photo.avif',
    ]);
  });

  it('retries SMTP failures while keeping the download ready', async () => {
    const { service, job } = fixture();
    await service.sendReadyEmail(job);
    const update = service.deliveryModel.updateOne.mock.calls[0][1].$set;
    expect(update.lastError).toBe('SMTP_SEND_FAILED');
    expect(update.emailNextAttemptAt).toBeInstanceOf(Date);
    expect(update.status).toBeUndefined();
  });

  it('records successful email delivery', async () => {
    const { service, job } = fixture();
    service.brandingEmailService.sendBranded.mockResolvedValue({ sent: true });
    await service.sendReadyEmail(job);
    expect(service.deliveryModel.updateOne.mock.calls[0][1].$set.emailSentAt).toBeInstanceOf(Date);
    expect(service.brandingEmailService.sendBranded.mock.calls[0][0].buttonLink).toBe(job.downloadUrl);
  });

  it('rejects unready delivery links', async () => {
    const { service, job } = fixture();
    job.status = 'processing';
    await expect(service.manifest(token, 0, 50)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('runs transactional email retries even when other background workers are disabled', async () => {
    const { service } = fixture();
    const previous = process.env.APP_BACKGROUND_WORKER;
    process.env.APP_BACKGROUND_WORKER = 'false';
    service.sendRequestedEmail = jest.fn().mockResolvedValue('queued');
    try {
      await service.processQueue();
      expect(service.sendRequestedEmail).toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.APP_BACKGROUND_WORKER;
      else process.env.APP_BACKGROUND_WORKER = previous;
    }
  });

  it('reports failed email attempts without failing the ready download', async () => {
    const { service } = fixture();
    expect(await service.sendRequestedEmail(imageId)).toBe('failed');
    expect(service.emailTasks).toBe(0);
  });

  it('caps email concurrency without signing more work', async () => {
    const { service } = fixture();
    service.emailTasks = 2;
    expect(await service.sendRequestedEmail(imageId)).toBe('queued');
    expect(service.deliveryModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('recovers unsent legacy requests once, preserving the same frontend URL', async () => {
    const { service } = fixture();
    service.deliveryModel.find = jest.fn()
      .mockReturnValueOnce(query([{ _id: imageId, token }]))
      .mockReturnValueOnce(query([]));
    await service.cleanupExpired();
    expect(service.deliveryModel.find.mock.calls[0][0]).toMatchObject({
      emailSentAt: null,
      downloadUrl: { $in: ['', null] },
    });
    const update = service.deliveryModel.updateOne.mock.calls[0][1].$set;
    expect(update.downloadUrl).toBe(`https://gallerista.app/download/${token}`);
    expect(update.emailAttempts).toBe(0);
    expect(update.emailNextAttemptAt).toBeInstanceOf(Date);
  });
});

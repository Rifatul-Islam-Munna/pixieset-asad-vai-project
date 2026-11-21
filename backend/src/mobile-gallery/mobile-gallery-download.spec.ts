import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PassThrough } from 'node:stream';
import { streamPhotoZip } from 'src/lib/stream-photo-zip';
import { MobileGalleryService } from './mobile-gallery.service';

jest.mock('src/lib/stream-photo-zip', () => ({
  streamPhotoZip: jest.fn(async () => undefined),
}));

const imageId = '123456789012345678901234';
const appId = '223456789012345678901234';

function query(value: unknown) {
  const q: any = { lean: jest.fn().mockResolvedValue(value) };
  q.select = jest.fn().mockReturnValue(q);
  return q;
}

function fixture() {
  const app = { _id: appId, slug: 'family-photos' };
  const photo = { _id: imageId, url: 'https://r2.example.test/photo.jpg', originalName: 'photo.jpg' };
  const appModel = { findOne: jest.fn(() => query(app)) };
  const imageModel = {
    findOne: jest.fn(() => query(photo)),
    find: jest.fn(() => {
      const q: any = {
        sort: jest.fn(),
        select: jest.fn(),
        lean: jest.fn(),
        cursor: jest.fn(() => (async function* () { yield photo; })()),
      };
      q.sort.mockReturnValue(q);
      q.select.mockReturnValue(q);
      q.lean.mockReturnValue(q);
      return q;
    }),
  };
  const minioService = {
    createDownloadUrl: jest.fn().mockResolvedValue('https://r2.example.test/signed'),
  };
  const service: any = Object.create(MobileGalleryService.prototype);
  Object.assign(service, {
    appModel,
    imageModel,
    minioService,
    activeArchiveDownloads: 0,
  });
  const response: any = new PassThrough();
  response.setHeader = jest.fn();
  response.redirect = jest.fn();
  return { service, response, appModel, imageModel, minioService };
}

describe('mobile gallery Safari native download fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('streams a native ZIP attachment instead of building a browser Blob', async () => {
    const { service, response, minioService } = fixture();
    await service.downloadPublicArchive('family-photos', undefined, response);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="family-photos-all-photos.zip"');
    expect(minioService.createDownloadUrl).toHaveBeenCalledWith('https://r2.example.test/photo.jpg', 'photo.jpg', 86400, false);
    expect(streamPhotoZip).toHaveBeenCalledTimes(1);
    expect(service.activeArchiveDownloads).toBe(0);
    response.destroy();
  });

  it('restricts selected downloads to requested photo IDs within the published gallery', async () => {
    const { service, imageModel, response } = fixture();
    await service.downloadPublicArchive('family-photos', imageId, response);
    expect(imageModel.find.mock.calls[0][0]).toEqual({
      appId,
      _id: { $in: [imageId] },
    });
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="family-photos-selected.zip"');
    response.destroy();
  });

  it('does not allow invalid selected IDs', async () => {
    const { service, response, imageModel } = fixture();
    await expect(service.downloadPublicArchive('family-photos', 'not-a-photo', response)).rejects.toBeInstanceOf(BadRequestException);
    expect(imageModel.find).not.toHaveBeenCalled();
    response.destroy();
  });

  it('limits concurrent streamed ZIPs', async () => {
    const { service, response } = fixture();
    service.activeArchiveDownloads = 2;
    await expect(service.downloadPublicArchive('family-photos', undefined, response)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '10');
    response.destroy();
  });

  it('does not package an empty gallery', async () => {
    const { service, imageModel, response } = fixture();
    imageModel.find.mockImplementation(() => {
      const q: any = {
        sort: jest.fn(),
        select: jest.fn(),
        lean: jest.fn(),
        cursor: jest.fn(() => (async function* () {})()),
      };
      q.sort.mockReturnValue(q);
      q.select.mockReturnValue(q);
      q.lean.mockReturnValue(q);
      return q;
    });
    await expect(service.downloadPublicArchive('family-photos', undefined, response)).rejects.toBeInstanceOf(NotFoundException);
    expect(service.activeArchiveDownloads).toBe(0);
    response.destroy();
  });

  it('gives Safari a signed attachment link for individual photos', async () => {
    const { service, imageModel } = fixture();
    expect(await service.publicPhotoFile('family-photos', imageId)).toBe('https://r2.example.test/signed');
    expect(imageModel.findOne.mock.calls[0][0]).toEqual({ appId, _id: imageId });
  });

  it('does not expose unpublished mobile galleries', async () => {
    const { service, appModel, response } = fixture();
    appModel.findOne.mockReturnValue(query(null));
    await expect(service.downloadPublicArchive('hidden-gallery', undefined, response)).rejects.toBeInstanceOf(NotFoundException);
    response.destroy();
  });
});

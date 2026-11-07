jest.mock('src/collections/entities/collection-image.entity', () => ({ CollectionImage: class CollectionImage {} }), { virtual: true });
jest.mock('src/mobile-gallery/entities/mobile-gallery-image.entity', () => ({ MobileGalleryImage: class MobileGalleryImage {} }), { virtual: true });
jest.mock('src/admin/free-plan-setting.service', () => ({ FreePlanSettingService: class FreePlanSettingService {} }), { virtual: true });
jest.mock('src/homepage/homepage.service', () => ({ HomepageService: class HomepageService {} }), { virtual: true });
jest.mock('src/mail/mail.service', () => ({ MailService: class MailService {} }), { virtual: true });
jest.mock('src/lib/minio.service', () => ({ MinioService: class MinioService {} }), { virtual: true });
jest.mock('src/mail/system-notification-email', () => ({
  buildSystemNotificationEmail: jest.fn(),
  describeUserAgent: jest.fn(),
  formatNotificationTime: jest.fn(),
}), { virtual: true });

import { UserService } from './user.service';

describe('account deletion', () => {
  function setup(role = 'user') {
    const userRecord = { role };
    const userModel: any = {
      findById: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue(userRecord),
        })),
      })),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    const collectionModel: any = {
      modelName: 'Collection',
      schema: { path: jest.fn((path: string) => path === 'userId') },
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue([{ _id: 'gallery-1' }]),
        })),
      })),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    const favoriteModel: any = {
      modelName: 'CollectionFavorite',
      schema: { path: jest.fn((path: string) => path === 'collectionId') },
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    const sharedUserModel: any = {
      modelName: 'User',
      schema: { path: jest.fn() },
    };
    const connection: any = {
      models: {
        User: sharedUserModel,
        Collection: collectionModel,
        CollectionFavorite: favoriteModel,
      },
    };
    const imageRecord = {
      url: 'https://cdn.example.com/gallery-1.jpg',
      originalObjectKey: 'gallery/owner.jpg',
    };
    const imageModel: any = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([imageRecord]) })),
      })),
    };
    const mobileImageModel: any = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
      })),
    };
    const minioService: any = {
      deleteService: jest.fn().mockResolvedValue(true),
    };
    // Keep the constructor dependencies mocked, not a live database or storage.
    const service = new UserService(
      userModel, imageModel, mobileImageModel,
      {} as any, {} as any, {} as any, {} as any, {} as any,
      connection, minioService,
    );
    return { service, userModel, collectionModel, favoriteModel, imageModel, minioService };
  }

  it('rejects an unconfirmed deletion without removing anything', async () => {
    const { service, userModel } = setup();
    await expect(service.deleteOwnAccount('owner-1', 'yes')).rejects.toThrow('Type DELETE');
    expect(userModel.deleteOne).not.toHaveBeenCalled();
  });

  it('rejects administrator deletion', async () => {
    const { service, userModel } = setup('admin');
    await expect(service.deleteOwnAccount('owner-1', 'DELETE')).rejects.toThrow(
      'Administrator accounts cannot be deleted',
    );
    expect(userModel.deleteOne).not.toHaveBeenCalled();
  });

  it('deletes only the authenticated user and their associated gallery data', async () => {
    const { service, userModel, collectionModel, favoriteModel, imageModel, minioService } = setup();
    await expect(service.deleteOwnAccount('owner-1', 'DELETE')).resolves.toEqual({
      message: 'Account deleted',
    });
    expect(collectionModel.deleteMany).toHaveBeenCalledWith({ userId: 'owner-1' });
    expect(favoriteModel.deleteMany).toHaveBeenCalledWith({
      collectionId: { $in: ['gallery-1'] },
    });
    expect(imageModel.find).toHaveBeenCalledWith({ userId: 'owner-1' });
    expect(minioService.deleteService).toHaveBeenCalledWith('gallery/owner.jpg');
    expect(userModel.deleteOne).toHaveBeenCalledWith({ _id: 'owner-1' });
  });
});

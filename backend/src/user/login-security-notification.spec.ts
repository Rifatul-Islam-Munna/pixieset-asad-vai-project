jest.mock(
  'src/collections/entities/collection-image.entity',
  () => ({ CollectionImage: class CollectionImage {} }),
  { virtual: true },
);
jest.mock(
  'src/mobile-gallery/entities/mobile-gallery-image.entity',
  () => ({ MobileGalleryImage: class MobileGalleryImage {} }),
  { virtual: true },
);
jest.mock(
  'src/admin/free-plan-setting.service',
  () => ({ FreePlanSettingService: class FreePlanSettingService {} }),
  { virtual: true },
);
jest.mock(
  'src/homepage/homepage.service',
  () => ({ HomepageService: class HomepageService {} }),
  { virtual: true },
);
jest.mock(
  'src/mail/mail.service',
  () => ({ MailService: class MailService {} }),
  { virtual: true },
);
jest.mock(
  'src/mail/system-notification-email',
  () => ({
    buildSystemNotificationEmail: (input: any) => ({
      subject: input.subject,
      text: JSON.stringify(input),
      html: JSON.stringify(input),
    }),
    describeUserAgent: () => 'Windows, Chrome 154',
    formatNotificationTime: () => 'October 5, 2026 at 12:00 PM (UTC)',
  }),
  { virtual: true },
);

import { UserService } from './user.service';

describe('login IP security notification', () => {
  function serviceFor(previous: any) {
    const lean = jest.fn().mockResolvedValue(previous);
    const select = jest.fn(() => ({ lean }));
    const findByIdAndUpdate = jest.fn(() => ({ select }));
    const userModel: any = { findByIdAndUpdate };
    const mail: any = {
      getWebsiteBranding: jest.fn().mockResolvedValue({
        brandText: 'Gallerista',
        logoUrl: 'https://cdn.example.com/gallerista-logo.png',
      }),
      send: jest.fn().mockResolvedValue({ sent: true, messageId: 'mail-login-1' }),
    };
    const config: any = {
      get: jest.fn((key: string) => (key === 'APP_NAME' ? 'Gallerista' : undefined)),
    };
    const service = new UserService(
      userModel,
      {} as any,
      {} as any,
      {} as any,
      config,
      {} as any,
      {} as any,
      mail,
    );
    return { service, userModel, mail };
  }

  it('emails the account owner when a successful login IP changes', async () => {
    const { service, mail, userModel } = serviceFor({
      email: 'owner@example.com',
      name: 'Owner',
      lastLoginIp: '198.51.100.10',
    });

    await (service as any).recordSuccessfulLogin('user-1', {
      ipAddress: '203.0.113.7',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
      location: 'Dhaka, Bangladesh',
    });

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-1',
      {
        $set: expect.objectContaining({
          lastLoginIp: '203.0.113.7',
          lastLoginUserAgent: expect.stringContaining('Chrome/154'),
          lastLoginAt: expect.any(Date),
        }),
      },
      { new: false },
    );
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe('owner@example.com');
    expect(mail.send.mock.calls[0][0].subject).toBe('New login to Gallerista');
    expect(mail.send.mock.calls[0][0].html).toContain('198.51.100.10');
    expect(mail.send.mock.calls[0][0].html).toContain('203.0.113.7');
    expect(mail.send.mock.calls[0][0].html).toContain('Dhaka, Bangladesh');
  });

  it('does not send an alert when the IP has not changed', async () => {
    const { service, mail } = serviceFor({
      email: 'owner@example.com',
      lastLoginIp: '203.0.113.7',
    });

    await (service as any).recordSuccessfulLogin('user-1', {
      ipAddress: '203.0.113.7',
      userAgent: 'Chrome',
    });

    expect(mail.send).not.toHaveBeenCalled();
  });

  it('does not block login when security tracking storage fails', async () => {
    const userModel: any = {
      findByIdAndUpdate: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn().mockRejectedValue(new Error('database unavailable')),
        })),
      })),
    };
    const service = new UserService(
      userModel,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
      {} as any,
      {} as any,
      { send: jest.fn() } as any,
    );

    await expect(
      (service as any).recordSuccessfulLogin('user-1', {
        ipAddress: '203.0.113.7',
      }),
    ).resolves.toBeUndefined();
  });
});

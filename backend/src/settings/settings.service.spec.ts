import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { DashboardSettingType } from './entities/dashboard-setting.entity';

describe('email template subject persistence', () => {
  const exec = jest.fn();
  const findOneAndUpdate = jest.fn().mockReturnValue({ lean: () => ({ exec }) });
  const service = new SettingsService(
    { findOneAndUpdate } as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    exec.mockReset().mockResolvedValue({ _id: 'setting-1' });
    findOneAndUpdate.mockClear();
  });

  it('persists the exact user subject, normalised for a safe email header', async () => {
    await service.upsert('owner-1', DashboardSettingType.EMAIL_TEMPLATE, {
      localId: 'my-template',
      name: 'Custom email',
      data: { subject: '  Your private gallery\r\nis ready  ', message: 'Hello!' },
    });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'owner-1', type: DashboardSettingType.EMAIL_TEMPLATE, localId: 'my-template' },
      expect.objectContaining({ $set: expect.objectContaining({
        data: { subject: 'Your private gallery is ready', message: 'Hello!' },
      }) }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('rejects missing, whitespace, and overlong subjects before writing', async () => {
    for (const subject of ['', '  \n ', 'x'.repeat(181)]) {
      await expect(service.upsert('owner-1', DashboardSettingType.EMAIL_TEMPLATE, {
        localId: 'my-template', name: 'Custom email', data: { subject },
      })).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not require a subject for unrelated dashboard settings', async () => {
    await service.upsert('owner-1', DashboardSettingType.PREFERENCE, {
      localId: 'general', name: 'Settings', data: { language: 'English' },
    });
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

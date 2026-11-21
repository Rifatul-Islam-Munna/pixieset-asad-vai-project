import { ConfigService } from '@nestjs/config';
import { BrandingEmailService } from './branding-email.service';

describe('branding email public logo URL', () => {
  it('uses the public backend URL for uploaded logos instead of a CID part', async () => {
    const mailService = { fetchInlineImage: jest.fn() };
    const settingModel = { findOne: jest.fn() };
    const config = new ConfigService({
      PUBLIC_API_URL: 'https://ai-photo-book-moment-backend.wrtsxa.easypanel.host',
      FRONTEND_URL: 'https://gallerista.app',
    });
    const service = new BrandingEmailService(settingModel as any, mailService as any, config);

    const result = await service.renderWithInlineAssets(
      {
        userId: 'owner',
        title: 'Your photos are ready',
        buttonText: 'Download all photos',
        buttonLink: 'https://gallerista.app/download/token',
      },
      { logoUrl: '/uploads/studio-logo.png', brandText: 'Studio Brand' },
    );

    expect(result.html).toContain(
      'src="https://ai-photo-book-moment-backend.wrtsxa.easypanel.host/uploads/studio-logo.png"',
    );
    expect(result.html).toContain('alt="Studio Brand"');
    expect(result.attachments).toHaveLength(0);
    expect(mailService.fetchInlineImage).not.toHaveBeenCalled();
  });

  it('keeps an already public HTTPS logo URL unchanged', async () => {
    const mailService = { fetchInlineImage: jest.fn() };
    const service = new BrandingEmailService(
      { findOne: jest.fn() } as any,
      mailService as any,
      new ConfigService({ FRONTEND_URL: 'https://gallerista.app' }),
    );

    const result = await service.renderWithInlineAssets(
      {
        userId: 'owner',
        title: 'Your photos are ready',
        buttonText: 'Download all photos',
        buttonLink: 'https://gallerista.app/download/token',
      },
      { logoUrl: 'https://cdn.example.test/studio-logo.png', brandText: 'Studio Brand' },
    );

    expect(result.html).toContain('src="https://cdn.example.test/studio-logo.png"');
    expect(result.attachments).toHaveLength(0);
    expect(mailService.fetchInlineImage).not.toHaveBeenCalled();
  });
});

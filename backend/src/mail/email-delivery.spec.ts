import { buildGalleryEmailHtml, emailInlineAsset } from '../../../frontend/lib/gallery-email';
import { hasInlineDataUri, sanitizeEmailHtml } from './html-guard';
import { buildBrandedGalleryEmailHtml } from './email-layout';

const hugeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAtwAAALcAAAAA' + 'A'.repeat(300_000);

const campaign = {
  previewText: 'Your gallery is still waiting for you.',
  eyebrowText: 'Client Gallery',
  title: 'YOUR GALLERY IS WAITING',
  message: 'Just a friendly reminder that your photo gallery is ready.',
  buttonText: 'Open Gallery',
  buttonLink: 'https://gallery.test/wedding',
  buttonColor: '#6337d8',
  footerText: "Questions? Reply to this email and we'll be happy to help.",
};

describe('delivered email body', () => {
  it('references the brand logo as a cid attachment instead of embedding base64', () => {
    const asset = emailInlineAsset(hugeDataUrl, 'gallery-logo');
    expect(asset.src).toBe('cid:gallery-logo');
    expect(asset.inline?.url).toBe(hugeDataUrl);

    const html = buildGalleryEmailHtml({ ...campaign, logoUrl: asset.src });
    expect(html).toContain('cid:gallery-logo');
    expect(hasInlineDataUri(html)).toBe(false);
    // Small enough that the mail controller never truncates it mid-tag.
    expect(html.length).toBeLessThan(5_000);
  });

  it('never ships an oversized base64 body even when a raw data url slips through', () => {
    const broken = buildGalleryEmailHtml({ ...campaign, logoUrl: hugeDataUrl });
    expect(broken.length).toBeGreaterThan(300_000);

    const guarded = sanitizeEmailHtml(broken);
    expect(hasInlineDataUri(guarded)).toBe(false);
    expect(guarded).not.toContain('iVBORw0KGgo');
    // The headline, message and button survive the strip.
    expect(guarded).toContain('YOUR GALLERY IS WAITING');
    expect(guarded).toContain('Open Gallery');
  });

  it('drops a logo the mailer cannot attach, keeping the rest of the design', () => {
    const html = buildBrandedGalleryEmailHtml(
      { userId: 'owner-1', ...campaign, imageUrl: 'https://cdn.test/cover.jpg' },
      { logoUrl: '', brandText: 'Asad Studio', accentColor: '#6337d8' },
    );
    expect(html).toContain('Asad Studio');
    expect(html).toContain('https://cdn.test/cover.jpg');
    expect(hasInlineDataUri(html)).toBe(false);
  });
});

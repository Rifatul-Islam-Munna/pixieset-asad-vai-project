import { buildBrandedGalleryEmailHtml, normalizeBlockOrder } from './email-layout';

const brand = { logoUrl: 'https://cdn.test/logo.png', brandText: 'Asad Studio', accentColor: '#6337d8' };

const payload = {
  userId: 'owner-1',
  previewText: 'Your gallery is waiting',
  eyebrowText: 'Client Gallery',
  title: 'YOUR GALLERY IS WAITING',
  message: 'Your gallery is ready to view.',
  buttonText: 'Open Gallery',
  buttonLink: 'https://gallery.test/wedding',
  footerText: 'Questions? Reply to this email.',
  imageUrl: 'https://cdn.test/cover.jpg',
};

const indexOfAll = (html: string, markers: string[]) => markers.map((marker) => html.indexOf(marker));

describe('email layout branding', () => {
  it('renders the studio logo, brand text and accent button color', () => {
    const html = buildBrandedGalleryEmailHtml(payload, brand);
    expect(html).toContain('https://cdn.test/logo.png');
    expect(html).toContain('Asad Studio');
    expect(html).toContain('background:#6337d8');
    expect(html).toContain('border-collapse:collapse;background:#ffffff');
  });

  it('drops the branding block when studio branding is disabled', () => {
    const html = buildBrandedGalleryEmailHtml({ ...payload, showBranding: false }, brand);
    expect(html).not.toContain('https://cdn.test/logo.png');
    expect(html).not.toContain('Asad Studio');
  });

  it('keeps the template button color when the brand accent is disabled', () => {
    const html = buildBrandedGalleryEmailHtml({ ...payload, useBrandColor: false, buttonColor: '#111111' }, brand);
    expect(html).toContain('background:#111111');
    expect(html).not.toContain('background:#6337d8');
  });

  it('renders the default block order', () => {
    const html = buildBrandedGalleryEmailHtml(payload, brand);
    const [branding, eyebrow, title, image, message, button, footer] = indexOfAll(html, [
      'cdn.test/logo.png',
      'Client Gallery',
      'YOUR GALLERY IS WAITING',
      'cdn.test/cover.jpg',
      'Your gallery is ready to view.',
      'Open Gallery',
      'Questions? Reply to this email.',
    ]);
    expect(branding).toBeGreaterThan(-1);
    expect(branding).toBeLessThan(eyebrow);
    expect(eyebrow).toBeLessThan(title);
    expect(title).toBeLessThan(image);
    expect(image).toBeLessThan(message);
    expect(message).toBeLessThan(button);
    expect(button).toBeLessThan(footer);
  });

  it('follows a dragged block order exactly', () => {
    const html = buildBrandedGalleryEmailHtml(
      {
        ...payload,
        blockOrder: ['title', 'branding', 'image', 'footer', 'message', 'eyebrow', 'button'],
      },
      brand,
    );
    const [title, branding, image, footer, message, eyebrow, button] = indexOfAll(html, [
      'YOUR GALLERY IS WAITING',
      'cdn.test/logo.png',
      'cdn.test/cover.jpg',
      'Questions? Reply to this email.',
      'Your gallery is ready to view.',
      'Client Gallery',
      'Open Gallery',
    ]);
    expect(title).toBeLessThan(branding);
    expect(branding).toBeLessThan(image);
    expect(image).toBeLessThan(footer);
    expect(footer).toBeLessThan(message);
    expect(message).toBeLessThan(eyebrow);
    expect(eyebrow).toBeLessThan(button);
  });

  it('falls back to the branding default order stored in settings', () => {
    const html = buildBrandedGalleryEmailHtml(payload, {
      ...brand,
      blockOrder: ['eyebrow', 'title', 'image', 'message', 'button', 'footer', 'branding'],
    });
    expect(html.indexOf('Open Gallery')).toBeLessThan(html.indexOf('cdn.test/logo.png'));
  });

  it('skips empty blocks and keeps the requested order for the rest', () => {
    const html = buildBrandedGalleryEmailHtml(
      { ...payload, eyebrowText: '', footerText: '', blockOrder: ['message', 'button', 'title'] },
      brand,
    );
    expect(html.indexOf('Your gallery is ready to view.')).toBeLessThan(html.indexOf('Open Gallery'));
    expect(html.indexOf('Open Gallery')).toBeLessThan(html.indexOf('YOUR GALLERY IS WAITING'));
  });

  it('normalizes partial or duplicated order values', () => {
    expect(normalizeBlockOrder(['button', 'button', 'nope'])).toEqual([
      'button',
      'branding',
      'eyebrow',
      'title',
      'image',
      'message',
      'footer',
    ]);
  });
});

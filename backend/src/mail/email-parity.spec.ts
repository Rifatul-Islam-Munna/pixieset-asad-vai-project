import { buildGalleryEmailHtml } from '../../../frontend/lib/gallery-email';
import { buildBrandedGalleryEmailHtml } from './email-layout';

const shared = {
  previewText: 'Your gallery is waiting',
  eyebrowText: 'Client Gallery',
  title: 'YOUR GALLERY IS WAITING',
  message: 'Your gallery is ready to view.\nSecond line.',
  buttonText: 'Open Gallery',
  buttonLink: 'https://gallery.test/wedding',
  buttonColor: '#6337d8',
  footerText: 'Questions? Reply to this email',
  imageUrl: 'https://cdn.test/cover.jpg',
  logoUrl: 'https://cdn.test/logo.png',
  brandText: 'Asad Studio',
};

const brand = {
  logoUrl: shared.logoUrl,
  brandText: shared.brandText,
  accentColor: '#6337d8',
};

const orders: (string[] | undefined)[] = [
  undefined,
  ['branding', 'eyebrow', 'title', 'image', 'message', 'button', 'footer'],
  ['title', 'branding', 'image', 'footer', 'message', 'eyebrow', 'button'],
  ['message', 'button', 'branding', 'title'],
  ['image', 'title', 'eyebrow'],
  ['branding', 'title', 'image', 'message', 'button', 'footer', 'eyebrow'],
];

const flagSets = [
  { showBranding: true, showImage: true },
  { showBranding: false, showImage: true },
  { showBranding: true, showImage: false },
  { showBranding: false, showImage: false },
];

describe('email layout parity with the dashboard preview', () => {
  it.each(orders.flatMap((order) => flagSets.map((flags) => [order, flags] as const)))(
    'renders identical html for order %j and flags %j',
    (order, flags) => {
      const preview = buildGalleryEmailHtml({ ...shared, ...flags, blockOrder: order });
      const delivered = buildBrandedGalleryEmailHtml(
        { userId: 'owner-1', ...shared, ...flags, blockOrder: order },
        brand,
      );
      expect(delivered).toBe(preview);
    },
  );
});

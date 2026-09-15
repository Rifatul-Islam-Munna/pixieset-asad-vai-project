export type BrandingEmailPosition = 'top' | 'bottom';

export type BrandingEmailBlockId =
  | 'branding'
  | 'eyebrow'
  | 'title'
  | 'image'
  | 'message'
  | 'button'
  | 'footer';

export const EMAIL_BLOCK_IDS: BrandingEmailBlockId[] = [
  'branding',
  'eyebrow',
  'title',
  'image',
  'message',
  'button',
  'footer',
];

export function normalizeBlockOrder(value: unknown): BrandingEmailBlockId[] {
  const raw = Array.isArray(value) ? value : [];
  const seen: BrandingEmailBlockId[] = [];
  for (const item of raw) {
    const id = String(item) as BrandingEmailBlockId;
    if (EMAIL_BLOCK_IDS.includes(id) && !seen.includes(id)) seen.push(id);
  }
  for (const id of EMAIL_BLOCK_IDS) {
    if (!seen.includes(id)) seen.push(id);
  }
  return seen;
}

export type BrandingEmailPayload = {
  userId: string;
  previewText?: string;
  eyebrowText?: string;
  title: string;
  message?: string;
  buttonText: string;
  buttonLink: string;
  buttonColor?: string;
  useBrandColor?: boolean;
  footerText?: string;
  imageUrl?: string;
  showImage?: boolean;
  showBranding?: boolean;
  blockOrder?: string[];
  brandingPosition?: BrandingEmailPosition;
};

export type BrandingEmailData = Record<string, any>;

const DEFAULT_BUTTON_COLOR = '#1f2937';

export function escapeBrandingEmailHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function emailLines(value: string) {
  return escapeBrandingEmailHtml(value).replace(/\r?\n/g, '<br>');
}

/** Matches the frontend gap matrix so the inbox equals the dashboard preview. */
function blockGap(block: BrandingEmailBlockId, prev: BrandingEmailBlockId | null): number {
  if (block === 'branding') return 38;
  if (!prev) return block === 'image' ? 0 : 42;
  const headerish = prev === 'branding' || prev === 'eyebrow' || prev === 'title';
  switch (block) {
    case 'eyebrow':
      if (prev === 'branding') return 26;
      if (prev === 'title') return 34;
      return 42;
    case 'title':
      if (prev === 'eyebrow') return 16;
      if (prev === 'branding') return 26;
      return 42;
    case 'image':
      return prev === 'message' || prev === 'button' || prev === 'footer' ? 42 : 38;
    case 'button':
      if (prev === 'message') return 30;
      return headerish ? 80 : 42;
    case 'footer':
      if (prev === 'message' || prev === 'button') return 34;
      return headerish ? 80 : 42;
    default:
      return headerish ? 80 : 42;
  }
}

function blockSidePadding(block: BrandingEmailBlockId) {
  if (block === 'image') return 0;
  if (block === 'message' || block === 'button' || block === 'footer') return 42;
  return 36;
}

function blockBottomPadding(block: BrandingEmailBlockId) {
  if (block === 'image') return 0;
  if (block === 'message' || block === 'button' || block === 'footer') return 36;
  return 38;
}

/**
 * Renders the exact same email layout as the frontend dashboard preview
 * (frontend/lib/gallery-email.ts -> buildGalleryEmailHtml), including the
 * dragged block order, so the inbox is identical to what the user designed.
 */
export function buildBrandedGalleryEmailHtml(input: BrandingEmailPayload, brand: BrandingEmailData) {
  const showBranding = input.showBranding !== false;
  const showImage = input.showImage !== false;
  const logo = showBranding ? String(brand.logoUrl || brand.logo || '').trim() : '';
  const brandText = showBranding ? String(brand.brandText || brand.brandName || brand.name || '').trim() : '';
  const image = showImage ? String(input.imageUrl ?? '').trim() : '';
  const eyebrow = String(input.eyebrowText ?? '').trim();
  const previewText = String(input.previewText ?? '').trim();
  const title = String(input.title || 'Your photos').trim();
  const message = String(input.message ?? '').trim();
  const buttonText = String(input.buttonText || 'View Gallery').trim();
  const buttonLink = String(input.buttonLink || '#').trim();
  const footerText = String(input.footerText ?? '').trim();

  const accentColor = /^#[0-9a-f]{6}$/i.test(String(brand.accentColor || brand.buttonColor || ''))
    ? String(brand.accentColor || brand.buttonColor)
    : '';
  const useBrandColor = input.useBrandColor !== false;
  const validInputColor = /^#[0-9a-f]{6}$/i.test(String(input.buttonColor || ''))
    ? String(input.buttonColor)
    : '';
  const buttonColor = useBrandColor
    ? accentColor || validInputColor || DEFAULT_BUTTON_COLOR
    : validInputColor || DEFAULT_BUTTON_COLOR;

  const legacyOrder: BrandingEmailBlockId[] =
    input.brandingPosition === 'bottom'
      ? (EMAIL_BLOCK_IDS.filter((id) => id !== 'branding') as BrandingEmailBlockId[]).concat('branding')
      : EMAIL_BLOCK_IDS;
  const requested = Array.isArray(input.blockOrder) && input.blockOrder.length ? input.blockOrder : brand.blockOrder;
  const order =
    Array.isArray(requested) && requested.length ? normalizeBlockOrder(requested) : legacyOrder;

  const available: Record<BrandingEmailBlockId, boolean> = {
    branding: Boolean(logo || brandText),
    eyebrow: Boolean(eyebrow),
    title: Boolean(title),
    image: Boolean(image),
    message: Boolean(message),
    button: Boolean(buttonText),
    footer: Boolean(footerText),
  };
  const rendered = order.filter((id) => available[id]);
  const lastBlock = rendered[rendered.length - 1] ?? null;

  const blockHtml = (block: BrandingEmailBlockId, prev: BrandingEmailBlockId | null) => {
    const top = blockGap(block, prev);
    const side = blockSidePadding(block);
    const bottom = block === lastBlock ? blockBottomPadding(block) : 0;
    const padding = `${top}px ${side}px ${bottom}px`;
    if (block === 'branding') {
      return `<tr>
          <td align="center" style="padding:${padding}">
            ${logo ? `<img src="${escapeBrandingEmailHtml(logo)}" alt="${escapeBrandingEmailHtml(brandText)}" style="display:block;width:auto;max-width:180px;max-height:56px;margin:0 auto;border:0;outline:none;text-decoration:none">` : ''}
            ${brandText ? `<div style="margin-top:${logo ? '16px' : '0'};font-size:11px;line-height:18px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#565656">${escapeBrandingEmailHtml(brandText)}</div>` : ''}
          </td>
        </tr>`;
    }
    if (block === 'eyebrow') {
      return `<tr>
          <td align="center" style="padding:${padding}">
            <div style="font-size:10px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#96918b">${escapeBrandingEmailHtml(eyebrow)}</div>
          </td>
        </tr>`;
    }
    if (block === 'title') {
      return `<tr>
          <td align="center" style="padding:${padding}">
            <h1 style="margin:0;font-size:28px;line-height:38px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:#2f2f2f">${escapeBrandingEmailHtml(title)}</h1>
          </td>
        </tr>`;
    }
    if (block === 'image') {
      return `<tr>
          <td style="padding:${padding}">
            <img src="${escapeBrandingEmailHtml(image)}" alt="" width="680" style="display:block;width:100%;height:auto;max-height:520px;object-fit:cover;border:0;outline:none;text-decoration:none">
          </td>
        </tr>`;
    }
    if (block === 'message') {
      return `<tr>
          <td align="center" style="padding:${padding}">
            <div style="max-width:520px;margin:0 auto;font-size:15px;line-height:27px;color:#585858;text-align:left">${emailLines(message)}</div>
          </td>
        </tr>`;
    }
    if (block === 'button') {
      return `<tr>
          <td align="center" style="padding:${padding}">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;border-collapse:collapse">
              <tr>
                <td align="center" bgcolor="${escapeBrandingEmailHtml(buttonColor)}" style="background:${escapeBrandingEmailHtml(buttonColor)}">
                  <a href="${escapeBrandingEmailHtml(buttonLink)}" style="display:inline-block;padding:15px 34px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeBrandingEmailHtml(buttonText)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }
    return `<tr>
          <td align="center" style="padding:${padding}">
            <div style="max-width:520px;margin:0 auto;font-size:11px;line-height:19px;color:#7a7a7a">${emailLines(footerText)}</div>
          </td>
        </tr>`;
  };

  const blocks = rendered
    .map((block, index) => blockHtml(block, index === 0 ? null : rendered[index - 1]))
    .join('');

  return `<div style="margin:0;background:#f3f2ef;padding:36px 16px;font-family:Arial,Helvetica,sans-serif;color:#202020">
    ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeBrandingEmailHtml(previewText)}</div>` : ''}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f3f2ef">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;border-collapse:collapse;background:#ffffff">
            ${blocks}
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

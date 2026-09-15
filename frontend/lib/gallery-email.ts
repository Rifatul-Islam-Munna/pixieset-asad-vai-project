export const EMAIL_BLOCK_IDS = [
  "branding",
  "eyebrow",
  "title",
  "image",
  "message",
  "button",
  "footer",
] as const;

export type GalleryEmailBlockId = (typeof EMAIL_BLOCK_IDS)[number];

export const EMAIL_DEFAULT_BLOCK_ORDER: GalleryEmailBlockId[] = [
  ...EMAIL_BLOCK_IDS,
];

export const EMAIL_BLOCK_LABELS: Record<GalleryEmailBlockId, string> = {
  branding: "Branding logo + studio name",
  eyebrow: "Small label / eyebrow",
  title: "Headline",
  image: "Hero image",
  message: "Message text",
  button: "Button",
  footer: "Footer text",
};

export function isEmailBlockId(value: unknown): value is GalleryEmailBlockId {
  return (EMAIL_BLOCK_IDS as readonly string[]).includes(String(value));
}

/** Keeps the dragged order, adds any missing blocks at the end, drops duplicates. */
export function normalizeBlockOrder(value: unknown): GalleryEmailBlockId[] {
  const raw = Array.isArray(value) ? value : [];
  const seen: GalleryEmailBlockId[] = [];
  for (const item of raw) {
    if (isEmailBlockId(item) && !seen.includes(item)) seen.push(item);
  }
  for (const id of EMAIL_DEFAULT_BLOCK_ORDER) {
    if (!seen.includes(id)) seen.push(id);
  }
  return seen;
}

export type GalleryEmailHtmlInput = {
  previewText?: string;
  eyebrowText?: string;
  title: string;
  message: string;
  buttonText: string;
  buttonLink: string;
  buttonColor: string;
  footerText?: string;
  logoUrl?: string;
  brandText?: string;
  imageUrl?: string;
  showBranding?: boolean;
  showImage?: boolean;
  blockOrder?: string[];
  /** Legacy placement flag, used only when no block order is provided. */
  brandingPosition?: "top" | "bottom";
};

export type GalleryEmailBrandingPosition = "top" | "bottom";

export function normalizeBrandingPosition(value: unknown): GalleryEmailBrandingPosition {
  return value === "bottom" ? "bottom" : "top";
}

export function escapeEmailHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailLines(value: string) {
  return escapeEmailHtml(value).replace(/\r?\n/g, "<br>");
}

export function canInlineEmailAsset(value: string) {
  return /^(https?:\/\/|data:image\/)/i.test(String(value ?? "").trim());
}

/**
 * Vertical gap (in px) between two stacked blocks. The matrix reproduces the
 * original fixed layout for the default order, and composes for any drag order.
 */
function blockGap(
  block: GalleryEmailBlockId,
  prev: GalleryEmailBlockId | null,
): number {
  if (block === "branding") return 38;
  if (!prev) return block === "image" ? 0 : 42;
  const headerish = prev === "branding" || prev === "eyebrow" || prev === "title";
  switch (block) {
    case "eyebrow":
      if (prev === "branding") return 26;
      if (prev === "title") return 34;
      return 42;
    case "title":
      if (prev === "eyebrow") return 16;
      if (prev === "branding") return 26;
      return 42;
    case "image":
      return prev === "message" || prev === "button" || prev === "footer" ? 42 : 38;
    case "button":
      if (prev === "message") return 30;
      return headerish ? 80 : 42;
    case "footer":
      if (prev === "message" || prev === "button") return 34;
      return headerish ? 80 : 42;
    default:
      // message
      return headerish ? 80 : 42;
  }
}

function blockSidePadding(block: GalleryEmailBlockId) {
  if (block === "image") return 0;
  if (block === "message" || block === "button" || block === "footer") return 42;
  return 36;
}

function blockBottomPadding(block: GalleryEmailBlockId) {
  if (block === "image") return 0;
  if (block === "message" || block === "button" || block === "footer") return 36;
  return 38;
}

export function buildGalleryEmailHtml(input: GalleryEmailHtmlInput) {
  const showBranding = input.showBranding !== false;
  const showImage = input.showImage !== false;
  const logo = showBranding ? String(input.logoUrl ?? "").trim() : "";
  const brandText = showBranding ? String(input.brandText ?? "").trim() : "";
  const image = showImage ? String(input.imageUrl ?? "").trim() : "";
  const eyebrow = String(input.eyebrowText ?? "").trim();
  const previewText = String(input.previewText ?? "").trim();
  const title = String(input.title || "Your photos").trim();
  const message = String(input.message ?? "").trim();
  const buttonText = String(input.buttonText || "View Gallery").trim();
  const buttonLink = String(input.buttonLink || "#").trim();
  const buttonColor = /^#[0-9a-f]{6}$/i.test(input.buttonColor)
    ? input.buttonColor
    : "#1f2937";
  const footerText = String(input.footerText ?? "").trim();

  const legacyOrder =
    normalizeBrandingPosition(input.brandingPosition) === "bottom"
      ? (EMAIL_DEFAULT_BLOCK_ORDER.filter(
          (id) => id !== "branding",
        ) as GalleryEmailBlockId[]).concat("branding")
      : EMAIL_DEFAULT_BLOCK_ORDER;
  const order =
    Array.isArray(input.blockOrder) && input.blockOrder.length
      ? normalizeBlockOrder(input.blockOrder)
      : legacyOrder;

  const available: Record<GalleryEmailBlockId, boolean> = {
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

  const blockHtml = (block: GalleryEmailBlockId, prev: GalleryEmailBlockId | null) => {
    const top = blockGap(block, prev);
    const side = blockSidePadding(block);
    const bottom = block === lastBlock ? blockBottomPadding(block) : 0;
    const padding = `${top}px ${side}px ${bottom}px`;
    if (block === "branding") {
      return `<tr>
          <td align="center" style="padding:${padding}">
            ${logo ? `<img src="${escapeEmailHtml(logo)}" alt="${escapeEmailHtml(brandText)}" style="display:block;width:auto;max-width:180px;max-height:56px;margin:0 auto;border:0;outline:none;text-decoration:none">` : ""}
            ${brandText ? `<div style="margin-top:${logo ? "16px" : "0"};font-size:11px;line-height:18px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#565656">${escapeEmailHtml(brandText)}</div>` : ""}
          </td>
        </tr>`;
    }
    if (block === "eyebrow") {
      return `<tr>
          <td align="center" style="padding:${padding}">
            <div style="font-size:10px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#96918b">${escapeEmailHtml(eyebrow)}</div>
          </td>
        </tr>`;
    }
    if (block === "title") {
      return `<tr>
          <td align="center" style="padding:${padding}">
            <h1 style="margin:0;font-size:28px;line-height:38px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:#2f2f2f">${escapeEmailHtml(title)}</h1>
          </td>
        </tr>`;
    }
    if (block === "image") {
      return `<tr>
          <td style="padding:${padding}">
            <img src="${escapeEmailHtml(image)}" alt="" width="680" style="display:block;width:100%;height:auto;max-height:520px;object-fit:cover;border:0;outline:none;text-decoration:none">
          </td>
        </tr>`;
    }
    if (block === "message") {
      return `<tr>
          <td align="center" style="padding:${padding}">
            <div style="max-width:520px;margin:0 auto;font-size:15px;line-height:27px;color:#585858;text-align:left">${emailLines(message)}</div>
          </td>
        </tr>`;
    }
    if (block === "button") {
      return `<tr>
          <td align="center" style="padding:${padding}">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;border-collapse:collapse">
              <tr>
                <td align="center" bgcolor="${escapeEmailHtml(buttonColor)}" style="background:${escapeEmailHtml(buttonColor)}">
                  <a href="${escapeEmailHtml(buttonLink)}" style="display:inline-block;padding:15px 34px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeEmailHtml(buttonText)}</a>
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
    .join("");

  return `<div style="margin:0;background:#f3f2ef;padding:36px 16px;font-family:Arial,Helvetica,sans-serif;color:#202020">
    ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(previewText)}</div>` : ""}
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

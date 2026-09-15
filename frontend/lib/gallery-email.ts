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
};

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

  const brandingBlock =
    logo || brandText
      ? `<tr>
          <td align="center" style="padding:38px 36px 0">
            ${logo ? `<img src="${escapeEmailHtml(logo)}" alt="${escapeEmailHtml(brandText)}" style="display:block;width:auto;max-width:180px;max-height:56px;margin:0 auto;border:0;outline:none;text-decoration:none">` : ""}
            ${brandText ? `<div style="margin-top:${logo ? "16px" : "0"};font-size:11px;line-height:18px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#565656">${escapeEmailHtml(brandText)}</div>` : ""}
          </td>
        </tr>`
      : "";

  const imageBlock = image
    ? `<tr>
        <td style="padding:0">
          <img src="${escapeEmailHtml(image)}" alt="" width="680" style="display:block;width:100%;height:auto;max-height:520px;object-fit:cover;border:0;outline:none;text-decoration:none">
        </td>
      </tr>`
    : "";

  return `<div style="margin:0;background:#f3f2ef;padding:36px 16px;font-family:Arial,Helvetica,sans-serif;color:#202020">
    ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(previewText)}</div>` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f3f2ef">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;border-collapse:collapse;background:#ffffff">
            ${brandingBlock}
            <tr>
              <td align="center" style="padding:${brandingBlock ? "26px" : "42px"} 36px 38px">
                ${eyebrow ? `<div style="margin:0 0 16px;font-size:10px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#96918b">${escapeEmailHtml(eyebrow)}</div>` : ""}
                <h1 style="margin:0;font-size:28px;line-height:38px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:#2f2f2f">${escapeEmailHtml(title)}</h1>
              </td>
            </tr>
            ${imageBlock}
            <tr>
              <td align="center" style="padding:42px 42px 36px">
                ${message ? `<div style="max-width:520px;margin:0 auto;font-size:15px;line-height:27px;color:#585858;text-align:left">${emailLines(message)}</div>` : ""}
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:${message ? "30px" : "0"} auto 0;border-collapse:collapse">
                  <tr>
                    <td align="center" bgcolor="${escapeEmailHtml(buttonColor)}" style="background:${escapeEmailHtml(buttonColor)}">
                      <a href="${escapeEmailHtml(buttonLink)}" style="display:inline-block;padding:15px 34px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeEmailHtml(buttonText)}</a>
                    </td>
                  </tr>
                </table>
                ${footerText ? `<div style="margin:34px 0 0;font-size:11px;line-height:19px;color:#7a7a7a">${emailLines(footerText)}</div>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

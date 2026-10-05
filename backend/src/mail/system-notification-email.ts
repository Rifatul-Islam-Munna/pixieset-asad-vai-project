export type SystemNotificationDetail = {
  label: string;
  value: string;
};

export type SystemNotificationEmailInput = {
  brand?: string;
  logoUrl?: string;
  subject: string;
  heading: string;
  intro: string;
  accountEmail?: string;
  details?: SystemNotificationDetail[];
  warning?: string;
  actionText?: string;
  actionUrl?: string;
  footerText?: string;
};

export function buildSystemNotificationEmail(input: SystemNotificationEmailInput) {
  const brand = String(input.brand || 'Gallerista').trim() || 'Gallerista';
  const logoUrl = safeImageUrl(input.logoUrl);
  const brandHeader = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brand)}" style="display:block;max-width:190px;max-height:58px;width:auto;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none">`
    : escapeHtml(brand.toUpperCase());
  const details = (input.details ?? [])
    .filter((item) => String(item.value ?? '').trim())
    .map((item) => ({
      label: String(item.label ?? '').trim(),
      value: String(item.value ?? '').trim(),
    }));

  const intro = escapeHtml(input.intro).replace(/[.\s]+$/, '');
  const accountLine = input.accountEmail
    ? `${intro} (<a href="mailto:${escapeHtml(input.accountEmail)}" style="color:#0b63ce">${escapeHtml(input.accountEmail)}</a>).`
    : `${intro}.`;

  const rows = details
    .map(
      (item) =>
        `<tr><td style="padding:5px 10px 5px 0;color:#6a6a6a;vertical-align:top;white-space:nowrap">${escapeHtml(item.label)}:</td><td style="padding:5px 0;color:#555;font-weight:600;vertical-align:top">${escapeHtml(item.value)}</td></tr>`,
    )
    .join('');

  const action =
    input.actionText && input.actionUrl
      ? `<p style="margin:26px 0 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#00aa91;color:#fff;text-decoration:none;padding:11px 16px;border-radius:3px;font-weight:600">${escapeHtml(input.actionText)}</a></p>`
      : '';

  const warning = input.warning
    ? `<p style="margin:28px 0 0;line-height:1.65;color:#666">${linkSecurityWords(input.warning)}</p>`
    : '';

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f5f7;font-family:Arial,Helvetica,sans-serif;color:#555">
    <div style="max-width:640px;margin:0 auto;background:#fff;min-height:100vh">
      <div style="height:18px;background:#e8edf1"></div>
      <div style="padding:24px 34px 18px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:21px;letter-spacing:${logoUrl ? '0' : '10px'};color:#3f3f3f">${brandHeader}</div>
      <div style="padding:38px 48px 54px">
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.25;font-weight:400;color:#3d3d3d">${escapeHtml(input.heading)}</h1>
        <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#666">${accountLine}</p>
        ${rows ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:15px">${rows}</table>` : ''}
        ${warning}
        ${action}
        <p style="margin:44px 0 0;font-size:12px;color:#929292">${escapeHtml(input.footerText || 'Have a question? Contact support.')}</p>
      </div>
      <div style="border-top:1px solid #ececec;padding:28px 48px 42px;font-size:12px;line-height:1.65;color:#999">
        Copyright © ${new Date().getFullYear()} ${escapeHtml(brand)}. All rights reserved.<br>
        You’re receiving this email because you have an account on ${escapeHtml(brand)}.
      </div>
    </div>
  </body>
</html>`;

  const text = [
    input.heading,
    '',
    input.accountEmail
      ? `${String(input.intro).replace(/[.\s]+$/, '')} (${input.accountEmail}).`
      : input.intro,
    '',
    ...details.map((item) => `${item.label}: ${item.value}`),
    ...(input.warning ? ['', input.warning] : []),
    ...(input.actionUrl ? ['', `${input.actionText || 'Open'}: ${input.actionUrl}`] : []),
    '',
    input.footerText || 'Have a question? Contact support.',
  ].join('\n');

  return {
    subject: sanitizeHeader(input.subject),
    html,
    text,
  };
}

export function formatNotificationTime(value: Date = new Date()) {
  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(value)} (UTC)`;
}

export function describeUserAgent(userAgent?: string) {
  const ua = String(userAgent ?? '').trim();
  if (!ua) return 'Unknown device';
  const lower = ua.toLowerCase();

  const os = lower.includes('windows')
    ? 'Windows'
    : lower.includes('android')
      ? 'Android'
      : lower.includes('iphone') || lower.includes('ipad')
        ? 'iOS'
        : lower.includes('macintosh') || lower.includes('mac os')
          ? 'Mac'
          : lower.includes('linux')
            ? 'Linux'
            : 'Unknown OS';

  let browser = 'Browser';
  let version = '';
  const candidates: Array<[string, RegExp, string]> = [
    ['Edge', /edg\/([\d.]+)/i, 'Edge'],
    ['Chrome', /chrome\/([\d.]+)/i, 'Chrome'],
    ['Firefox', /firefox\/([\d.]+)/i, 'Firefox'],
    ['Safari', /version\/([\d.]+).*safari/i, 'Safari'],
  ];
  for (const [, expression, name] of candidates) {
    const match = ua.match(expression);
    if (match) {
      browser = name;
      version = match[1]?.split('.')[0] || '';
      break;
    }
  }

  return `${os}, ${browser}${version ? ` ${version}` : ''}`;
}

function linkSecurityWords(value: string) {
  const escaped = escapeHtml(value);
  return escaped.replace(
    /change your password immediately/gi,
    '<span style="color:#00a98f;font-weight:600">change your password immediately</span>',
  );
}

function sanitizeHeader(value: string) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function safeImageUrl(value?: string) {
  const raw = String(value ?? '').trim();
  return /^(https?:\/\/|cid:|data:image\/)/i.test(raw) ? raw : '';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

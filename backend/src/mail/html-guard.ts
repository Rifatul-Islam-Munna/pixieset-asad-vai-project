/**
 * Email clients (Gmail included) refuse to render `data:` image sources, and a
 * multi-megabyte base64 payload inside the body is what turns a designed email
 * into a wall of raw markup. Every attachment must travel as a CID part instead.
 *
 * This guard is the last line of defence: any remaining `data:` URI in an
 * outgoing HTML body is stripped rather than delivered.
 */
export function sanitizeEmailHtml(value: unknown) {
  let html = String(value ?? '').trim();
  if (!html) return html;
  // src="data:..." / href="data:..." attributes (quoted, any case)
  html = html.replace(
    /\s(src|href)\s*=\s*(["'])data:[^"']*\2/gi,
    (_match, attribute: string) => ` ${attribute}=""`,
  );
  // Unquoted variants and CSS url(data:...)
  html = html.replace(/\s(src|href)\s*=\s*data:[^\s>]*/gi, (_match, attribute: string) => ` ${attribute}=""`);
  html = html.replace(/url\(\s*["']?data:[^)]*\)/gi, 'url()');
  return html;
}

/** True when the HTML carries a data: URI that clients cannot render. */
export function hasInlineDataUri(value: unknown) {
  return /(src|href)\s*=\s*["']?data:/i.test(String(value ?? ''));
}

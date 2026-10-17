/**
 * Show useful public error messages without leaking internal image storage
 * vendors or delivery engines through UI alerts and upload status areas.
 * This is presentation-only: actual API requests and storage stay unchanged.
 */
const internalStorageTerms = /\b(?:r2|cloudflare|imagor|imgproxy|s3)\b|cloudflarestorage\.com/i;

export function customerFacingStorageMessage(
  message: unknown,
  fallback: string,
): string {
  if (typeof message !== "string") return fallback;
  const clean = message.trim();
  return clean && !internalStorageTerms.test(clean) ? clean : fallback;
}

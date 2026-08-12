export const GALLERY_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Greek",
  "Arabic",
] as const;

export type GalleryLanguage = (typeof GALLERY_LANGUAGES)[number];

const LANGUAGE_CODES: Record<GalleryLanguage, string> = {
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Greek: "el",
  Arabic: "ar",
};

export function normalizeGalleryLanguage(value?: string): GalleryLanguage {
  return GALLERY_LANGUAGES.includes(value as GalleryLanguage)
    ? (value as GalleryLanguage)
    : "English";
}

export function galleryLanguageCode(value?: string) {
  return LANGUAGE_CODES[normalizeGalleryLanguage(value)];
}

export const GALLERY_FONT_CATEGORIES = ["English", "Greek", "Cyrillic", "Deutsch", "Arabic"] as const;
export type GalleryFontCategory = (typeof GALLERY_FONT_CATEGORIES)[number];

export type GalleryFontOption = {
  name: string;
  family: string;
  categories: GalleryFontCategory[];
};

export const GALLERY_FONT_SAMPLES: Record<GalleryFontCategory, string> = {
  English: "Beautiful Stories",
  Greek: "Όμορφες Ιστορίες",
  Cyrillic: "Красивые истории",
  Deutsch: "Schöne Geschichten",
  Arabic: "قصص جميلة",
};

export const GALLERY_FONT_OPTIONS: GalleryFontOption[] = [
  { name: "Manrope", family: "var(--font-sans)", categories: ["English", "Greek", "Deutsch"] },
  { name: "Noto Sans", family: "var(--font-greek-sans)", categories: ["English", "Greek", "Cyrillic", "Deutsch"] },
  { name: "Noto Serif", family: "var(--font-greek-serif)", categories: ["English", "Greek", "Cyrillic", "Deutsch"] },
  { name: "Noto Sans Arabic", family: "var(--font-arabic-sans)", categories: ["Arabic"] },
  { name: "Noto Naskh Arabic", family: "var(--font-arabic-serif)", categories: ["Arabic"] },
  { name: "Georgia", family: "Georgia", categories: ["English", "Deutsch"] },
  { name: "Times New Roman", family: "'Times New Roman'", categories: ["English", "Greek", "Cyrillic", "Deutsch"] },
  { name: "Arial", family: "Arial", categories: ["English", "Greek", "Cyrillic", "Deutsch", "Arabic"] },
  { name: "Helvetica", family: "Helvetica", categories: ["English", "Deutsch"] },
];

export function resolveGalleryFontFamily(name: string | undefined, fallback: string) {
  const clean = String(name ?? "").trim();
  if (!clean) return fallback;
  const builtIn = GALLERY_FONT_OPTIONS.find((font) => font.name === clean);
  return builtIn ? `${builtIn.family}, ${fallback}` : `"${clean.replace(/"/g, "")}", ${fallback}`;
}

export function galleryFontSample(category: GalleryFontCategory | "All") {
  return category === "All" ? GALLERY_FONT_SAMPLES.English : GALLERY_FONT_SAMPLES[category];
}

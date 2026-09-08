export const CLIENT_GALLERY_CATEGORIES = [
  "Wedding",
  "Pre wedding",
  "Baptism",
  "Party",
  "Event",
  "Birthday party",
  "Portrait session",
  "Fashion",
  "Sports",
  "Family",
  "Travel",
  "Editorial",
  "Commercial",
  "Food styling",
  "Architecture",
  "Custom label",
] as const;

export type ClientGalleryCategory = (typeof CLIENT_GALLERY_CATEGORIES)[number];

export const DEFAULT_CLIENT_GALLERY_CATEGORY: ClientGalleryCategory = "Wedding";

export function isClientGalleryCategory(value?: string): value is ClientGalleryCategory {
  return CLIENT_GALLERY_CATEGORIES.includes(value as ClientGalleryCategory);
}

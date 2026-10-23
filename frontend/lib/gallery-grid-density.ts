/**
 * Photo sizes are intentionally different at desktop widths.
 * Regular is the densest / smallest preset, Large is medium, Extra Large is largest.
 * Keep public and dashboard previews in sync by using this shared mapping.
 */
export type GalleryPhotoSize = "Regular" | "Large" | "Extra Large";

export const GALLERY_GRID_DENSITY = {
  Regular: {
    desktopColumns: 5,
    masonryBreakpoints: { 0: 2, 640: 3, 768: 4, 1024: 5 },
    masonrySkeleton: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    classic: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    editorMasonryColumns: 5,
    editorClassic: "grid-cols-6",
    imageSizes: "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw",
  },
  Large: {
    desktopColumns: 4,
    masonryBreakpoints: { 0: 1, 640: 2, 1024: 3, 1280: 4 },
    masonrySkeleton: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    classic: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    editorMasonryColumns: 4,
    editorClassic: "grid-cols-4",
    imageSizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw",
  },
  "Extra Large": {
    desktopColumns: 2,
    masonryBreakpoints: { 0: 1, 640: 2 },
    masonrySkeleton: "grid-cols-1 sm:grid-cols-2",
    classic: "grid-cols-1 sm:grid-cols-2",
    editorMasonryColumns: 2,
    editorClassic: "grid-cols-2",
    imageSizes: "(max-width: 640px) 100vw, 50vw",
  },
} as const;

export function galleryGridDensity(size?: string) {
  if (size === "Regular" || size === "Large" || size === "Extra Large") {
    return GALLERY_GRID_DENSITY[size];
  }
  return GALLERY_GRID_DENSITY.Regular;
}

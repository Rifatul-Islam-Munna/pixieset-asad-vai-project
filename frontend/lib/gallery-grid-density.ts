/**
 * Photo sizes are intentionally different at desktop widths.
 * Regular is the densest / smallest preset, Large is medium, Extra Large is largest.
 * Keep public and dashboard previews in sync by using this shared mapping.
 */
export type GalleryPhotoSize = "Regular" | "Large" | "Extra Large";

export const GALLERY_GRID_DENSITY = {
  Regular: {
    desktopColumns: 6,
    masonry: "columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6",
    classic: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    editorMasonry: "columns-6",
    editorClassic: "grid-cols-6",
    imageSizes: "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 17vw",
  },
  Large: {
    desktopColumns: 4,
    masonry: "columns-1 sm:columns-2 lg:columns-3 xl:columns-4",
    classic: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    editorMasonry: "columns-4",
    editorClassic: "grid-cols-4",
    imageSizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw",
  },
  "Extra Large": {
    desktopColumns: 2,
    masonry: "columns-1 sm:columns-2",
    classic: "grid-cols-1 sm:grid-cols-2",
    editorMasonry: "columns-2",
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

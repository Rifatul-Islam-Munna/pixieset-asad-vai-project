import test from "node:test";
import assert from "node:assert/strict";
import { GALLERY_GRID_DENSITY, galleryGridDensity } from "../lib/gallery-grid-density.ts";

test("Regular is visibly smaller than Large on desktop", () => {
  const regular = galleryGridDensity("Regular");
  const large = galleryGridDensity("Large");
  const extraLarge = galleryGridDensity("Extra Large");

  assert.ok(regular.desktopColumns > large.desktopColumns);
  assert.ok(large.desktopColumns > extraLarge.desktopColumns);
  assert.equal(regular.desktopColumns, 5);
  assert.equal(large.desktopColumns, 4);
  assert.equal(extraLarge.desktopColumns, 2);
});

test("Regular masonry matches the five-column reference and live preview", () => {
  const regular = GALLERY_GRID_DENSITY.Regular;
  assert.deepEqual(regular.masonryBreakpoints, { 0: 2, 640: 3, 768: 4, 1024: 5 });
  assert.match(regular.masonrySkeleton, /lg:grid-cols-5/);
  assert.match(regular.classic, /xl:grid-cols-6/);
  assert.equal(regular.editorMasonryColumns, 5);
  assert.equal(regular.editorClassic, "grid-cols-6");
  assert.match(regular.imageSizes, /20vw/);
});

test("Saved size values remain compatible and unknown values have a safe fallback", () => {
  assert.equal(galleryGridDensity("Large"), GALLERY_GRID_DENSITY.Large);
  assert.equal(galleryGridDensity("Extra Large"), GALLERY_GRID_DENSITY["Extra Large"]);
  assert.equal(galleryGridDensity(), GALLERY_GRID_DENSITY.Regular);
  assert.equal(galleryGridDensity("unknown"), GALLERY_GRID_DENSITY.Regular);
});

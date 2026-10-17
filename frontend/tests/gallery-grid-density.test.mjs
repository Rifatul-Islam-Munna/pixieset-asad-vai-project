import test from "node:test";
import assert from "node:assert/strict";
import { GALLERY_GRID_DENSITY, galleryGridDensity } from "../lib/gallery-grid-density.ts";

test("Regular is visibly smaller than Large on desktop", () => {
  const regular = galleryGridDensity("Regular");
  const large = galleryGridDensity("Large");
  const extraLarge = galleryGridDensity("Extra Large");

  assert.ok(regular.desktopColumns > large.desktopColumns);
  assert.ok(large.desktopColumns > extraLarge.desktopColumns);
  assert.equal(regular.desktopColumns, 6);
  assert.equal(large.desktopColumns, 4);
  assert.equal(extraLarge.desktopColumns, 2);
});

test("Regular uses responsive columns, compact image sizes and matching live previews", () => {
  const regular = GALLERY_GRID_DENSITY.Regular;
  assert.match(regular.masonry, /columns-2/);
  assert.match(regular.masonry, /sm:columns-3/);
  assert.match(regular.masonry, /lg:columns-5/);
  assert.match(regular.masonry, /xl:columns-6/);
  assert.match(regular.classic, /xl:grid-cols-6/);
  assert.equal(regular.editorMasonry, "columns-6");
  assert.equal(regular.editorClassic, "grid-cols-6");
  assert.match(regular.imageSizes, /17vw/);
});

test("Saved size values remain compatible and unknown values have a safe fallback", () => {
  assert.equal(galleryGridDensity("Large"), GALLERY_GRID_DENSITY.Large);
  assert.equal(galleryGridDensity("Extra Large"), GALLERY_GRID_DENSITY["Extra Large"]);
  assert.equal(galleryGridDensity(), GALLERY_GRID_DENSITY.Regular);
  assert.equal(galleryGridDensity("unknown"), GALLERY_GRID_DENSITY.Regular);
});

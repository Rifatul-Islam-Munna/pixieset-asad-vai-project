import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GALLERY_FONT_CATEGORIES,
  GALLERY_FONT_OPTIONS,
  GALLERY_FONT_SAMPLES,
  galleryFontSample,
  resolveGalleryFontFamily,
} from "../lib/gallery-fonts.ts";

test("Greek cover font choices are available with actual Greek samples", () => {
  assert.ok(GALLERY_FONT_CATEGORIES.includes("Greek"));
  const fonts = GALLERY_FONT_OPTIONS.filter((font) => font.categories.includes("Greek"));
  assert.ok(fonts.some((font) => font.name === "Noto Sans"));
  assert.ok(fonts.some((font) => font.name === "Noto Serif"));
  assert.match(galleryFontSample("Greek"), /[\u0370-\u03ff]/);
  assert.equal(GALLERY_FONT_SAMPLES.Greek, galleryFontSample("Greek"));
});

test("built-in Greek families reference the loaded font variables", () => {
  assert.match(resolveGalleryFontFamily("Noto Sans", "sans-serif"), /var\(--font-greek-sans\)/);
  assert.match(resolveGalleryFontFamily("Noto Serif", "serif"), /var\(--font-greek-serif\)/);
});

test("other uploaded font names and gallery fallback remain supported", () => {
  assert.ok(GALLERY_FONT_CATEGORIES.includes("Other"));
  assert.equal(resolveGalleryFontFamily("", "Georgia, serif"), "Georgia, serif");
  assert.equal(resolveGalleryFontFamily("Wedding Handmade", "Georgia, serif"), '"Wedding Handmade", Georgia, serif');
  assert.equal(resolveGalleryFontFamily("Noto Serif", "Georgia, serif", true), '"Noto Serif", Georgia, serif');
});

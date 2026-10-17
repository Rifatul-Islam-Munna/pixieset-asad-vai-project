"use client";

import { useState } from "react";
import {
  GALLERY_FONT_CATEGORIES,
  GALLERY_FONT_OPTIONS,
  galleryFontSample,
  resolveGalleryFontFamily,
  type GalleryFontCategory,
} from "@/lib/gallery-fonts";
import { cn } from "@/lib/utils";

export type SavedCoverFont = {
  localId: string;
  data: {
    name: string;
    url: string;
    fileName: string;
    category?: GalleryFontCategory;
  };
};

type FontFilter = "All" | GalleryFontCategory | "My Fonts";

export function CoverFontSelector({
  fontName,
  fontUrl,
  galleryFontName,
  uploadedFonts,
  uploadCategory,
  onUploadCategoryChange,
  onFontChange,
  onFontUpload,
  uploading,
}: {
  fontName?: string;
  fontUrl?: string;
  galleryFontName?: string;
  uploadedFonts: SavedCoverFont[];
  uploadCategory: GalleryFontCategory;
  onUploadCategoryChange: (category: GalleryFontCategory) => void;
  onFontChange: (name: string, url: string) => void;
  onFontUpload: (files: FileList | null) => Promise<void>;
  uploading: boolean;
}) {
  const [filter, setFilter] = useState<FontFilter>("All");
  const sample = filter === "All" || filter === "My Fonts"
    ? galleryFontSample("English")
    : galleryFontSample(filter);
  const availableBuiltIns = filter === "My Fonts" ? [] : GALLERY_FONT_OPTIONS.filter(
    (font) => filter === "All" || font.categories.includes(filter),
  );
  const availableUploaded = uploadedFonts.filter(
    (font) =>
      filter === "All" ||
      filter === "My Fonts" ||
      (font.data.category ?? "English") === filter,
  );
  const displayName = fontName || galleryFontName || "Gallery font";

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-[#666]">
        Choose a font just for the cover title, studio name, date and button. Greek,
        Cyrillic, Arabic and your own uploaded fonts are supported.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 border bg-[#fafafa] p-3">
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#777]">Current cover font</span>
          <span className="mt-1 block break-words text-sm font-semibold text-[#222]">{fontName ? fontName : "Same as gallery"}</span>
        </div>
        <button
          type="button"
          aria-pressed={!fontName}
          onClick={() => onFontChange("", "")}
          className={cn(
            "min-h-9 border px-3 text-xs font-bold transition hover:border-[#6337d8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6337d8]",
            !fontName ? "border-[#6337d8] bg-[#f0ebff] text-[#6337d8]" : "bg-white text-[#333]",
          )}
        >
          Use gallery font
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter cover fonts by language">
        {(["All", ...GALLERY_FONT_CATEGORIES, "My Fonts"] as FontFilter[]).map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={filter === category}
            onClick={() => setFilter(category)}
            className={cn(
              "min-h-9 border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6337d8]",
              filter === category
                ? "border-[#6337d8] bg-[#f0ebff] text-[#6337d8]"
                : "border-[#dedede] bg-white text-[#555] hover:border-[#999]",
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {availableBuiltIns.map((font) => (
          <button
            key={font.name}
            type="button"
            aria-label={`Use ${font.name} for the cover`}
            aria-pressed={fontName === font.name && !fontUrl}
            onClick={() => onFontChange(font.name, "")}
            className={cn(
              "min-w-0 border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6337d8]",
              fontName === font.name && !fontUrl
                ? "border-[#6337d8] bg-[#f7f4ff] ring-1 ring-[#6337d8]"
                : "border-[#e3e3e3] bg-white hover:border-[#aaa]",
            )}
          >
            <span
              className="block min-h-9 break-words text-xl leading-snug text-[#202326]"
              lang={filter === "Greek" ? "el" : filter === "Cyrillic" ? "ru" : filter === "Arabic" ? "ar" : undefined}
              dir={filter === "Arabic" ? "rtl" : "auto"}
              style={{ fontFamily: resolveGalleryFontFamily(font.name, "sans-serif") }}
            >
              {sample}
            </span>
            <span className="mt-3 block text-sm font-semibold text-[#222]">{font.name}</span>
            <span className="mt-1 block text-[11px] text-[#777]">{font.categories.join(" · ")}</span>
          </button>
        ))}
        {availableUploaded.map((font) => (
          <button
            key={font.localId}
            type="button"
            aria-label={`Use uploaded ${font.data.name} for the cover`}
            aria-pressed={fontName === font.data.name && fontUrl === font.data.url}
            onClick={() => onFontChange(font.data.name, font.data.url)}
            className={cn(
              "min-w-0 border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6337d8]",
              fontName === font.data.name && fontUrl === font.data.url
                ? "border-[#6337d8] bg-[#f7f4ff] ring-1 ring-[#6337d8]"
                : "border-[#e3e3e3] bg-white hover:border-[#aaa]",
            )}
          >
            <style>{`@font-face{font-family:"${font.data.name.replace(/["\\]/g, "")}";src:url("${font.data.url.replace(/["\\]/g, "")}");font-display:swap;}`}</style>
            <span
              className="block min-h-9 break-words text-xl leading-snug text-[#202326]"
              dir={(font.data.category ?? "English") === "Arabic" ? "rtl" : "auto"}
              style={{ fontFamily: resolveGalleryFontFamily(font.data.name, "serif", true) }}
            >
              {filter === "All" || filter === "My Fonts"
                ? galleryFontSample(font.data.category ?? "English")
                : sample}
            </span>
            <span className="mt-3 block truncate text-sm font-semibold text-[#222]">{font.data.name}</span>
            <span className="mt-1 block text-[11px] text-[#777]">My font · {font.data.category ?? "English"}</span>
          </button>
        ))}
      </div>

      {!availableBuiltIns.length && !availableUploaded.length && (
        <p className="border border-dashed p-4 text-sm text-[#777]">
          No fonts in this category yet. Upload your own below.
        </p>
      )}

      <div className="border bg-[#fafafa] p-4">
        <p className="text-sm font-bold text-[#222]">Use any other font</p>
        <p className="mt-1 text-xs leading-5 text-[#666]">
          Upload WOFF, WOFF2, TTF or OTF fonts you have permission to use.
          Your first uploaded font is applied to this cover automatically.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid min-w-[140px] flex-1 gap-1 text-xs font-semibold text-[#444]">
            Font language
            <select
              value={uploadCategory}
              onChange={(event) => onUploadCategoryChange(event.target.value as GalleryFontCategory)}
              className="h-10 w-full border bg-white px-3 text-sm font-normal"
            >
              {GALLERY_FONT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center justify-center bg-[#242424] px-5 text-sm font-semibold text-white hover:bg-[#111]",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? "Uploading font..." : "Upload a custom font"}
            <input
              type="file"
              multiple
              accept=".woff,.woff2,.ttf,.otf,font/*"
              disabled={uploading}
              className="sr-only"
              onChange={(event) => {
                void onFontUpload(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-[#777]">
          The cover font changes only the cover text, not the gallery layout or navigation.
        </p>
      </div>
      <span className="sr-only" aria-live="polite">
        {displayName} selected for cover typography
      </span>
    </div>
  );
}

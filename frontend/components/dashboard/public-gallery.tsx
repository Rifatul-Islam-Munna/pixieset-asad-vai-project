"use client";

import { Download, Grid2X2, Heart, Lock, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/lib/dashboard-store";
import { cn } from "@/lib/utils";

const galleryPhotos = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1508808787069-421e7986016e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
];

const themeMap = {
  Light: ["#ffffff", "#111111", "#f5f5f5"],
  Gold: ["#fffdf8", "#2a241b", "#a99167"],
  Rose: ["#fbf7f6", "#2d2020", "#a9807c"],
  Terracotta: ["#fbf8f5", "#352018", "#aa7b60"],
  Sand: ["#f5f3f1", "#2f2924", "#9f8f82"],
  Olive: ["#f3f4f0", "#24261b", "#96977a"],
} as const;

const typeMap = {
  Sans: "Arial, sans-serif",
  Serif: "Georgia, serif",
  Modern: "Helvetica, sans-serif",
  Timeless: "Times New Roman, serif",
  Bold: "Arial Black, sans-serif",
  Subtle: "Helvetica, sans-serif",
} as const;

export function PublicGallery({
  name,
  galary,
}: {
  name: string;
  galary: string;
}) {
  const { presetDesign, presetDownload, presetFavorite, presetStore } =
    useDashboardStore();
  const [bg, fg, accent] =
    themeMap[presetDesign.color as keyof typeof themeMap] ?? themeMap.Rose;
  const fontFamily =
    typeMap[presetDesign.typography as keyof typeof typeMap] ?? typeMap.Subtle;
  const coverPhoto = galleryPhotos[presetDesign.cover.length % galleryPhotos.length];
  const gridGap = presetDesign.gridSpacing === "Large" ? "gap-8" : "gap-3";
  const gridCols =
    presetDesign.thumbnailSize === "Large"
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <main style={{ backgroundColor: bg, color: fg, fontFamily }} className="min-h-screen">
      <nav className="flex h-16 items-center justify-between px-5 md:px-10">
        <p className="text-sm uppercase tracking-[0.24em]">{decodeURIComponent(name)}</p>
        <div className="flex items-center gap-4">
          {presetDesign.navigationStyle === "Icon & Text" ? (
            <>
              <button className="flex items-center gap-2 text-sm">
                <Grid2X2 className="size-4" /> Gallery
              </button>
              {presetStore.storeStatus && (
                <button className="flex items-center gap-2 text-sm">
                  <ShoppingBag className="size-4" /> Store
                </button>
              )}
            </>
          ) : (
            <>
              <Grid2X2 className="size-5" />
              {presetStore.storeStatus && <ShoppingBag className="size-5" />}
            </>
          )}
        </div>
      </nav>

      <section className="px-5 pb-10 md:px-10">
        <div
          className={cn(
            "relative mx-auto flex min-h-[62vh] max-w-[1180px] overflow-hidden",
            presetDesign.cover === "Stamp" && "items-center justify-center bg-white",
            presetDesign.cover === "Split" && "grid md:grid-cols-2",
            presetDesign.cover === "Left" && "items-end justify-start",
            presetDesign.cover === "Center" && "items-center justify-center"
          )}
        >
          <img
            src={coverPhoto}
            alt={galary}
            className={cn(
              "h-full min-h-[62vh] w-full object-cover",
              presetDesign.cover === "Stamp" && "max-h-[240px] max-w-[240px] min-h-0",
              presetDesign.cover === "Split" && "md:col-start-2"
            )}
          />
          <div
            className={cn(
              "absolute p-8",
              presetDesign.cover === "Left" && "bottom-8 left-8 text-left text-white",
              presetDesign.cover === "Center" && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white",
              presetDesign.cover === "Stamp" && "bottom-20 left-1/2 -translate-x-1/2 text-center",
              !["Left", "Center", "Stamp"].includes(presetDesign.cover) &&
                "bottom-8 left-8 text-white"
            )}
          >
            <p className="text-4xl font-bold uppercase tracking-[0.18em] md:text-6xl">
              {decodeURIComponent(galary)}
            </p>
            <p className="mt-4 text-sm uppercase tracking-[0.24em]">
              {presetDesign.cover} cover / {presetDesign.typography}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em]" style={{ color: accent }}>
              {presetDesign.gridStyle} grid
            </p>
            <h1 className="mt-3 text-3xl font-semibold">{decodeURIComponent(galary)}</h1>
          </div>
          {presetDownload.photoDownload && (
            <Button className="rounded-none" style={{ backgroundColor: accent }}>
              <Download data-icon="inline-start" />
              Download {presetDownload.webSize ? presetDownload.webSizePx : presetDownload.highResolutionSize}
            </Button>
          )}
        </div>

        {presetDownload.downloadPin && (
          <p className="mt-5 inline-flex items-center gap-2 text-sm">
            <Lock className="size-4" />
            Download PIN enabled
          </p>
        )}

        <div
          className={cn(
            "mt-10 grid",
            gridGap,
            gridCols,
            presetDesign.gridStyle === "Horizontal" && "md:grid-cols-2"
          )}
        >
          {galleryPhotos.map((photo, index) => (
            <button key={`${photo}-${index}`} className="group relative overflow-hidden bg-white text-left">
              <img
                src={photo}
                alt=""
                className={cn(
                  "w-full object-cover transition-transform duration-500 group-hover:scale-105",
                  presetDesign.gridStyle === "Horizontal" ? "aspect-[1.6]" : "aspect-[0.82]"
                )}
              />
              {presetFavorite.favoritePhotos && (
                <span className="absolute right-3 top-3 rounded-full bg-white/85 p-2">
                  <Heart className="size-4" />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

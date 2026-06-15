"use client";

import { useState } from "react";
import { Download, Eye, Grid2X2, Lock, ShoppingBag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CoverPreview } from "@/components/dashboard/cover-designs";
import { useDashboardStore, type PresetDesignSettings, type PresetDownloadSettings } from "@/lib/dashboard-store";
import { cn } from "@/lib/utils";

type PublicImage = {
  _id: string;
  url: string;
  originalName?: string;
};

type PublicCollection = {
  _id: string;
  name: string;
  slug?: string;
  eventDate?: string;
  coverImage?: string;
  images?: PublicImage[];
  design?: Partial<PresetDesignSettings>;
  settings?: {
    download?: Partial<PresetDownloadSettings>;
    store?: { storeStatus?: boolean };
  };
};

const fallbackPhotos = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
];

const themeMap = {
  Light: ["#ffffff", "#111111", "#555555"],
  White: ["#ffffff", "#111111", "#555555"],
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
  Classic: "Georgia, serif",
} as const;

const defaultDesign: PresetDesignSettings = {
  cover: "Center",
  coverSmallTitle: "Avery Studio",
  coverTitle: "Sarah & Daniel",
  coverDate: "June 14, 2026",
  coverButtonText: "View Gallery",
  showCoverSmallTitle: true,
  showCoverTitle: true,
  showCoverDate: true,
  showCoverButton: true,
  typography: "Classic",
  color: "White",
  gridStyle: "Vertical",
  thumbnailSize: "Regular",
  gridSpacing: "Regular",
  navigationStyle: "Icon Only",
};

const defaultDownload: PresetDownloadSettings = {
  photoDownload: true,
  highResolution: true,
  highResolutionSize: "3600px",
  webSize: true,
  webSizePx: "1024px",
  videoDownload: false,
  downloadPin: true,
  downloadPinCode: "1234",
  restrictDownloads: false,
  limitDownloads: false,
  limitPinUsage: "",
};

export function PublicGallery({
  name,
  galary,
  collection,
}: {
  name: string;
  galary: string;
  collection?: PublicCollection | null;
}) {
  const fallback = useDashboardStore();
  const design = {
    ...defaultDesign,
    ...(collection?.design ?? fallback.presetDesign),
  };
  const title = collection?.name ?? decodeURIComponent(galary);
  design.coverTitle = coverTextOrDefault(design.coverTitle, title);
  design.coverDate = coverTextOrDefault(
    design.coverDate,
    collection?.eventDate ? formatPublicDate(collection.eventDate) : defaultDesign.coverDate
  );
  design.coverButtonText = coverTextOrDefault(design.coverButtonText, "View Gallery");
  const download = {
    ...defaultDownload,
    ...(collection?.settings?.download ?? fallback.presetDownload),
  };
  const storeStatus = collection?.settings?.store?.storeStatus ?? fallback.presetStore.storeStatus;
  const maxDownloads = download.limitDownloads ? Number(download.limitPinUsage) || 0 : 0;
  const images = collection?.images?.length
    ? collection.images
    : fallbackPhotos.map((url, index) => ({ _id: `sample-${index}`, url }));
  const coverPhoto = imageSrc(collection?.coverImage || images[0]?.url);
  const [activeImage, setActiveImage] = useState<PublicImage | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [downloadCount, setDownloadCount] = useState(0);
  const [bg, fg, accent] =
    themeMap[design.color as keyof typeof themeMap] ?? themeMap.Rose;
  const fontFamily =
    typeMap[design.typography as keyof typeof typeMap] ?? typeMap.Classic;
  const gridGap = design.gridSpacing === "Large" ? "gap-8" : "gap-3";
  const gridCols =
    design.thumbnailSize === "Large"
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  const storeHref = `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}/store`;
  const pinOk = !download.downloadPin || enteredPin === download.downloadPinCode;
  const limitOk = !download.limitDownloads || maxDownloads <= 0 || downloadCount < maxDownloads;
  const canDownload = download.photoDownload && pinOk && limitOk;
  const buttonStyle = { backgroundColor: fg, color: bg };
  const onDownload = () => setDownloadCount((count) => count + 1);

  return (
    <main style={{ backgroundColor: bg, color: fg, fontFamily }} className="min-h-screen">
      <nav className="flex h-16 items-center justify-between px-5 md:px-10">
        <p className="text-sm uppercase tracking-[0.24em]">{decodeURIComponent(name)}</p>
        <div className="flex items-center gap-4">
          {design.navigationStyle === "Icon & Text" ? (
            <>
              <button className="flex items-center gap-2 text-sm">
                <Grid2X2 className="size-4" /> Gallery
              </button>
              {storeStatus && (
                <a href={storeHref} className="flex items-center gap-2 text-sm">
                  <ShoppingBag className="size-4" /> Store
                </a>
              )}
            </>
          ) : (
            <>
              <Grid2X2 className="size-5" />
              {storeStatus && <a href={storeHref} aria-label="Store"><ShoppingBag className="size-5" /></a>}
            </>
          )}
        </div>
      </nav>

      <section className="px-5 pb-10 md:px-10">
        <CoverPreview
          design={{
            ...design,
            coverTitle: design.coverTitle || title,
            coverSmallTitle: design.coverSmallTitle || decodeURIComponent(name),
          }}
          image={coverPhoto}
          className="mx-auto max-w-[1180px]"
        />
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em]" style={{ color: accent }}>
              {design.gridStyle} grid
            </p>
            <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {storeStatus && (
              <Button id="store" className="rounded-none" style={buttonStyle} asChild>
                <a href={storeHref}>
                  <ShoppingBag data-icon="inline-start" />
                  Store
                </a>
              </Button>
            )}
            {download.photoDownload && (
              canDownload ? (
                <Button className="rounded-none" style={buttonStyle} asChild>
                  <a href={imageSrc(images[0]?.url)} download target="_blank" rel="noreferrer" onClick={onDownload}>
                    <Download data-icon="inline-start" />
                    Download
                  </a>
                </Button>
              ) : (
                <Button className="rounded-none opacity-50" style={buttonStyle} disabled>
                  <Download data-icon="inline-start" />
                  Download
                </Button>
              )
            )}
          </div>
        </div>

        {download.downloadPin && (
          <div className="mt-5 flex max-w-[320px] flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-4" />
              Enter download PIN
            </label>
            <input
              value={enteredPin}
              onChange={(event) => setEnteredPin(event.target.value)}
              placeholder="PIN"
              className="h-11 border bg-white px-4 text-sm text-black outline-none"
            />
            {enteredPin && !pinOk && <p className="text-xs text-red-600">PIN does not match.</p>}
          </div>
        )}

        {download.limitDownloads && maxDownloads > 0 && (
          <p className="mt-4 text-sm" style={{ color: accent }}>
            {Math.max(0, maxDownloads - downloadCount)} downloads remaining
          </p>
        )}

        <div
          id="gallery"
          className={cn(
            "mt-10 grid",
            gridGap,
            gridCols,
            design.gridStyle === "Horizontal" && "md:grid-cols-2"
          )}
        >
          {images.map((photo) => (
            <div key={photo._id} className="group relative overflow-hidden bg-white text-left">
              <button className="block w-full" onClick={() => setActiveImage(photo)}>
                <img
                  src={imageSrc(photo.url)}
                  alt={photo.originalName ?? ""}
                  className={cn(
                    "w-full object-cover transition-transform duration-500 group-hover:scale-105",
                    design.gridStyle === "Horizontal" ? "aspect-[1.6]" : "aspect-[0.82]"
                  )}
                />
              </button>
              <div className="absolute right-3 top-3 flex gap-2">
                <button className="rounded-full bg-white/90 p-2 shadow-sm" onClick={() => setActiveImage(photo)} aria-label="View image">
                  <Eye className="size-4" />
                </button>
                {canDownload && (
                  <a className="rounded-full bg-white/90 p-2 shadow-sm" href={imageSrc(photo.url)} download target="_blank" rel="noreferrer" aria-label="Download image" onClick={onDownload}>
                    <Download className="size-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {activeImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <button className="absolute right-5 top-5 rounded-full bg-white p-3 text-black" onClick={() => setActiveImage(null)} aria-label="Close image">
            <X className="size-5" />
          </button>
          {canDownload && (
            <a className="absolute bottom-5 right-5 inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-black" href={imageSrc(activeImage.url)} download target="_blank" rel="noreferrer" onClick={onDownload}>
              <Download className="size-4" />
              Download
            </a>
          )}
          <img
            src={imageSrc(activeImage.url)}
            alt={activeImage.originalName ?? ""}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </main>
  );
}

function imageSrc(url?: string) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    return `${baseUrl}${url}`;
  }
  return url;
}

function coverTextOrDefault(value: string | undefined, fallback: string) {
  return value && !["Avery Studio", "Sarah & Daniel", "June 14, 2026", "View Gallery"].includes(value)
    ? value
    : fallback;
}

function formatPublicDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

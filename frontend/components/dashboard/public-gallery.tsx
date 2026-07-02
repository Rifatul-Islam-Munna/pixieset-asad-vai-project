"use client";

import { useState } from "react";
import { Camera, Download, Eye, Grid2X2, Lock, Search, ShoppingBag, X } from "lucide-react";

import { CoverPreview } from "@/components/dashboard/cover-designs";
import { useDashboardStore, type PresetDesignSettings, type PresetDownloadSettings } from "@/lib/dashboard-store";
import { cn } from "@/lib/utils";

type PublicImage = {
  _id: string;
  url: string;
  originalName?: string;
  faceScore?: number;
};

type PublicFace = {
  id: string;
  label: string;
  imageId?: string;
  imageUrl?: string;
  box?: { x: number; y: number; width: number; height: number };
  photoCount: number;
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
  const coverImage = collection?.coverImage ? { _id: "cover-photo", url: collection.coverImage, originalName: "Cover photo" } : null;
  const galleryImages = coverImage
    ? [coverImage, ...images.filter((image) => imageSrc(image.url) !== imageSrc(coverImage.url))]
    : images;
  const coverPhoto = imageSrc(collection?.coverImage || images[0]?.url);
  const [activeImage, setActiveImage] = useState<PublicImage | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [downloadCount, setDownloadCount] = useState(0);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceError, setFaceError] = useState("");
  const [faceResults, setFaceResults] = useState<PublicImage[] | null>(null);
  const [faces, setFaces] = useState<PublicFace[]>([]);
  const [faceSheetOpen, setFaceSheetOpen] = useState(false);
  const visibleImages = faceResults ?? galleryImages;
  const [bg, fg, accent] =
    themeMap[design.color as keyof typeof themeMap] ?? themeMap.Rose;
  const fontFamily =
    typeMap[design.typography as keyof typeof typeMap] ?? typeMap.Classic;
  const storeHref = `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}/store`;
  const pinOk = !download.downloadPin || enteredPin === download.downloadPinCode;
  const limitOk = !download.limitDownloads || maxDownloads <= 0 || downloadCount < maxDownloads;
  const canDownload = download.photoDownload && pinOk && limitOk;
  const onDownload = () => setDownloadCount((count) => count + 1);
  const apiBase = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  const loadFaces = async () => {
    setFaceSheetOpen(true);
    if (faces.length || faceBusy) return;
    setFaceBusy(true);
    setFaceError("");
    const response = await fetch(`${apiBase}/public/face-search/${encodeURIComponent(galary)}/faces`).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setFaceBusy(false);
    if (!response?.ok) {
      setFaceError(payload?.message ?? "Face list failed.");
      return;
    }
    setFaces(payload?.data?.faces ?? []);
  };
  const filterBySavedFace = async (faceId: string) => {
    setFaceBusy(true);
    setFaceError("");
    const response = await fetch(`${apiBase}/public/face-search/${encodeURIComponent(galary)}/faces/${encodeURIComponent(faceId)}`).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setFaceBusy(false);
    if (!response?.ok) {
      setFaceError(payload?.message ?? "Face filter failed.");
      return;
    }
    setFaceResults(payload?.data?.images ?? []);
    setFaceSheetOpen(false);
  };
  const searchByFace = async (file?: File) => {
    if (!file) return;
    setFaceBusy(true);
    setFaceError("");
    const uploadFile = await compressFaceSearchImage(file).catch(() => file);
    const formData = new FormData();
    formData.append("file", uploadFile);
    const response = await fetch(`${apiBase}/public/face-search/${encodeURIComponent(galary)}`, {
      method: "POST",
      body: formData,
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setFaceBusy(false);
    if (!response?.ok) {
      setFaceError(payload?.message ?? "Face search failed.");
      return;
    }
    setFaceResults(payload?.data?.images ?? []);
  };

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

      <section className="px-0 py-0">
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-y border-black/10 bg-white/95 px-4 py-4 text-[#202326] shadow-[0_14px_35px_rgba(0,0,0,0.08)] backdrop-blur md:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-black/45">
              Masonry gallery
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-black/10 bg-[#f4f4f2] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[#202326] px-4 text-sm font-bold text-white transition hover:opacity-90">
              {faceBusy ? <Search className="size-4 animate-pulse" /> : <Camera className="size-4" />}
              <span>{faceBusy ? "Searching" : "Find me"}</span>
              <input type="file" accept="image/*" capture="user" disabled={faceBusy} className="hidden" onChange={(event) => {
                void searchByFace(event.target.files?.[0]);
                event.target.value = "";
              }} />
            </label>
            <button className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5" onClick={loadFaces} type="button">
              <Search className="size-4" />
              Faces
            </button>
            {faceResults && (
              <button className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-sm font-bold transition hover:bg-black/5" onClick={() => setFaceResults(null)} type="button">
                Show all
              </button>
            )}
            {storeStatus && (
              <a id="store" href={storeHref} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5">
                <ShoppingBag className="size-4" />
                Store
              </a>
            )}
            {download.photoDownload && canDownload && (
              <a className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5" href={imageSrc(images[0]?.url)} download target="_blank" rel="noreferrer" onClick={onDownload}>
                <Download className="size-4" />
                Download
              </a>
            )}
            {download.photoDownload && !canDownload && (
              <span className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold opacity-40">
                <Download className="size-4" />
                Download
              </span>
            )}
          </div>
        </div>

        {download.downloadPin && (
          <div className="mx-4 mt-5 flex max-w-[320px] flex-col gap-2 md:mx-8">
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
          <p className="mx-4 mt-4 text-sm md:mx-8" style={{ color: accent }}>
            {Math.max(0, maxDownloads - downloadCount)} downloads remaining
          </p>
        )}

        {faceError && <p className="mx-4 mt-5 text-sm font-semibold text-red-600 md:mx-8">{faceError}</p>}
        {faceResults && (
          <p className="mx-4 mt-5 text-sm md:mx-8" style={{ color: accent }}>
            {faceResults.length} matching photos found
          </p>
        )}

        <div
          id="gallery"
          className="mt-0 grid auto-rows-[minmax(180px,22vw)] grid-cols-1 gap-[15px] bg-white p-[15px] sm:grid-cols-2 lg:grid-cols-3"
        >
          {visibleImages.map((photo, index) => (
            <div key={photo._id} className={cn("group relative overflow-hidden bg-[#f4f4f2] text-left", masonryTileClass(index))}>
              <button className="block h-full w-full" onClick={() => setActiveImage(photo)}>
                <img
                  src={imageSrc(photo.url)}
                  alt={photo.originalName ?? ""}
                  loading={index < 6 ? "eager" : "lazy"}
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
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

      {faceSheetOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <aside className="h-full w-full max-w-[360px] overflow-y-auto bg-white p-6 text-[#111] shadow-[-18px_0_40px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#777]">Face filter</p>
                <h2 className="mt-2 text-2xl font-semibold">People in album</h2>
              </div>
              <button onClick={() => setFaceSheetOpen(false)} aria-label="Close face filter">
                <X className="size-5" />
              </button>
            </div>
            {faceBusy && <p className="mt-8 text-sm text-[#666]">Loading faces...</p>}
            {!faceBusy && !faces.length && (
              <p className="mt-8 text-sm leading-6 text-[#666]">
                No indexed faces yet. New uploads index in background.
              </p>
            )}
            <div className="mt-8 grid grid-cols-3 gap-5">
              {faces.map((face) => (
                <button key={face.id} className="grid justify-items-center gap-2 text-center" onClick={() => void filterBySavedFace(face.id)}>
                  <span className="block size-20 overflow-hidden rounded-full bg-[#eee] ring-2 ring-[#111]/10">
                    {face.imageUrl ? (
                      <img
                        src={imageSrc(face.imageUrl)}
                        alt={face.label}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        style={face.box ? { objectPosition: `${face.box.x + face.box.width / 2}% ${face.box.y + face.box.height / 2}%` } : undefined}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold">Face</span>
                    )}
                  </span>
                  <span className="text-xs font-bold">{face.photoCount} photos</span>
                </button>
              ))}
            </div>
          </aside>
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

function masonryTileClass(index: number) {
  const pattern = [
    "lg:row-span-2",
    "",
    "lg:row-span-2",
    "lg:row-span-2",
    "lg:row-span-2",
    "",
  ];
  return pattern[index % pattern.length];
}

async function compressFaceSearchImage(file: File) {
  if (!file.type.startsWith("image/") || file.size <= 1024 * 1024 * 2) return file;
  const bitmap = await createImageBitmap(file);
  const maxSize = 1280;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], "face-search.jpg", { type: "image/jpeg" });
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

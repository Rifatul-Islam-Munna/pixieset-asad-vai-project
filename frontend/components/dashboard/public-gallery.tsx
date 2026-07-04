"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, Download, Eye, Grid2X2, Heart, Lock, Play, Search, Share2, ShoppingBag, X } from "lucide-react";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";

import { CoverPreview } from "@/components/dashboard/cover-designs";
import { useDashboardStore, type PresetDesignSettings, type PresetDownloadSettings } from "@/lib/dashboard-store";
import { cn } from "@/lib/utils";

type PublicImage = {
  _id: string;
  url: string;
  thumbnailUrl?: string;
  blurDataUrl?: string;
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
    general?: { slideshow?: boolean | string };
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
  downloadPin: false,
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
    ...(collection ? (collection.settings?.download ?? {}) : fallback.presetDownload),
  };
  const storeStatus = collection?.settings?.store?.storeStatus ?? fallback.presetStore.storeStatus;
  const slideshowEnabled = collection
    ? boolSetting(collection.settings?.general?.slideshow ?? true)
    : boolSetting(fallback.presetGeneral.slideshow);
  const maxDownloads = boolSetting(download.limitDownloads) ? Number(download.limitPinUsage) || 0 : 0;
  const images = collection?.images?.length
    ? collection.images
    : fallbackPhotos.map((url, index) => ({ _id: `sample-${index}`, url }));
  const collectionCoverImage = collection?.coverImage;
  const coverMatch = collectionCoverImage
    ? images.find((image) => imageSrc(image.url) === imageSrc(collectionCoverImage))
    : null;
  const coverImage = collectionCoverImage
    ? { ...(coverMatch ?? {}), _id: coverMatch?._id ?? "cover-photo", url: collectionCoverImage, originalName: coverMatch?.originalName ?? "Cover photo" }
    : null;
  const galleryImages = coverImage
    ? [coverImage, ...images.filter((image) => imageSrc(image.url) !== imageSrc(coverImage.url))]
    : images;
  const coverPhoto = imageSrc(collection?.coverImage || images[0]?.url);
  const [activeImage, setActiveImage] = useState<PublicImage | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [downloadCount, setDownloadCount] = useState(0);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceError, setFaceError] = useState("");
  const [faceResults, setFaceResults] = useState<PublicImage[] | null>(null);
  const [faces, setFaces] = useState<PublicFace[]>([]);
  const [facesIndexing, setFacesIndexing] = useState(false);
  const [faceSheetOpen, setFaceSheetOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
  const [collectionFavorited, setCollectionFavorited] = useState(false);
  const [favoriteImageIds, setFavoriteImageIds] = useState<Set<string>>(() => new Set());
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteImageBusy, setFavoriteImageBusy] = useState("");
  const visibleImages = faceResults ?? galleryImages;
  const slideshowImage = slideshowIndex === null ? null : visibleImages[slideshowIndex];
  const slideshowPosition = slideshowIndex ?? 0;
  const [bg, fg, accent] =
    themeMap[design.color as keyof typeof themeMap] ?? themeMap.Rose;
  const fontFamily =
    typeMap[design.typography as keyof typeof typeMap] ?? typeMap.Classic;
  const storeHref = `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}/store`;
  const downloadsEnabled = boolSetting(download.photoDownload);
  const pinRequired = downloadsEnabled && boolSetting(download.downloadPin);
  const pinOk = !pinRequired || enteredPin.trim() === String(download.downloadPinCode ?? "").trim();
  const limitOk = !boolSetting(download.limitDownloads) || maxDownloads <= 0 || downloadCount < maxDownloads;
  const canDownload = downloadsEnabled && pinOk && limitOk;
  const onDownload = () => setDownloadCount((count) => count + 1);
  const downloadPhoto = (photo: PublicImage, index = 0) => {
    if (!canDownload) return;
    const url = `/api/public-download?url=${encodeURIComponent(imageSrc(photo.url))}&name=${encodeURIComponent(photo.originalName || `photo-${index + 1}`)}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    onDownload();
  };
  const downloadAllImages = async () => {
    if (!canDownload || zipDownloading) return;
    const remaining = boolSetting(download.limitDownloads) && maxDownloads > 0
      ? Math.max(0, maxDownloads - downloadCount)
      : galleryImages.length;
    const downloadable = galleryImages.slice(0, remaining || galleryImages.length);
    if (!downloadable.length) return;

    setZipDownloading(true);
    const response = await fetch("/api/public-download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: title,
        images: downloadable.map((photo, index) => ({
          url: imageSrc(photo.url),
          name: photo.originalName || `photo-${index + 1}`,
        })),
      }),
    }).catch(() => null);
    setZipDownloading(false);

    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => null) : null;
      setShareNotice(payload?.message ?? "Download failed");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeDownloadName(title)}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloadCount((count) => count + downloadable.length);
    setShareNotice("ZIP download started");
  };

  useEffect(() => {
    if (!slideshowEnabled) setSlideshowIndex(null);
  }, [slideshowEnabled]);
  const apiBase = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  const currentPublicUrl = (photoId?: string) => {
    const url = `${window.location.origin}${window.location.pathname}`;
    return photoId ? `${url}#photo-${encodeURIComponent(photoId)}` : url;
  };
  const shareItem = async (share: { title: string; text?: string; url: string }, notice: string) => {
    if (navigator.share) {
      await navigator.share(share).catch(() => null);
      setShareNotice(notice);
      return;
    }
    await navigator.clipboard?.writeText(share.url).catch(() => null);
    setShareNotice("Link copied");
  };
  const shareCollection = () =>
    shareItem(
      { title, text: `View ${title}`, url: currentPublicUrl() },
      "Collection shared"
    );
  const sharePhoto = (photo: PublicImage) =>
    shareItem(
      { title: photo.originalName || title, text: title, url: currentPublicUrl(photo._id) },
      "Photo shared"
    );
  const toggleCollectionFavorite = async () => {
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    const response = await fetch("/api/collection-favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: collection?.slug ?? galary }),
    }).catch(() => null);
    setFavoriteBusy(false);
    if (response?.status === 401) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const payload = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setShareNotice(payload?.message ?? "Favorite failed");
      return;
    }
    setCollectionFavorited(Boolean(payload?.data?.favorited));
    setShareNotice(payload?.data?.favorited ? "Collection favorited" : "Collection removed");
  };
  const toggleImageFavorite = async (photo: PublicImage) => {
    if (!isPersistedImageId(photo._id)) return;
    if (favoriteImageBusy === photo._id) return;
    setFavoriteImageBusy(photo._id);
    const response = await fetch("/api/collection-image-favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageId: photo._id }),
    }).catch(() => null);
    setFavoriteImageBusy("");
    if (response?.status === 401) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const payload = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setShareNotice(payload?.message ?? "Favorite failed");
      return;
    }
    const favorited = Boolean(payload?.data?.favorited);
    setFavoriteImageIds((current) => {
      const next = new Set(current);
      if (favorited) next.add(photo._id);
      else next.delete(photo._id);
      return next;
    });
    setShareNotice(favorited ? "Photo favorited" : "Photo removed");
  };
  const startSlideshow = () => {
    if (!visibleImages.length) return;
    setActiveImage(null);
    setSlideshowIndex(0);
  };
  const closeSlideshow = () => setSlideshowIndex(null);
  const showNextSlide = () => setSlideshowIndex((index) => !visibleImages.length || index === null ? 0 : (index + 1) % visibleImages.length);
  const showPreviousSlide = () => setSlideshowIndex((index) => !visibleImages.length || index === null ? 0 : (index - 1 + visibleImages.length) % visibleImages.length);
  const loadFaces = async (force = false) => {
    setFaceSheetOpen(true);
    if (((!force && faces.length) || faceBusy)) return;
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
    setFacesIndexing(Boolean(payload?.data?.indexing));
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

  useEffect(() => {
    if (!faceSheetOpen || !facesIndexing) return;
    const timer = window.setTimeout(() => {
      void loadFaces(true);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [faceSheetOpen, facesIndexing]);

  useEffect(() => {
    if (!shareNotice) return;
    const timer = window.setTimeout(() => setShareNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [shareNotice]);

  useEffect(() => {
    const identifier = collection?.slug ?? galary;
    fetch("/api/collection-favorites", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return null;
        return response.ok ? response.json() : null;
      })
      .then((payload) => {
        const items = Array.isArray(payload?.data) ? payload.data : [];
        setCollectionFavorited(items.some((item: any) =>
          item.collectionId === collection?._id || item.slug === identifier,
        ));
      })
      .catch(() => undefined);
    fetch("/api/collection-image-favorites", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return null;
        return response.ok ? response.json() : null;
      })
      .then((payload) => {
        const ids = Array.isArray(payload?.data)
          ? payload.data.map((item: any) => item.imageId).filter(Boolean)
          : [];
        setFavoriteImageIds(new Set(ids));
      })
      .catch(() => undefined);
  }, [collection?._id, collection?.slug, galary]);

  useEffect(() => {
    if (slideshowIndex === null || visibleImages.length <= 1) return;
    const timer = window.setTimeout(showNextSlide, 3200);
    return () => window.clearTimeout(timer);
  }, [slideshowIndex, visibleImages.length]);

  return (
    <main style={{ backgroundColor: bg, color: fg, fontFamily }} className="min-h-screen scroll-smooth">
      <nav className="flex h-16 items-center justify-between px-5 md:px-10">
        <p className="text-sm uppercase tracking-[0.24em]">{decodeURIComponent(name)}</p>
        <div className="flex items-center gap-4">
          {design.navigationStyle === "Icon & Text" ? (
            <>
              <button className="flex items-center gap-2 text-sm">
                <Grid2X2 className="size-4" /> Gallery
              </button>
              <button className="flex items-center gap-2 text-sm" onClick={() => void shareCollection()} type="button">
                <Share2 className="size-4" /> Share
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
              <button onClick={() => void shareCollection()} type="button" aria-label="Share collection">
                <Share2 className="size-5" />
              </button>
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
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[#202326] px-4 text-sm font-bold text-white transition hover:opacity-90 md:w-10 md:justify-center md:px-0" title={faceBusy ? "Searching" : "Find me"}>
              {faceBusy ? <Search className="size-4 animate-pulse" /> : <Camera className="size-4" />}
              <span className="md:sr-only">{faceBusy ? "Searching" : "Find me"}</span>
              <input type="file" accept="image/*" capture="user" disabled={faceBusy} className="hidden" onChange={(event) => {
                void searchByFace(event.target.files?.[0]);
                event.target.value = "";
              }} />
            </label>
            <button className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" onClick={() => void loadFaces()} type="button" title="Faces" aria-label="Faces">
              <Search className="size-4" />
              <span className="md:sr-only">Faces</span>
            </button>
            {faceResults && (
              <button className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-sm font-bold transition hover:bg-black/5" onClick={() => setFaceResults(null)} type="button">
                Show all
              </button>
            )}
            {slideshowEnabled && (
              <button className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" onClick={startSlideshow} type="button" title="Slideshow" aria-label="Slideshow">
                <Play className="size-4" />
                <span className="md:sr-only">Slideshow</span>
              </button>
            )}
            <button className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" onClick={() => void shareCollection()} type="button" title="Share" aria-label="Share">
              <Share2 className="size-4" />
              <span className="md:sr-only">Share</span>
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 disabled:opacity-50 md:w-10 md:justify-center md:px-0" onClick={() => void toggleCollectionFavorite()} disabled={favoriteBusy} type="button" title="Favorite" aria-label="Favorite">
              <Heart className={cn("size-4", collectionFavorited && "fill-current text-red-500")} />
              <span className="md:sr-only">Favorite</span>
            </button>
            {storeStatus && (
              <a id="store" href={storeHref} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" title="Store" aria-label="Store">
                <ShoppingBag className="size-4" />
                <span className="md:sr-only">Store</span>
              </a>
            )}
            {canDownload && (
              <button className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 disabled:opacity-50 md:w-10 md:justify-center md:px-0" onClick={() => void downloadAllImages()} disabled={zipDownloading} type="button" title="Download all" aria-label="Download all">
                <Download className={cn("size-4", zipDownloading && "animate-pulse")} />
                <span className="md:sr-only">{zipDownloading ? "Preparing ZIP" : "Download all"}</span>
              </button>
            )}
          </div>
        </div>

        {pinRequired && !pinOk && (
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

        {downloadsEnabled && boolSetting(download.limitDownloads) && maxDownloads > 0 && (
          <p className="mx-4 mt-4 text-sm md:mx-8" style={{ color: accent }}>
            {Math.max(0, maxDownloads - downloadCount)} downloads remaining
          </p>
        )}

        {faceError && <p className="mx-4 mt-5 text-sm font-semibold text-red-600 md:mx-8">{faceError}</p>}
        {shareNotice && (
          <p className="mx-4 mt-5 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white md:mx-8">
            <Check className="size-4" />
            {shareNotice}
          </p>
        )}
        {faceResults && (
          <p className="mx-4 mt-5 text-sm md:mx-8" style={{ color: accent }}>
            {faceResults.length} matching photos found
          </p>
        )}

        <div
          id="gallery"
          className="mt-0 bg-white p-0"
        >
          <ResponsiveMasonry
            columnsCountBreakPoints={{ 0: 1, 640: 2, 1024: 3 }}
            gutterBreakPoints={{ 0: 0, 640: 0, 1024: 0 }}
          >
            <Masonry gutter="0px" itemStyle={{ overflow: "visible" }}>
              {visibleImages.map((photo) => (
                <div
                  id={`photo-${photo._id}`}
                  key={photo._id}
                  className="group relative w-full bg-[#f4f4f2] text-left transition-[box-shadow] duration-300 hover:shadow-[0_18px_45px_rgba(0,0,0,0.16)]"
                >
                  <button className="block w-full" onClick={() => setActiveImage(photo)}>
                    <GalleryImage
                      src={imageSrc(displayImageUrl(photo))}
                      fallbackSrc={imageSrc(photo.url)}
                      alt={photo.originalName ?? ""}
                      className="block h-auto w-full"
                    />
                  </button>
                  <div className="absolute right-3 top-3 flex gap-2">
                    {isPersistedImageId(photo._id) && (
                      <button className="rounded-full bg-white/90 p-2 shadow-sm" onClick={() => void toggleImageFavorite(photo)} disabled={favoriteImageBusy === photo._id} aria-label="Favorite image" type="button">
                        <Heart className={cn("size-4", favoriteImageIds.has(photo._id) && "fill-red-500 text-red-500")} />
                      </button>
                    )}
                    <button className="rounded-full bg-white/90 p-2 shadow-sm" onClick={() => setActiveImage(photo)} aria-label="View image">
                      <Eye className="size-4" />
                    </button>
                    <button className="rounded-full bg-white/90 p-2 shadow-sm" onClick={() => void sharePhoto(photo)} aria-label="Share image" type="button">
                      <Share2 className="size-4" />
                    </button>
                    {canDownload && (
                      <button className="rounded-full bg-white/90 p-2 shadow-sm" onClick={() => downloadPhoto(photo)} aria-label="Download image" type="button">
                        <Download className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Masonry>
          </ResponsiveMasonry>
        </div>
      </section>

      {activeImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <button className="absolute right-5 top-5 rounded-full bg-white p-3 text-black" onClick={() => setActiveImage(null)} aria-label="Close image">
            <X className="size-5" />
          </button>
          <div className="absolute bottom-5 right-5 flex flex-wrap justify-end gap-2">
            {isPersistedImageId(activeImage._id) && (
              <button className="inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-black" onClick={() => void toggleImageFavorite(activeImage)} type="button">
                <Heart className={cn("size-4", favoriteImageIds.has(activeImage._id) && "fill-red-500 text-red-500")} />
                Favorite
              </button>
            )}
            <button className="inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-black" onClick={() => void sharePhoto(activeImage)} type="button">
              <Share2 className="size-4" />
              Share
            </button>
            {canDownload && (
              <button className="inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-black" onClick={() => downloadPhoto(activeImage)} type="button">
                <Download className="size-4" />
                Download
              </button>
            )}
          </div>
          <img
            src={imageSrc(activeImage.url)}
            alt={activeImage.originalName ?? ""}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}

      {slideshowImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4" onDoubleClick={closeSlideshow}>
          <button className="absolute right-5 top-5 rounded-full bg-white p-3 text-black" onClick={closeSlideshow} aria-label="Close slideshow">
            <X className="size-5" />
          </button>
          <div className="absolute left-5 top-5 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur">
            {slideshowPosition + 1} / {visibleImages.length}
          </div>
          <button className="absolute left-5 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-black shadow" onClick={showPreviousSlide} aria-label="Previous slide" type="button">
            <ChevronLeft className="size-6" />
          </button>
          <button className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-black shadow" onClick={showNextSlide} aria-label="Next slide" type="button">
            <ChevronRight className="size-6" />
          </button>
          <div className="absolute bottom-5 right-5 flex flex-wrap justify-end gap-2">
            {isPersistedImageId(slideshowImage._id) && (
              <button className="inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-black" onClick={() => void toggleImageFavorite(slideshowImage)} type="button">
                <Heart className={cn("size-4", favoriteImageIds.has(slideshowImage._id) && "fill-red-500 text-red-500")} />
                Favorite
              </button>
            )}
            <button className="inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-black" onClick={() => void sharePhoto(slideshowImage)} type="button">
              <Share2 className="size-4" />
              Share
            </button>
            {canDownload && (
              <button className="inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-black" onClick={() => downloadPhoto(slideshowImage, slideshowPosition)} type="button">
                <Download className="size-4" />
                Download
              </button>
            )}
          </div>
          <img
            key={slideshowImage._id}
            src={imageSrc(slideshowImage.url)}
            alt={slideshowImage.originalName ?? ""}
            className="max-h-full max-w-full animate-in fade-in zoom-in-95 object-contain duration-500"
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
            {facesIndexing && !faceBusy && (
              <p className="mt-6 rounded bg-[#f6f6f4] px-3 py-2 text-sm font-semibold text-[#666]">
                Detecting remaining faces...
              </p>
            )}
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
                      <GalleryImage
                        src={imageSrc(face.imageUrl)}
                        alt={face.label}
                        className="h-full w-full object-cover"
                        style={face.box ? { objectPosition: `${face.box.x + face.box.width / 2}% ${face.box.y + face.box.height / 2}%` } : undefined}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold">Face</span>
                    )}
                  </span>
                  <span className="text-xs font-bold">
                    {face.photoCount} {face.photoCount === 1 ? "photo" : "photos"}
                  </span>
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

function isPersistedImageId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

function displayImageUrl(image: PublicImage) {
  return image.thumbnailUrl || image.url;
}

function safeDownloadName(value: string) {
  return value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "collection";
}

function GalleryImage({
  src,
  fallbackSrc,
  alt,
  className,
  style,
  onShape,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  onShape?: (shape: "portrait" | "landscape" | "square") => void;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);
  return (
    <span className={cn("relative block w-full bg-transparent", className?.includes("h-full") && "h-full overflow-hidden")}>
      <img
        src={currentSrc}
        alt={alt}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        onLoad={(event) => {
          const image = event.currentTarget;
          const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
          onShape?.(ratio > 1.12 ? "landscape" : ratio < 0.9 ? "portrait" : "square");
        }}
        onError={() => {
          if (fallbackSrc && currentSrc !== fallbackSrc) {
            setCurrentSrc(fallbackSrc);
          }
        }}
        className={className}
        style={style}
      />
    </span>
  );
}

function coverTextOrDefault(value: string | undefined, fallback: string) {
  return value && !["Avery Studio", "Sarah & Daniel", "June 14, 2026", "View Gallery"].includes(value)
    ? value
    : fallback;
}

function boolSetting(value: unknown) {
  if (typeof value === "string") return value.toLowerCase() !== "false" && value !== "0";
  return Boolean(value);
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

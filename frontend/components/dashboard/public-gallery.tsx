"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, Download, Eye, Heart, Loader2, Lock, Play, Search, Share2, ShoppingBag, X } from "lucide-react";

import { CoverPreview } from "@/components/dashboard/cover-designs";
import { ScreenCaptureGuard } from "@/components/privacy/screen-capture-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardStore, type PresetDesignSettings, type PresetDownloadSettings } from "@/lib/dashboard-store";
import type { BrandSettings } from "@/lib/home-cms";
import { cn } from "@/lib/utils";
import { usePublicGalleryFavorites } from "./public-gallery-favorites";

type PublicImage = {
  _id: string;
  setId?: string;
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
  sets?: Array<{ id: string; name: string }>;
  images?: PublicImage[];
  imagesPage?: { total: number; limit: number; offset: number; hasMore: boolean };
  design?: Partial<PresetDesignSettings>;
  branding?: Partial<BrandSettings>;
  settings?: {
    general?: {
      emailRegistration?: boolean | string;
      galleryAssist?: boolean | string;
      slideshow?: boolean | string;
      socialSharing?: boolean | string;
      language?: string;
    };
    download?: Partial<PresetDownloadSettings>;
    favorite?: { favoritePhotos?: boolean; favoriteNotes?: boolean; maxFavorites?: string; description?: string };
    store?: { storeStatus?: boolean; enabled?: boolean; showPrintStoreNav?: boolean; showBuyPhotoButton?: boolean };
    access?: { emailRequired?: boolean; emailAuthorized?: boolean; emailStatus?: string; email?: string };
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
  customFontName: "",
  customFontDataUrl: "",
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
  collection: initialCollection,
}: {
  name: string;
  galary: string;
  collection?: PublicCollection | null;
}) {
  const [collection, setCollection] = useState(initialCollection);
  useEffect(() => setCollection(initialCollection), [initialCollection]);
  const [loadedImages, setLoadedImages] = useState<PublicImage[]>(initialCollection?.images ?? []);
  const [imagesHasMore, setImagesHasMore] = useState(Boolean(initialCollection?.imagesPage?.hasMore));
  const [imagesLoadingMore, setImagesLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setLoadedImages(initialCollection?.images ?? []);
    setImagesHasMore(Boolean(initialCollection?.imagesPage?.hasMore));
  }, [initialCollection]);
  const fallbackPresetDesign = useDashboardStore((state) => state.presetDesign);
  const fallbackPresetDownload = useDashboardStore((state) => state.presetDownload);
  const fallbackPresetStore = useDashboardStore((state) => state.presetStore);
  const fallbackPresetGeneral = useDashboardStore((state) => state.presetGeneral);
  const design = {
    ...defaultDesign,
    ...(collection?.design ?? fallbackPresetDesign),
  };
  const studioName = decodeRouteText(name);
  const title = collection?.name ?? decodeRouteText(galary);
  design.coverTitle = coverTextOrDefault(design.coverTitle, title);
  design.coverDate = coverTextOrDefault(
    design.coverDate,
    collection?.eventDate ? formatPublicDate(collection.eventDate) : defaultDesign.coverDate
  );
  design.coverButtonText = coverTextOrDefault(design.coverButtonText, "View Gallery");
  const download = {
    ...defaultDownload,
    ...(collection ? (collection.settings?.download ?? {}) : fallbackPresetDownload),
  };
  const storeConfig = collection?.settings?.store;
  const storeEnabled = Boolean(collection ? (storeConfig?.enabled ?? storeConfig?.storeStatus) : fallbackPresetStore.storeStatus);
  const storeStatus = Boolean(
    collection
      ? storeEnabled && storeConfig?.showPrintStoreNav !== false
      : fallbackPresetStore.showPrintStoreNav ?? fallbackPresetStore.storeStatus,
  );
  const showBuyPhotoButton = Boolean(storeEnabled && storeConfig?.showBuyPhotoButton !== false);
  const generalSettings = collection?.settings?.general ?? fallbackPresetGeneral;
  const slideshowEnabled = collection
    ? boolSetting(generalSettings.slideshow ?? true)
    : boolSetting(fallbackPresetGeneral.slideshow);
  const socialSharingEnabled = boolSetting(generalSettings.socialSharing ?? true);
  const galleryAssistEnabled = boolSetting(generalSettings.galleryAssist);
  const emailRegistrationEnabled = boolSetting(generalSettings.emailRegistration);
  const maxDownloads = boolSetting(download.limitDownloads) ? Number(download.limitPinUsage) || 0 : 0;
  const images = collection
    ? loadedImages
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
  const gallerySets = useMemo(
    () => collection?.sets?.length
      ? collection.sets
      : [{ id: "highlights", name: "Highlights" }],
    [collection?.sets],
  );
  const showSetTabs = gallerySets.length > 0;
  const coverPhoto = imageSrc(collection?.coverImage || images[0]?.url);
  const [activeSetId, setActiveSetId] = useState(() => gallerySets[0]?.id ?? "highlights");
  const [activeImage, setActiveImage] = useState<PublicImage | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [downloadCount, setDownloadCount] = useState(0);
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorEmailSaved, setVisitorEmailSaved] = useState(false);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipStage, setZipStage] = useState("Preparing your photos");
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceError, setFaceError] = useState("");
  const [faceResults, setFaceResults] = useState<PublicImage[] | null>(null);
  const [faces, setFaces] = useState<PublicFace[]>([]);
  const [facesIndexing, setFacesIndexing] = useState(false);
  const [faceSheetOpen, setFaceSheetOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
  const [downloadEmail, setDownloadEmail] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessReason, setAccessReason] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessNotice, setAccessNotice] = useState("");
  const accessSettings = collection?.settings?.access;
  const emailAccessLocked = Boolean(collection && emailRegistrationEnabled && !accessSettings?.emailAuthorized);
  const activeGalleryImages = showSetTabs
    ? galleryImages.filter((image) => imageSetId(image) === activeSetId)
    : galleryImages;
  const visibleImages = faceResults ?? activeGalleryImages;
  const canLoadMoreImages = Boolean(collection && !faceResults && imagesHasMore);
  const slideshowImage = slideshowIndex === null ? null : visibleImages[slideshowIndex];
  const slideshowPosition = slideshowIndex ?? 0;
  const [bg, fg, accent] =
    themeMap[design.color as keyof typeof themeMap] ?? themeMap.Rose;
  const fallbackFontFamily =
    typeMap[design.typography as keyof typeof typeMap] ?? typeMap.Classic;
  const customFontName = design.customFontName?.trim();
  const fontFamily = customFontName
    ? `"${customFontName.replace(/"/g, "")}", ${fallbackFontFamily}`
    : fallbackFontFamily;
  const masonryGapPx = design.gridSpacing === "Large" ? 8 : 3;
  const masonryColumns = design.thumbnailSize === "Large"
    ? "columns-1 sm:columns-2"
    : "columns-1 sm:columns-2 lg:columns-3";
  const downloadsEnabled = boolSetting(download.photoDownload);
  const favoriteSettings = collection?.settings?.favorite;
  const favoritesEnabled = favoriteSettings?.favoritePhotos !== false;
  const maxFavoriteCount = Number(favoriteSettings?.maxFavorites || 0);
  const favoriteTools = usePublicGalleryFavorites({
    collectionId: collection?._id,
    identifier: collection?.slug ?? galary,
    collectionTitle: title,
    images: galleryImages,
    enabled: favoritesEnabled,
    maxFavorites: maxFavoriteCount,
  });
  const {
    collectionFavorited,
    favoriteImageIds,
    favoriteBusy,
    favoriteImageBusy,
    toggleCollectionFavorite,
    toggleImageFavorite,
  } = favoriteTools;
  const pinRequired = downloadsEnabled && boolSetting(download.downloadPin);
  const pinOk = !pinRequired || enteredPin.trim() === String(download.downloadPinCode ?? "").trim();
  const limitOk = !boolSetting(download.limitDownloads) || maxDownloads <= 0 || downloadCount < maxDownloads;
  const canDownload = downloadsEnabled && pinOk && limitOk;
  const onDownload = () => setDownloadCount((count) => count + 1);
  const unlockDownloads = () => {
    setEnteredPin(pinDraft.trim());
    if (pinDraft.trim() === String(download.downloadPinCode ?? "").trim()) {
      setPinDialogOpen(false);
      setShareNotice("Downloads unlocked");
    }
  };
  const ensureDownloadEmail = () => {
    const saved = downloadEmail || window.localStorage.getItem("pixieset-download-email") || "";
    const email = window.prompt("Enter your email to download", saved);
    if (!email?.trim() || !email.includes("@")) {
      setShareNotice("Email is required before download");
      return "";
    }
    const clean = email.trim().toLowerCase();
    setDownloadEmail(clean);
    window.localStorage.setItem("pixieset-download-email", clean);
    return clean;
  };
  const recordDownloadActivity = async (
    email: string,
    items: Array<{ imageId?: string; imageName?: string; imageUrl?: string }>,
    downloadType: "single" | "all",
  ) => {
    const identifier = collection?.slug ?? galary;
    const response = await fetch(`${apiBase}/public/collections/${encodeURIComponent(identifier)}/download-activity`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, items, downloadType }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => null) : null;
      throw new Error(payload?.message ?? "Download activity failed");
    }
  };
  const downloadPhoto = async (photo: PublicImage, index = 0) => {
    if (!canDownload) return;
    const email = ensureDownloadEmail();
    if (!email) return;
    try {
      await recordDownloadActivity(
        email,
        [{
          imageId: isPersistedImageId(photo._id) ? photo._id : undefined,
          imageName: photo.originalName || `photo-${index + 1}`,
          imageUrl: imageSrc(photo.url),
        }],
        "single",
      );
    } catch (error) {
      setShareNotice(error instanceof Error ? error.message : "Download activity failed");
      return;
    }
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
    let allImages = galleryImages;
    if (collection && imagesHasMore) {
      setZipStage("Loading remaining gallery photos");
      let offset = loadedImages.length;
      let hasMore = imagesHasMore;
      const loaded: PublicImage[] = [];
      while (hasMore) {
        const params = new URLSearchParams({ limit: "120", offset: String(offset) });
        const email = accessSettings?.email || visitorEmail || accessEmail;
        if (email) params.set("email", email);
        const response = await fetch(`${apiBase}/public/collections/${encodeURIComponent(collection.slug ?? galary)}/images?${params.toString()}`).catch(() => null);
        const payload = response?.ok ? await response.json().catch(() => null) : null;
        const page = payload?.data;
        if (!page?.items?.length) break;
        loaded.push(...page.items);
        offset += page.items.length;
        hasMore = Boolean(page.hasMore);
      }
      if (loaded.length) {
        const seen = new Set(allImages.map((image) => image._id));
        allImages = [...allImages, ...loaded.filter((image) => !seen.has(image._id))];
        setLoadedImages((current) => {
          const currentIds = new Set(current.map((image) => image._id));
          return [...current, ...loaded.filter((image) => !currentIds.has(image._id))];
        });
        setImagesHasMore(false);
      }
    }
    const remaining = boolSetting(download.limitDownloads) && maxDownloads > 0
      ? Math.max(0, maxDownloads - downloadCount)
      : allImages.length;
    const downloadable = allImages.slice(0, remaining || allImages.length);
    if (!downloadable.length) return;
    const email = ensureDownloadEmail();
    if (!email) return;

    setZipDownloading(true);
    setZipStage("Collecting gallery photos");
    try {
      await recordDownloadActivity(
        email,
        downloadable.map((photo, index) => ({
          imageId: isPersistedImageId(photo._id) ? photo._id : undefined,
          imageName: photo.originalName || `photo-${index + 1}`,
          imageUrl: imageSrc(photo.url),
        })),
        "all",
      );
    } catch (error) {
      setZipDownloading(false);
      setShareNotice(error instanceof Error ? error.message : "Download activity failed");
      return;
    }
    setZipStage("Creating ZIP archive");
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

    if (!response?.ok) {
      setZipDownloading(false);
      const payload = response ? await response.json().catch(() => null) : null;
      setShareNotice(payload?.message ?? "Download failed");
      return;
    }

    try {
      setZipStage("Starting download");
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
    } catch {
      setShareNotice("Download failed");
    } finally {
      setZipDownloading(false);
      setZipStage("Preparing your photos");
    }
  };

  useEffect(() => {
    if (!slideshowEnabled) setSlideshowIndex(null);
  }, [slideshowEnabled]);

  useEffect(() => {
    if (!showSetTabs) return;
    if (!gallerySets.some((set) => set.id === activeSetId)) {
      setActiveSetId(gallerySets[0]?.id ?? "highlights");
    }
  }, [activeSetId, gallerySets, showSetTabs]);

  useEffect(() => {
    setFaceResults(null);
    setSlideshowIndex(null);
  }, [activeSetId]);
  const apiBase = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  const loadMoreImages = async () => {
    if (!collection || imagesLoadingMore || !imagesHasMore) return;
    setImagesLoadingMore(true);
    const params = new URLSearchParams({
      limit: "48",
      offset: String(loadedImages.length),
    });
    const email = accessSettings?.email || visitorEmail || accessEmail;
    if (email) params.set("email", email);
    const identifier = collection.slug ?? galary;
    const response = await fetch(`${apiBase}/public/collections/${encodeURIComponent(identifier)}/images?${params.toString()}`).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    const page = payload?.data;
    if (page?.items?.length) {
      setLoadedImages((current) => {
        const seen = new Set(current.map((image) => image._id));
        return [...current, ...page.items.filter((image: PublicImage) => !seen.has(image._id))];
      });
    }
    setImagesHasMore(Boolean(page?.hasMore));
    setImagesLoadingMore(false);
  };
  useEffect(() => {
    if (!canLoadMoreImages) return;
    const target = loaderRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreImages();
    }, { rootMargin: "900px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMoreImages, loadedImages.length, imagesLoadingMore]);
  const verifyAccessEmail = async () => {
    const email = accessEmail.trim().toLowerCase();
    if (!email.includes("@") || accessBusy) return;
    setAccessBusy(true);
    setAccessNotice("");
    const response = await fetch(`${apiBase}/public/collections/${encodeURIComponent(galary)}?email=${encodeURIComponent(email)}&limit=48&offset=0`).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setAccessBusy(false);
    if (!response?.ok || !payload?.data) {
      setAccessNotice(payload?.message ?? "Access check failed");
      return;
    }
    setCollection(payload.data);
    setLoadedImages(payload.data?.images ?? []);
    setImagesHasMore(Boolean(payload.data?.imagesPage?.hasMore));
    if (payload.data?.settings?.access?.emailAuthorized) {
      setVisitorEmail(email);
      setVisitorEmailSaved(true);
      setDownloadEmail(email);
      window.localStorage.setItem(`collection-access-email:${galary}`, email);
      setAccessNotice("");
    } else {
      setAccessNotice(payload.data?.settings?.access?.emailStatus === "declined" ? "Access declined for this email." : "Email not approved for this gallery.");
    }
  };
  const requestAccess = async () => {
    const email = accessEmail.trim().toLowerCase();
    if (!email.includes("@") || accessBusy) return;
    setAccessBusy(true);
    const response = await fetch(`${apiBase}/public/collections/${encodeURIComponent(galary)}/access-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, reason: accessReason }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setAccessBusy(false);
    setAccessNotice(response?.ok ? "Access request sent. You will be approved by gallery owner." : payload?.message ?? "Request failed");
  };
  useEffect(() => {
    if (!emailAccessLocked || accessEmail || accessBusy) return;
    const saved = window.localStorage.getItem(`collection-access-email:${galary}`) || "";
    if (saved) setAccessEmail(saved);
  }, [accessBusy, accessEmail, emailAccessLocked, galary]);
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
    const startUrl = `${window.location.pathname}${window.location.search}`;
    const manifestHref = `/manifest.webmanifest?start=${encodeURIComponent(startUrl)}`;
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestHref;
  }, []);

  useEffect(() => {
    if (slideshowIndex === null || visibleImages.length <= 1) return;
    const timer = window.setTimeout(showNextSlide, 3200);
    return () => window.clearTimeout(timer);
  }, [slideshowIndex, visibleImages.length]);

  return (
    <>
      {customFontName && design.customFontDataUrl && (
        <style>{`@font-face{font-family:"${customFontName.replace(/"/g, "")}";src:url("${design.customFontDataUrl}");font-display:swap;}`}</style>
      )}
      <ScreenCaptureGuard />
      {emailAccessLocked ? (
        <main className="flex min-h-screen items-center justify-center bg-[#fafafa] p-6">
          <section className="w-full max-w-md border bg-white p-7 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#00a997]">Email access</p>
            <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-[#666]">Enter an approved email to view this gallery.</p>
            <Input value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} placeholder="you@example.com" className="mt-6 h-11 rounded-none" />
            <Button className="mt-3 h-11 w-full rounded-none bg-[#22bda7] text-white" disabled={accessBusy || !accessEmail.includes("@")} onClick={() => void verifyAccessEmail()}>
              {accessBusy ? "Checking..." : "Enter gallery"}
            </Button>
            <div className="mt-6 border-t pt-5">
              <p className="text-sm font-bold">Request access</p>
              <Textarea value={accessReason} onChange={(event) => setAccessReason(event.target.value)} placeholder="Tell the gallery owner why you need access" className="mt-3 min-h-24 rounded-none" />
              <Button variant="outline" className="mt-3 h-10 w-full rounded-none bg-white" disabled={accessBusy || !accessEmail.includes("@")} onClick={() => void requestAccess()}>
                Send request
              </Button>
            </div>
            {accessNotice && <p className="mt-4 text-sm font-semibold text-[#666]">{accessNotice}</p>}
          </section>
        </main>
      ) : (
    <main style={{ backgroundColor: bg, color: fg, fontFamily }} className="min-h-screen overflow-x-hidden scroll-smooth" lang={String(generalSettings.language || "en").slice(0, 2).toLowerCase()}>
      <nav className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-black/5 px-4 sm:px-5 md:px-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
        <p className="truncate text-sm uppercase tracking-[0.24em]">{studioName}</p>
        <div className="hidden lg:block" />
        <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-4" data-print-store-actions-host="true">
          <span data-public-store-cart-host="true" />
          {design.navigationStyle === "Icon & Text" ? (
            <>
              {socialSharingEnabled && (
                <button className="flex items-center gap-2 text-sm" onClick={() => void shareCollection()} type="button">
                  <Share2 className="size-4" /> Share
                </button>
              )}
              <button className="flex items-center gap-2 text-sm" onClick={favoriteTools.openFavorites} type="button">
                <Heart className="size-4" /> My Favorites
              </button>
              {canDownload && (
                <button className="flex items-center gap-2 text-sm disabled:opacity-50" onClick={() => void downloadAllImages()} disabled={zipDownloading} type="button">
                  {zipDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {zipDownloading ? "Preparing" : "Download All"}
                </button>
              )}
            </>
          ) : (
            <>
              {socialSharingEnabled && (
                <button onClick={() => void shareCollection()} type="button" aria-label="Share collection">
                  <Share2 className="size-5" />
                </button>
              )}
              <button onClick={favoriteTools.openFavorites} type="button" aria-label="My Favorites" title="My Favorites">
                <Heart className="size-5" />
              </button>
              {canDownload && (
                <button onClick={() => void downloadAllImages()} disabled={zipDownloading} type="button" aria-label={zipDownloading ? "Preparing ZIP download" : "Download all photos"} title="Download all photos">
                  {zipDownloading ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
                </button>
              )}
            </>
          )}
        </div>
      </nav>

      <section className="px-3 pb-7 sm:px-5 sm:pb-10 md:px-10">
        <CoverPreview
          design={{
            ...design,
            coverTitle: design.coverTitle || title,
            coverSmallTitle: design.coverSmallTitle || studioName,
            branding: collection?.branding,
          }}
          image={coverPhoto}
          className="mx-auto max-w-[1180px]"
        />
      </section>

      <section className="px-0 py-0">
        <div className="sticky top-0 z-20 flex flex-col items-stretch gap-3 border-y border-black/10 bg-white/95 px-3 py-3 text-[#202326] shadow-[0_14px_35px_rgba(0,0,0,0.08)] backdrop-blur sm:px-4 md:px-8 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4 lg:py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.26em] text-black/45">
              Masonry gallery
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2 sm:gap-x-6">
              <h1 className="min-w-0 break-words text-xl font-semibold sm:text-2xl md:text-3xl">{title}</h1>
              {showSetTabs && (
                <div className="-mx-1 flex min-w-0 flex-1 gap-x-4 gap-y-2 overflow-x-auto px-1 pb-1 text-sm font-bold sm:flex-wrap sm:justify-center sm:gap-x-5 sm:overflow-visible sm:pb-0">
                  {gallerySets.map((set) => (
                    <button
                      key={set.id}
                      className={cn(
                        "shrink-0 transition-opacity hover:opacity-100",
                        activeSetId === set.id ? "opacity-100" : "opacity-45",
                      )}
                      onClick={() => setActiveSetId(set.id)}
                      type="button"
                    >
                      {set.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-full border border-black/10 bg-[#f4f4f2] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur lg:w-auto lg:flex-wrap lg:overflow-visible">
            {storeStatus && (
              <button className="inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold transition hover:bg-black/5" type="button" data-public-store-open="true">
                Print Store
              </button>
            )}
            <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#202326] px-4 text-sm font-bold text-white transition hover:opacity-90 md:w-10 md:justify-center md:px-0" title={faceBusy ? "Searching" : "Find me"}>
              {faceBusy ? <Search className="size-4 animate-pulse" /> : <Camera className="size-4" />}
              <span className="hidden sm:inline md:sr-only">{faceBusy ? "Searching" : "Find me"}</span>
              <input type="file" accept="image/*" capture="user" disabled={faceBusy} className="hidden" onChange={(event) => {
                void searchByFace(event.target.files?.[0]);
                event.target.value = "";
              }} />
            </label>
            <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" onClick={() => void loadFaces()} type="button" title="Faces" aria-label="Faces">
              <Search className="size-4" />
              <span className="hidden sm:inline md:sr-only">Faces</span>
            </button>
            {faceResults && (
              <button className="inline-flex h-10 shrink-0 items-center rounded-full border border-black/10 px-4 text-sm font-bold transition hover:bg-black/5" onClick={() => setFaceResults(null)} type="button">
                Show all
              </button>
            )}
            {slideshowEnabled && (
              <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" onClick={startSlideshow} type="button" title="Slideshow" aria-label="Slideshow">
                <Play className="size-4" />
                <span className="hidden sm:inline md:sr-only">Slideshow</span>
              </button>
            )}
            {socialSharingEnabled && (
              <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" onClick={() => void shareCollection()} type="button" title="Share" aria-label="Share">
                <Share2 className="size-4" />
                <span className="hidden sm:inline md:sr-only">Share</span>
              </button>
            )}
            <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 disabled:opacity-50 md:w-10 md:justify-center md:px-0" onClick={() => void toggleCollectionFavorite()} disabled={favoriteBusy} type="button" title="Favorite" aria-label="Favorite">
              <Heart className={cn("size-4", collectionFavorited && "fill-current text-red-500")} />
              <span className="hidden sm:inline md:sr-only">Favorite</span>
            </button>
            {canDownload && (
              <button className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition hover:bg-black/5 disabled:opacity-50" onClick={() => void downloadAllImages()} disabled={zipDownloading} type="button" title="Download all" aria-label={zipDownloading ? "Preparing download" : "Download all"}>
                {zipDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              </button>
            )}
            {pinRequired && !pinOk && (
              <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#202326] px-4 text-sm font-bold text-white transition hover:opacity-90" onClick={() => setPinDialogOpen(true)} type="button">
                <Lock className="size-4" />
                Unlock
              </button>
            )}
          </div>
        </div>

        {galleryAssistEnabled && (
          <div className="mx-4 mt-5 flex max-w-3xl flex-wrap items-center gap-3 border border-black/10 bg-[#f4f4f2] px-4 py-3 text-sm md:mx-8">
            <Check className="size-4" />
            <span>Use favorite, share, slideshow, face search, and download tools from the gallery bar.</span>
          </div>
        )}

        {emailRegistrationEnabled && !visitorEmailSaved && (
          <div className="mx-4 mt-5 flex max-w-xl flex-wrap items-center gap-3 border border-black/10 bg-white px-4 py-3 md:mx-8">
            <input
              value={visitorEmail}
              onChange={(event) => setVisitorEmail(event.target.value)}
              placeholder="Email for gallery access"
              className="h-10 min-w-0 flex-1 border bg-white px-3 text-sm text-black outline-none"
            />
            <button
              className="h-10 shrink-0 bg-[#202326] px-4 text-sm font-bold text-white disabled:opacity-45"
              disabled={!visitorEmail.includes("@")}
              onClick={() => setVisitorEmailSaved(true)}
              type="button"
            >
              Continue
            </button>
          </div>
        )}

        {downloadsEnabled && boolSetting(download.limitDownloads) && maxDownloads > 0 && (
          <p className="mx-4 mt-4 text-sm md:mx-8" style={{ color: accent }}>
            {Math.max(0, maxDownloads - downloadCount)} downloads remaining
          </p>
        )}

        {faceError && <p className="mx-4 mt-5 text-sm font-semibold text-red-600 md:mx-8">{faceError}</p>}
        {shareNotice && (
          <p className="mx-4 mt-5 inline-flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white md:mx-8">
            <Check className="size-4" />
            <span className="min-w-0 break-words">{shareNotice}</span>
          </p>
        )}
        {favoriteSettings?.description && (
          <p className="mx-4 mt-5 max-w-2xl text-sm leading-6 md:mx-8" style={{ color: accent }}>
            {favoriteSettings.description}
          </p>
        )}
        {maxFavoriteCount > 0 && (
          <p className="mx-4 mt-2 text-sm font-semibold md:mx-8" style={{ color: accent }}>
            {favoriteImageIds.size} / {maxFavoriteCount} favorites used
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
          <div className={masonryColumns} style={{ columnGap: `${masonryGapPx}px` }}>
            {visibleImages.map((photo) => (
              <GalleryTile
                key={photo._id}
                photo={photo}
                spacing={masonryGapPx}
                canFavorite={favoritesEnabled}
                canDownload={canDownload}
                canShare={socialSharingEnabled}
                favoriteBusy={favoriteImageBusy === photo._id}
                favorited={favoriteImageIds.has(photo._id)}
                onDownload={downloadPhoto}
                onFavorite={toggleImageFavorite}
                onPreview={setActiveImage}
                onShare={sharePhoto}
              />
            ))}
          </div>
          {canLoadMoreImages && (
            <div ref={loaderRef} className="flex h-24 items-center justify-center">
              {imagesLoadingMore && <Loader2 className="size-6 animate-spin" />}
            </div>
          )}
        </div>
      </section>

      {favoriteTools.overlays}
      {zipDownloading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white p-7 text-center text-[#202326] shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
            <div className="relative mx-auto flex size-20 items-center justify-center rounded-full bg-[#eef8f6] text-[#009b8c]">
              <Download className="size-7 animate-bounce" />
              <span className="absolute inset-0 animate-ping rounded-full border border-[#19bda8]/30" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">Preparing ZIP download</h2>
            <p className="mt-2 text-sm text-[#666]">{zipStage}</p>
            <div className="mx-auto mt-6 flex w-28 items-end justify-center gap-1.5">
              {[0, 1, 2, 3, 4].map((index) => <span key={index} className="h-2 w-3 animate-pulse rounded-full bg-[#18bfa6]" style={{ animationDelay: `${index * 120}ms` }} />)}
            </div>
          </div>
        </div>
      )}
      {pinDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[380px] bg-white p-6 text-[#111] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#777]">Protected downloads</p>
                <h2 className="mt-2 text-2xl font-semibold">Enter PIN</h2>
              </div>
              <button onClick={() => setPinDialogOpen(false)} aria-label="Close PIN dialog">
                <X className="size-5" />
              </button>
            </div>
            <input
              value={pinDraft}
              onChange={(event) => setPinDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") unlockDownloads();
              }}
              placeholder="Download PIN"
              className="mt-6 h-12 w-full border bg-white px-4 text-sm text-black outline-none"
              autoFocus
            />
            {pinDraft && pinDraft.trim() !== String(download.downloadPinCode ?? "").trim() && (
              <p className="mt-3 text-xs font-semibold text-red-600">PIN does not match.</p>
            )}
            <button
              className="mt-5 h-11 w-full bg-[#202326] text-sm font-bold text-white disabled:opacity-50"
              onClick={unlockDownloads}
              disabled={!pinDraft.trim()}
              type="button"
            >
              Unlock downloads
            </button>
          </div>
        </div>
      )}

      {activeImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 px-2 pb-4 pt-24 sm:p-4">
          <button className="polished-icon-button absolute left-3 top-3 sm:left-5 sm:top-5" onClick={() => setActiveImage(null)} aria-label="Back to gallery" title="Back">
            <ChevronLeft className="size-5" />
          </button>
          <div className="absolute left-3 right-3 top-16 flex gap-2 overflow-x-auto pb-1 sm:left-auto sm:right-5 sm:top-5 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
            {showBuyPhotoButton && isPersistedImageId(activeImage._id) && (
              <button className="polished-icon-button" data-buy-photo-open={activeImage._id} data-buy-photo-url={activeImage.url} data-buy-photo-thumbnail={activeImage.thumbnailUrl} data-buy-photo-name={activeImage.originalName} type="button" aria-label="Buy this photo" title="Buy this photo">
                <ShoppingBag className="size-5" />
              </button>
            )}
            {favoritesEnabled && isPersistedImageId(activeImage._id) && (
              <button className="polished-icon-button" onClick={() => void toggleImageFavorite(activeImage)} type="button" aria-label="Favorite" title="Favorite">
                <Heart className={cn("size-5", favoriteImageIds.has(activeImage._id) && "fill-red-500 text-red-500")} />
              </button>
            )}
            {socialSharingEnabled && (
              <button className="polished-icon-button" onClick={() => void sharePhoto(activeImage)} type="button" aria-label="Share" title="Share">
                <Share2 className="size-5" />
              </button>
            )}
            {canDownload && (
              <button className="polished-icon-button" onClick={() => downloadPhoto(activeImage)} type="button" aria-label="Download" title="Download">
                <Download className="size-5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black px-2 pb-4 pt-24 sm:p-4" onDoubleClick={closeSlideshow}>
          <button className="polished-icon-button absolute left-3 top-3 sm:left-5 sm:top-5" onClick={closeSlideshow} aria-label="Back to gallery" title="Back">
            <ChevronLeft className="size-5" />
          </button>
          <div className="absolute right-3 top-3 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-white backdrop-blur sm:left-5 sm:right-auto sm:top-20 sm:px-4">
            {slideshowPosition + 1} / {visibleImages.length}
          </div>
          <button className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-black shadow sm:left-5 sm:p-3" onClick={showPreviousSlide} aria-label="Previous slide" type="button">
            <ChevronLeft className="size-5 sm:size-6" />
          </button>
          <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-black shadow sm:right-5 sm:p-3" onClick={showNextSlide} aria-label="Next slide" type="button">
            <ChevronRight className="size-5 sm:size-6" />
          </button>
          <div className="absolute left-3 right-3 top-16 flex gap-2 overflow-x-auto pb-1 sm:left-auto sm:right-5 sm:top-5 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
            {showBuyPhotoButton && isPersistedImageId(slideshowImage._id) && (
              <button className="polished-icon-button" data-buy-photo-open={slideshowImage._id} data-buy-photo-url={slideshowImage.url} data-buy-photo-thumbnail={slideshowImage.thumbnailUrl} data-buy-photo-name={slideshowImage.originalName} type="button" aria-label="Buy this photo" title="Buy this photo">
                <ShoppingBag className="size-5" />
              </button>
            )}
            {favoritesEnabled && isPersistedImageId(slideshowImage._id) && (
              <button className="polished-icon-button" onClick={() => void toggleImageFavorite(slideshowImage)} type="button" aria-label="Favorite" title="Favorite">
                <Heart className={cn("size-5", favoriteImageIds.has(slideshowImage._id) && "fill-red-500 text-red-500")} />
              </button>
            )}
            {socialSharingEnabled && (
              <button className="polished-icon-button" onClick={() => void sharePhoto(slideshowImage)} type="button" aria-label="Share" title="Share">
                <Share2 className="size-5" />
              </button>
            )}
            {canDownload && (
              <button className="polished-icon-button" onClick={() => downloadPhoto(slideshowImage, slideshowPosition)} type="button" aria-label="Download" title="Download">
                <Download className="size-5" />
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
          <aside className="h-full w-full max-w-[360px] overflow-y-auto bg-white p-5 text-[#111] shadow-[-18px_0_40px_rgba(0,0,0,0.18)] sm:p-6">
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
            <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-5">
              {faces.map((face) => (
                <button key={face.id} className="grid justify-items-center gap-2 text-center" onClick={() => void filterBySavedFace(face.id)}>
                  <span className="block size-16 overflow-hidden rounded-full bg-[#eee] ring-2 ring-[#111]/10 sm:size-20">
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
      )}
    </>
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

function imageSetId(image: PublicImage) {
  return image.setId || "highlights";
}

function safeDownloadName(value: string) {
  return value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "collection";
}

function GalleryTile({
  photo,
  spacing,
  canFavorite,
  canDownload,
  canShare,
  favoriteBusy,
  favorited,
  onDownload,
  onFavorite,
  onPreview,
  onShare,
}: {
  photo: PublicImage;
  spacing: number;
  canFavorite: boolean;
  canDownload: boolean;
  canShare: boolean;
  favoriteBusy: boolean;
  favorited: boolean;
  onDownload: (photo: PublicImage) => void;
  onFavorite: (photo: PublicImage) => void;
  onPreview: (photo: PublicImage) => void;
  onShare: (photo: PublicImage) => void;
}) {
  return (
    <div
      id={`photo-${photo._id}`}
      className="group relative mb-0 w-full break-inside-avoid bg-[#f4f4f2] text-left transition-[box-shadow] duration-300 hover:shadow-[0_18px_45px_rgba(0,0,0,0.16)]"
      style={{ marginBottom: `${spacing}px` }}
    >
      <button className="block w-full" onClick={() => onPreview(photo)}>
        <GalleryImage
          src={imageSrc(displayImageUrl(photo))}
          fallbackSrc={imageSrc(photo.url)}
          alt={photo.originalName ?? ""}
          className="block h-auto w-full"
        />
      </button>
      <div className="absolute right-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1.5 sm:right-3 sm:top-3 sm:gap-2">
        {canFavorite && isPersistedImageId(photo._id) && (
          <button className="polished-icon-button size-9 sm:size-10" onClick={() => onFavorite(photo)} disabled={favoriteBusy} aria-label="Favorite image" title="Favorite" type="button">
            <Heart className={cn("size-4", favorited && "fill-red-500 text-red-500")} />
          </button>
        )}
        <button className="polished-icon-button size-9 sm:size-10" onClick={() => onPreview(photo)} aria-label="View image" title="View">
          <Eye className="size-4" />
        </button>
        {canShare && (
          <button className="polished-icon-button size-9 sm:size-10" onClick={() => onShare(photo)} aria-label="Share image" title="Share" type="button">
            <Share2 className="size-4" />
          </button>
        )}
        {canDownload && (
          <button className="polished-icon-button size-9 sm:size-10" onClick={() => onDownload(photo)} aria-label="Download image" title="Download" type="button">
            <Download className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
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

function decodeRouteText(value: string) {
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
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

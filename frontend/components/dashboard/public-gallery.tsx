"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, Download, Eye, EyeOff, Heart, Loader2, Lock, Play, Search, Share2, ShoppingBag, X } from "lucide-react";

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
  mimetype?: string;
  mediaType?: "image" | "video";
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
      marketingSubscription?: boolean | string;
      galleryAssist?: boolean | string;
      slideshow?: boolean | string;
      slideshowSpeed?: "slow" | "regular" | "fast";
      slideshowAutoLoop?: boolean | string;
      socialSharing?: boolean | string;
      language?: string;
    };
    download?: Partial<PresetDownloadSettings>;
    favorite?: { favoritePhotos?: boolean; favoriteNotes?: boolean; maxFavorites?: string; description?: string };
    store?: { storeStatus?: boolean; enabled?: boolean; showPrintStoreNav?: boolean; showBuyPhotoButton?: boolean };
    access?: { emailRequired?: boolean; emailAuthorized?: boolean; emailStatus?: string; email?: string };
  };
  preferences?: {
    filenameDisplay?: "show" | "hide";
    searchEngineVisibility?: "homepage" | "all" | "hidden";
    sharpeningLevel?: "optimal" | "low" | "high";
    rawPhotoSupport?: boolean;
    termsOfService?: string;
    privacyPolicy?: string;
  };
  marketing?: {
    optIn?: {
      emailRegistration?: boolean;
      storeCheckout?: boolean;
      download?: boolean;
      favoriteSignIn?: boolean;
    };
    popup?: {
      enabled?: boolean;
      title?: string;
      body?: string;
      button?: string;
      imageUrl?: string;
    };
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
  galleryDownload: true,
  singlePhotoDownload: true,
  singlePhotoDownloadEmailTracking: true,
  restrictedSinglePhotoDownloadSize: false,
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
  const slideshowSpeed = (generalSettings.slideshowSpeed ?? "regular") as "slow" | "regular" | "fast";
  const slideshowDelay = slideshowSpeed === "slow" ? 5200 : slideshowSpeed === "fast" ? 1800 : 3200;
  const slideshowAutoLoop = boolSetting(generalSettings.slideshowAutoLoop ?? true);
  const socialSharingEnabled = boolSetting(generalSettings.socialSharing ?? true);
  const galleryAssistEnabled = boolSetting(generalSettings.galleryAssist);
  const emailRegistrationEnabled = boolSetting(generalSettings.emailRegistration);
  const marketingSubscriptionEnabled = boolSetting(
    generalSettings.marketingSubscription ?? true,
  );
  const marketing = collection?.marketing ?? {};
  const marketingOptIn = marketing.optIn ?? {};
  const marketingPopup = marketing.popup ?? {};
  const marketingEmailRegistrationEnabled = marketingOptIn.emailRegistration !== false;
  const marketingPopupEnabled = marketingPopup.enabled !== false;
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
  const gallerySets = useMemo(() => {
    const seen = new Set<string>();
    const unique = (collection?.sets ?? []).filter((set) => {
      const id = String(set?.id ?? "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return unique.length ? unique : [{ id: "highlights", name: "Highlights" }];
  }, [collection?.sets]);
  const showSetTabs = gallerySets.length > 0;
  const coverPhoto = imageSrc(collection?.coverImage || images.find((image) => !isVideo(image))?.url || "");
  const [activeSetId, setActiveSetId] = useState(() => gallerySets[0]?.id ?? "highlights");
  const [activeImage, setActiveImage] = useState<PublicImage | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [downloadCount, setDownloadCount] = useState(0);
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorEmailSaved, setVisitorEmailSaved] = useState(false);
  const [visitorMarketingOptIn, setVisitorMarketingOptIn] = useState(true);
  const [downloadMarketingOptIn, setDownloadMarketingOptIn] = useState(true);
  const [popupOpen, setPopupOpen] = useState(() =>
    Boolean(marketingSubscriptionEnabled && marketingPopupEnabled),
  );
  const [popupEmail, setPopupEmail] = useState("");
  const [privateImageIds, setPrivateImageIds] = useState<Set<string>>(() => new Set());
  const [privateImageBusy, setPrivateImageBusy] = useState("");
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
  const [downloadEmailDraft, setDownloadEmailDraft] = useState("");
  const [downloadEmailOpen, setDownloadEmailOpen] = useState(false);
  const [quickShareDownload, setQuickShareDownload] = useState<string | null>(null);
  const [pendingDownload, setPendingDownload] = useState<
    { type: "single"; photo: PublicImage; index: number } | { type: "all" } | null
  >(null);
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
  const photoDownloadsEnabled =
    quickShareDownload === "1"
      ? true
      : quickShareDownload === "0"
        ? false
        : boolSetting(download.photoDownload);
  const videoDownloadsEnabled = boolSetting(download.videoDownload);
  const galleryDownloadEnabled = download.galleryDownload !== false;
  const singlePhotoDownloadEnabled = download.singlePhotoDownload !== false;
  const singlePhotoDownloadEmailTracking = download.singlePhotoDownloadEmailTracking !== false;
  const restrictedSinglePhotoDownloadSize = Boolean(download.restrictedSinglePhotoDownloadSize);
  const preferences = collection?.preferences ?? {};
  const showFilenames = preferences.filenameDisplay !== "hide";
  const sharpeningLevel = preferences.sharpeningLevel ?? "optimal";
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
    marketingOptIn: marketingOptIn.favoriteSignIn,
    siteSlug: name,
  });
  const {
    favoriteImageIds,
    favoriteImageBusy,
    toggleImageFavorite,
  } = favoriteTools;
  const [favoritesPanelOpen, setFavoritesPanelOpen] = useState(false);
  const favoriteGalleryImages = useMemo(
    () => galleryImages.filter((image) => favoriteImageIds.has(image._id)),
    [favoriteImageIds, galleryImages],
  );
  const pinRequired = (photoDownloadsEnabled || videoDownloadsEnabled) && boolSetting(download.downloadPin);
  const pinOk = !pinRequired || enteredPin.trim() === String(download.downloadPinCode ?? "").trim();
  const limitOk = !boolSetting(download.limitDownloads) || maxDownloads <= 0 || downloadCount < maxDownloads;
  const canDownloadPhoto = photoDownloadsEnabled && pinOk && limitOk;
  const canDownloadVideo = videoDownloadsEnabled && pinOk && limitOk;
  const canDownloadAll = canDownloadPhoto && galleryDownloadEnabled;
  const canDownloadSingle = canDownloadPhoto && singlePhotoDownloadEnabled;
  const canDownloadMedia = (photo: PublicImage) =>
    isVideo(photo) ? canDownloadVideo : canDownloadSingle;
  const onDownload = () => setDownloadCount((count) => count + 1);
  const unlockDownloads = () => {
    setEnteredPin(pinDraft.trim());
    if (pinDraft.trim() === String(download.downloadPinCode ?? "").trim()) {
      setPinDialogOpen(false);
      setShareNotice("Downloads unlocked");
    }
  };
  const recordEmailRegistration = async (
    email: string,
    marketingAccepted: boolean,
    source: "email-registration" | "popup" | "download" | "favorite",
  ) => {
    const identifier = collection?.slug ?? galary;
    const response = await fetch(
      `/api/public/collections/${encodeURIComponent(identifier)}/email-registration?siteSlug=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          marketingOptIn: marketingAccepted,
          source,
        }),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || "Email registration failed");
    return payload?.data;
  };

  const savedDownloadEmail = () => downloadEmail || window.localStorage.getItem("pixieset-download-email") || "";
  const openDownloadEmail = (pending: typeof pendingDownload) => {
    setDownloadEmailDraft(savedDownloadEmail());
    setPendingDownload(pending);
    setDownloadEmailOpen(true);
  };
  const persistDownloadEmail = (value: string) => {
    const email = value.trim().toLowerCase();
    if (!email.includes("@")) return "";
    setDownloadEmail(email);
    window.localStorage.setItem("pixieset-download-email", email);
    return email;
  };
  const submitDownloadEmail = () => {
    const email = persistDownloadEmail(downloadEmailDraft);
    if (!email) {
      setShareNotice("Email is required before download");
      return;
    }
    if (marketingOptIn.download && downloadMarketingOptIn) {
      void recordEmailRegistration(email, true, "download").catch(() => null);
    }
    const pending = pendingDownload;
    setDownloadEmailOpen(false);
    setPendingDownload(null);
    if (pending?.type === "single") void downloadPhoto(pending.photo, pending.index, email);
    if (pending?.type === "all") void downloadAllImages(email);
  };
  const ensureDownloadEmail = (pending: typeof pendingDownload, emailOverride = "") => {
    const existing = emailOverride || savedDownloadEmail();
    if (!existing.trim() || !existing.includes("@")) {
      openDownloadEmail(pending);
      return "";
    }
    return persistDownloadEmail(existing);
  };
  const recordDownloadActivity = async (
    email: string,
    items: Array<{ imageId?: string; imageName?: string; imageUrl?: string }>,
    downloadType: "single" | "all",
  ) => {
    const identifier = collection?.slug ?? galary;
    const response = await fetch(`${apiBase}/public/collections/${encodeURIComponent(identifier)}/download-activity?siteSlug=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, items, downloadType }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => null) : null;
      throw new Error(payload?.message ?? "Download activity failed");
    }
  };
  const downloadPhoto = async (photo: PublicImage, index = 0, emailOverride = "") => {
    if (!canDownloadMedia(photo)) return;
    let email = "";
    if (singlePhotoDownloadEmailTracking) {
      email = ensureDownloadEmail({ type: "single", photo, index }, emailOverride);
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
    }
    const downloadSource = restrictedSinglePhotoDownloadSize
      ? imageSrc(photo.thumbnailUrl || photo.url)
      : imageSrc(photo.url);
    const url = `/api/public-download?url=${encodeURIComponent(downloadSource)}&name=${encodeURIComponent(photo.originalName || `photo-${index + 1}`)}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    onDownload();
  };
  const downloadAllImages = async (emailOverride = "") => {
    if (!canDownloadAll || zipDownloading) return;
    const email = ensureDownloadEmail({ type: "all" }, emailOverride);
    if (!email) return;
    let allImages = galleryImages.filter((photo) => !isVideo(photo));
    if (collection && imagesHasMore) {
      setZipStage("Loading remaining gallery photos");
      let offset = loadedImages.length;
      let hasMore = imagesHasMore;
      const loaded: PublicImage[] = [];
      while (hasMore) {
        const params = new URLSearchParams({ limit: "120", offset: String(offset), siteSlug: name });
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
        allImages = [...allImages, ...loaded.filter((image) => !seen.has(image._id) && !isVideo(image))];
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
      siteSlug: name,
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
    if (!/^\S+@\S+\.\S+$/.test(email) || accessBusy) return;
    setAccessBusy(true);
    setAccessNotice("");
    try {
      await recordEmailRegistration(
        email,
        Boolean(
          marketingSubscriptionEnabled &&
            marketingEmailRegistrationEnabled &&
            visitorMarketingOptIn,
        ),
        "email-registration",
      );
      const response = await fetch(`${apiBase}/public/collections/${encodeURIComponent(galary)}?email=${encodeURIComponent(email)}&limit=48&offset=0&siteSlug=${encodeURIComponent(name)}`).catch(() => null);
      const payload = response ? await response.json().catch(() => null) : null;
      if (!response?.ok || !payload?.data) {
        setAccessNotice(payload?.message ?? "Access check failed");
        return;
      }
      setCollection(payload.data);
      setLoadedImages(payload.data?.images ?? []);
      setImagesHasMore(Boolean(payload.data?.imagesPage?.hasMore));
      setVisitorEmail(email);
      setVisitorEmailSaved(true);
      setDownloadEmail(email);
      window.localStorage.setItem(`collection-access-email:${galary}`, email);
      setAccessNotice("");
    } catch (error) {
      setAccessNotice(error instanceof Error ? error.message : "Email registration failed");
    } finally {
      setAccessBusy(false);
    }
  };

  const requestAccess = async () => {
    const email = accessEmail.trim().toLowerCase();
    if (!email.includes("@") || accessBusy) return;
    setAccessBusy(true);
    const response = await fetch(`${apiBase}/public/collections/${encodeURIComponent(galary)}/access-request?siteSlug=${encodeURIComponent(name)}`, {
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
  const togglePrivatePhoto = async (photo: PublicImage) => {
    if (!isPersistedImageId(photo._id) || privateImageBusy) return;
    let email =
      accessSettings?.email ||
      visitorEmail ||
      favoriteTools.favoriteEmail ||
      downloadEmail ||
      window.localStorage.getItem(`collection-access-email:${galary}`) ||
      "";
    if (!email.includes("@")) {
      email = window.prompt("Enter your email to request hiding this photo", "")?.trim().toLowerCase() || "";
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setShareNotice("Email is required");
      return;
    }
    setPrivateImageBusy(photo._id);
    try {
      const response = await fetch(
        `/api/public/collections/${encodeURIComponent(collection?.slug ?? galary)}/private-images/${encodeURIComponent(photo._id)}?siteSlug=${encodeURIComponent(name)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Private photo update failed");
      setPrivateImageIds((current) => {
        const next = new Set(current);
        if (payload?.data?.requested) next.add(photo._id);
        else next.delete(photo._id);
        if (collection?._id) {
          window.localStorage.setItem(
            `collection-private-photos:${collection._id}`,
            JSON.stringify(Array.from(next)),
          );
        }
        return next;
      });
      setShareNotice(payload?.data?.requested ? "Hide request sent" : "Hide request cancelled");
    } catch (error) {
      setShareNotice(error instanceof Error ? error.message : "Private photo update failed");
    } finally {
      setPrivateImageBusy("");
    }
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
  const showNextSlide = () => setSlideshowIndex((index) => {
    if (!visibleImages.length || index === null) return 0;
    if (index >= visibleImages.length - 1) return slideshowAutoLoop ? 0 : index;
    return index + 1;
  });
  const showPreviousSlide = () => setSlideshowIndex((index) => {
    if (!visibleImages.length || index === null) return 0;
    if (index <= 0) return slideshowAutoLoop ? visibleImages.length - 1 : 0;
    return index - 1;
  });
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
    if (!collection?._id) return;
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(`collection-private-photos:${collection._id}`) || "[]",
      );
      setPrivateImageIds(new Set(Array.isArray(saved) ? saved : []));
    } catch {
      setPrivateImageIds(new Set());
    }
  }, [collection?._id]);

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
    setQuickShareDownload(new URLSearchParams(window.location.search).get("download"));
  }, []);

  useEffect(() => {
    if (slideshowIndex === null || visibleImages.length <= 1) return;
    if (!slideshowAutoLoop && slideshowIndex >= visibleImages.length - 1) return;
    const timer = window.setTimeout(showNextSlide, slideshowDelay);
    return () => window.clearTimeout(timer);
  }, [slideshowAutoLoop, slideshowDelay, slideshowIndex, visibleImages.length]);

  useEffect(() => {
    setPopupOpen(
      Boolean(
        collection &&
          marketingSubscriptionEnabled &&
          marketingPopupEnabled &&
          !emailAccessLocked,
      ),
    );
  }, [collection?._id, emailAccessLocked, marketingPopupEnabled, marketingSubscriptionEnabled]);

  const closeMarketingPopup = () => setPopupOpen(false);

  const submitMarketingPopup = async () => {
    const email = popupEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    try {
      await recordEmailRegistration(email, true, "popup");
      window.localStorage.setItem("gallery-marketing-email", email);
      closeMarketingPopup();
    } catch (error) {
      setShareNotice(error instanceof Error ? error.message : "Subscription failed");
    }
  };

  return (
    <>
      {customFontName && design.customFontDataUrl && (
        <style>{`@font-face{font-family:"${customFontName.replace(/"/g, "")}";src:url("${design.customFontDataUrl}");font-display:swap;}`}</style>
      )}
      <ScreenCaptureGuard />
      {popupOpen && marketingSubscriptionEnabled && marketingPopupEnabled && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="relative w-full max-w-[450px] bg-white p-8 text-[#111] shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-10">
            <button className="absolute right-4 top-4" onClick={closeMarketingPopup} aria-label="Close marketing signup" type="button">
              <X className="size-5" />
            </button>
            {marketingPopup.imageUrl && <img src={marketingPopup.imageUrl} alt="" className="mb-6 h-32 w-full object-cover" />}
            <h2 className="text-2xl font-bold uppercase tracking-[0.12em]">{marketingPopup.title || "Stay Connected"}</h2>
            <p className="mt-6 whitespace-pre-line text-sm leading-6">{marketingPopup.body || "Sign up to get updates and special offers."}</p>
            <input
              value={popupEmail}
              onChange={(event) => setPopupEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitMarketingPopup();
              }}
              placeholder="Your email"
              className="mt-7 h-12 w-full border bg-white px-4 text-sm outline-none"
              autoFocus
            />
            <button className="mt-5 h-11 w-full bg-[#333] text-xs font-bold uppercase tracking-[0.18em] text-white disabled:opacity-50" disabled={!popupEmail.includes("@")} onClick={submitMarketingPopup} type="button">
              {marketingPopup.button || "Subscribe"}
            </button>
            <p className="mt-7 text-xs leading-5 text-[#777]">
              By signing up, you agree to receive promotional emails and updates. You can unsubscribe anytime.
            </p>
          </div>
        </div>
      )}
      {emailAccessLocked ? (
      <main className="relative flex min-h-screen items-center justify-center bg-[#f6f6f4] p-6">
        <section className="w-full max-w-md bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.14)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#00a997]">Email registration</p>
          <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#666]">
            Enter your email address to view this collection.
          </p>
          <Input
            type="email"
            value={accessEmail}
            onChange={(event) => setAccessEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void verifyAccessEmail();
            }}
            placeholder="you@example.com"
            className="mt-6 h-11 rounded-none"
            autoFocus
          />
          {marketingSubscriptionEnabled && marketingEmailRegistrationEnabled && (
            <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#666]">
              <input
                type="checkbox"
                checked={visitorMarketingOptIn}
                onChange={(event) => setVisitorMarketingOptIn(event.target.checked)}
                className="mt-1"
              />
              <span>Subscribe to updates and special offers.</span>
            </label>
          )}
          <Button
            className="mt-5 h-11 w-full rounded-none bg-[#22bda7] text-white"
            disabled={accessBusy || !accessEmail.includes("@")}
            onClick={() => void verifyAccessEmail()}
          >
            {accessBusy ? "Opening..." : "View collection"}
          </Button>
          {accessNotice && <p className="mt-4 text-sm font-semibold text-red-600">{accessNotice}</p>}
        </section>
      </main>
      ) : (
    <main style={{ backgroundColor: bg, color: fg, fontFamily }} className="min-h-screen overflow-x-hidden scroll-smooth" lang={String(generalSettings.language || "en").slice(0, 2).toLowerCase()}>
      <section className="px-3 pb-7 pt-3 sm:px-5 sm:pb-10 md:px-10">
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
        <div className="sticky top-0 z-20 grid min-h-[76px] grid-cols-1 items-center gap-3 border-y border-black/10 bg-white/95 px-4 py-3 text-[#202326] shadow-[0_10px_28px_rgba(0,0,0,0.08)] backdrop-blur md:grid-cols-[minmax(180px,0.75fr)_minmax(0,1.6fr)_auto] md:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold uppercase tracking-[0.12em]">{title}</h1>
            <p className="mt-1 truncate text-[11px] uppercase tracking-[0.22em] text-black/45">{studioName}</p>
          </div>
          <div className="-mx-1 flex min-w-0 gap-5 overflow-x-auto px-1 text-xs font-semibold uppercase tracking-[0.12em] md:justify-center">
            {storeStatus && (
              <button className="shrink-0 text-black/70 transition hover:text-black" type="button" data-public-store-open="true">
                Print Store
              </button>
            )}
            {showSetTabs && gallerySets.map((set) => (
              <button
                key={set.id}
                className={cn(
                  "shrink-0 transition hover:text-black",
                  activeSetId === set.id ? "text-black" : "text-black/45",
                )}
                onClick={() => setActiveSetId(set.id)}
                type="button"
              >
                {set.name}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span data-public-store-cart-host="true" />
            <button className="inline-flex size-10 shrink-0 items-center justify-center border-l border-black/10 text-black/70 transition hover:text-black" onClick={() => setFavoritesPanelOpen((value) => !value)} type="button" title="My Favorite" aria-label="My Favorite">
              <Heart className={cn("size-5", favoritesPanelOpen && "fill-current text-red-500")} />
            </button>
            {canDownloadAll && (
              <button className="inline-flex size-10 shrink-0 items-center justify-center text-black/70 transition hover:text-black disabled:opacity-50" onClick={() => void downloadAllImages()} disabled={zipDownloading} type="button" title="Download all" aria-label={zipDownloading ? "Preparing download" : "Download all"}>
                {zipDownloading ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
              </button>
            )}
            {socialSharingEnabled && (
              <button className="inline-flex size-10 shrink-0 items-center justify-center text-black/70 transition hover:text-black" onClick={() => void shareCollection()} type="button" title="Share" aria-label="Share">
                <Share2 className="size-5" />
              </button>
            )}
            {slideshowEnabled && (
              <button className="inline-flex size-10 shrink-0 items-center justify-center text-black/70 transition hover:text-black" onClick={startSlideshow} type="button" title="Slideshow" aria-label="Slideshow">
                <Play className="size-5" />
              </button>
            )}
            <label className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center text-black/70 transition hover:text-black" title={faceBusy ? "Searching" : "Find me"} aria-label="Find me">
              {faceBusy ? <Search className="size-5 animate-pulse" /> : <Camera className="size-5" />}
              <input type="file" accept="image/*" capture="user" disabled={faceBusy} className="hidden" onChange={(event) => {
                void searchByFace(event.target.files?.[0]);
                event.target.value = "";
              }} />
            </label>
            <button className="inline-flex size-10 shrink-0 items-center justify-center text-black/70 transition hover:text-black" onClick={() => void loadFaces()} type="button" title="Faces" aria-label="Faces">
              <Search className="size-5" />
            </button>
            {faceResults && (
              <button className="inline-flex h-10 shrink-0 items-center border border-black/10 px-3 text-xs font-bold uppercase tracking-[0.12em]" onClick={() => setFaceResults(null)} type="button">
                Show all
              </button>
            )}
            {pinRequired && !pinOk && (
              <button className="inline-flex h-10 shrink-0 items-center gap-2 bg-[#202326] px-4 text-sm font-bold text-white transition hover:opacity-90" onClick={() => setPinDialogOpen(true)} type="button">
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

        {favoritesPanelOpen && (
          <section className="border-b border-black/10 bg-[#fbfaf8] px-4 py-7 md:px-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/45">My Favorite</p>
                <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
              </div>
              <p className="text-sm text-black/55">{favoriteGalleryImages.length} photo{favoriteGalleryImages.length === 1 ? "" : "s"}</p>
            </div>
            {favoriteGalleryImages.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {favoriteGalleryImages.map((photo) => (
                  <button key={photo._id} className="group relative aspect-[4/3] overflow-hidden bg-white" onClick={() => setActiveImage(photo)} type="button">
                    <img src={imageSrc(photo.thumbnailUrl || photo.url)} alt={photo.originalName ?? ""} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white text-red-500 shadow">
                      <Heart className="size-4 fill-current" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-36 items-center justify-center border border-dashed border-black/15 bg-white text-sm text-black/50">
                Favorite photos from this collection will show here.
              </div>
            )}
          </section>
        )}

        {emailRegistrationEnabled && !visitorEmailSaved && (
          <div className="mx-4 mt-5 flex max-w-xl flex-wrap items-center gap-3 border border-black/10 bg-white px-4 py-3 md:mx-8">
            <input
              value={visitorEmail}
              onChange={(event) => setVisitorEmail(event.target.value)}
              placeholder="Email for gallery access"
              className="h-10 min-w-0 flex-1 border bg-white px-3 text-sm text-black outline-none"
            />
            {marketingOptIn.emailRegistration && (
              <label className="flex min-w-full items-center gap-2 text-xs text-[#666]">
                <input type="checkbox" checked={visitorMarketingOptIn} onChange={(event) => setVisitorMarketingOptIn(event.target.checked)} />
                <span>Send me updates and special offers.</span>
              </label>
            )}
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

        {(photoDownloadsEnabled || videoDownloadsEnabled) && boolSetting(download.limitDownloads) && maxDownloads > 0 && (
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
                canDownload={canDownloadMedia(photo)}
                canShare={socialSharingEnabled}
                sharpeningLevel={sharpeningLevel}
                favoriteBusy={favoriteImageBusy === photo._id}
                favorited={favoriteImageIds.has(photo._id)}
                privatePhoto={privateImageIds.has(photo._id)}
                privateBusy={privateImageBusy === photo._id}
                onPrivate={togglePrivatePhoto}
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

      {(preferences.termsOfService || preferences.privacyPolicy) && (
        <section className="border-t border-black/10 bg-white px-5 py-8 md:px-8">
          <div className="mx-auto grid max-w-4xl gap-4 text-sm leading-6" style={{ color: fg }}>
            {preferences.termsOfService && (
              <details className="border border-black/10 p-4">
                <summary className="cursor-pointer font-bold">Terms of Service</summary>
                <p className="mt-3 whitespace-pre-line text-[#666]">{preferences.termsOfService}</p>
              </details>
            )}
            {preferences.privacyPolicy && (
              <details className="border border-black/10 p-4">
                <summary className="cursor-pointer font-bold">Privacy Policy</summary>
                <p className="mt-3 whitespace-pre-line text-[#666]">{preferences.privacyPolicy}</p>
              </details>
            )}
          </div>
        </section>
      )}

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
      {downloadEmailOpen && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-[390px] bg-white p-6 text-[#111] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#777]">Download access</p>
                <h2 className="mt-2 text-2xl font-semibold">Enter your email</h2>
              </div>
              <button onClick={() => { setDownloadEmailOpen(false); setPendingDownload(null); }} aria-label="Close email dialog">
                <X className="size-5" />
              </button>
            </div>
            <input
              value={downloadEmailDraft}
              onChange={(event) => setDownloadEmailDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitDownloadEmail();
              }}
              placeholder="you@example.com"
              className="mt-6 h-12 w-full border bg-white px-4 text-sm text-black outline-none"
              autoFocus
            />
            {marketingOptIn.download && (
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#666]">
                <input type="checkbox" checked={downloadMarketingOptIn} onChange={(event) => setDownloadMarketingOptIn(event.target.checked)} className="mt-1" />
                <span>Send me updates and special offers.</span>
              </label>
            )}
            <button
              className="mt-5 h-11 w-full bg-[#202326] text-sm font-bold text-white disabled:opacity-50"
              onClick={submitDownloadEmail}
              disabled={!downloadEmailDraft.includes("@")}
              type="button"
            >
              Continue download
            </button>
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
              <button className="polished-icon-button" data-buy-photo-open={activeImage._id} data-buy-photo-url={activeImage.url} data-buy-photo-thumbnail={activeImage.thumbnailUrl} data-buy-photo-name={activeImage.originalName} data-buy-photo-media-type={activeImage.mediaType} type="button" aria-label="Buy this photo" title="Buy this photo">
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
            {activeImage && canDownloadMedia(activeImage) && (
              <button className="polished-icon-button" onClick={() => downloadPhoto(activeImage)} type="button" aria-label="Download" title="Download">
                <Download className="size-5" />
              </button>
            )}
          </div>
          {isVideo(activeImage) ? (
            <video src={imageSrc(activeImage.url)} className="max-h-full max-w-full object-contain" controls autoPlay />
          ) : (
            <img
              src={imageSrc(activeImage.url)}
              alt={activeImage.originalName ?? ""}
              className="max-h-full max-w-full object-contain"
            />
          )}
          {showFilenames && activeImage.originalName && (
            <p className="absolute bottom-4 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              {activeImage.originalName}
            </p>
          )}
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
              <button className="polished-icon-button" data-buy-photo-open={slideshowImage._id} data-buy-photo-url={slideshowImage.url} data-buy-photo-thumbnail={slideshowImage.thumbnailUrl} data-buy-photo-name={slideshowImage.originalName} data-buy-photo-media-type={slideshowImage.mediaType} type="button" aria-label="Buy this photo" title="Buy this photo">
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
            {canDownloadMedia(slideshowImage) && (
              <button className="polished-icon-button" onClick={() => downloadPhoto(slideshowImage, slideshowPosition)} type="button" aria-label="Download" title="Download">
                <Download className="size-5" />
              </button>
            )}
          </div>
          {isVideo(slideshowImage) ? (
            <video key={slideshowImage._id} src={imageSrc(slideshowImage.url)} className="max-h-full max-w-full object-contain" controls autoPlay />
          ) : (
            <img
              key={slideshowImage._id}
              src={imageSrc(slideshowImage.url)}
              alt={slideshowImage.originalName ?? ""}
              className="max-h-full max-w-full animate-in fade-in zoom-in-95 object-contain duration-500"
            />
          )}
          {showFilenames && slideshowImage.originalName && (
            <p className="absolute bottom-4 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-black shadow">
              {slideshowImage.originalName}
            </p>
          )}
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

function sharpenStyle(level: "optimal" | "low" | "high"): CSSProperties | undefined {
  if (level === "low") return { filter: "contrast(1.01)" };
  if (level === "high") return { filter: "contrast(1.08) saturate(1.04)" };
  return { filter: "contrast(1.04) saturate(1.02)" };
}

function isVideo(image: PublicImage) {
  return image.mediaType === "video" || String(image.mimetype || "").startsWith("video/");
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
  sharpeningLevel,
  favoriteBusy,
  favorited,
  privatePhoto,
  privateBusy,
  onPrivate,
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
  sharpeningLevel: "optimal" | "low" | "high";
  favoriteBusy: boolean;
  favorited: boolean;
  privatePhoto: boolean;
  privateBusy: boolean;
  onPrivate: (photo: PublicImage) => void;
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
        {isVideo(photo) ? (
          <span className="relative block aspect-video w-full bg-black">
            <video src={imageSrc(photo.url)} className="h-full w-full object-cover opacity-80" preload="metadata" muted />
            <span className="absolute inset-0 flex items-center justify-center text-white">
              <Play className="size-10 fill-current" />
            </span>
          </span>
        ) : (
          <GalleryImage
            src={imageSrc(displayImageUrl(photo))}
            fallbackSrc={imageSrc(photo.url)}
            alt={photo.originalName ?? ""}
            className="block h-auto w-full"
            style={sharpenStyle(sharpeningLevel)}
          />
        )}
      </button>
      <div className="absolute right-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1.5 sm:right-3 sm:top-3 sm:gap-2">
        {canFavorite && isPersistedImageId(photo._id) && (
          <button className="polished-icon-button size-9 sm:size-10" onClick={() => onFavorite(photo)} disabled={favoriteBusy} aria-label="Favorite image" title="Favorite" type="button">
            <Heart className={cn("size-4", favorited && "fill-red-500 text-red-500")} />
          </button>
        )}
        {isPersistedImageId(photo._id) && (
          <button
            className="polished-icon-button size-9 sm:size-10"
            onClick={() => onPrivate(photo)}
            disabled={privateBusy}
            aria-label={privatePhoto ? "Hide request pending" : "Request hide"}
            title={privatePhoto ? "Hide request pending" : "Request hide"}
            type="button"
          >
            <EyeOff className={cn("size-4", privatePhoto && "text-[#00a997]")} />
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

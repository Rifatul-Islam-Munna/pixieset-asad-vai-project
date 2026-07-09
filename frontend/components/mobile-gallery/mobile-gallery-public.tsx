"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import {
  Check,
  Download,
  Globe2,
  Heart,
  Home,
  Mail,
  MapPin,
  Phone,
  Share2,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";
import type { MobileGalleryApp, MobileGalleryImage, MobileGalleryProfile } from "@/api-hooks/use-mobile-gallery";
import { ScreenCaptureGuard } from "@/components/privacy/screen-capture-guard";
import { MobileGalleryCover, mobileGalleryThemes } from "./mobile-gallery-cover";

type DeferredPrompt = Event & {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

type PublicTab = "home" | "favorites" | "share" | "account";

export function MobileGalleryPublic({
  app,
  profile = {},
  embedded = false,
}: {
  app: MobileGalleryApp;
  profile?: MobileGalleryProfile;
  embedded?: boolean;
}) {
  const [images, setImages] = useState<MobileGalleryImage[]>(app.images ?? []);
  const [imagesHasMore, setImagesHasMore] = useState(Boolean(app.imagesPage?.hasMore));
  const [imagesLoadingMore, setImagesLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const design = app.design ?? {};
  const theme = mobileGalleryThemes[design.theme ?? "lark"];
  const [tab, setTab] = useState<PublicTab>("home");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState<MobileGalleryImage | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<DeferredPrompt | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assetCaching, setAssetCaching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const assetCachingRef = useRef(false);
  const storageKey = `mobile-gallery-favorites:${app.slug}`;
  const assetCacheName = `mobile-gallery-assets:${app.slug}`;
  const galleryAssetUrls = useMemo(
    () => Array.from(new Set([
      app.coverImage,
      app.iconUrl,
      profile.logoUrl,
      ...images.flatMap((image) => [image.thumbnailUrl, image.url]),
    ].filter(Boolean) as string[])),
    [app.coverImage, app.iconUrl, images, profile.logoUrl],
  );

  useEffect(() => {
    setImages(app.images ?? []);
    setImagesHasMore(Boolean(app.imagesPage?.hasMore));
  }, [app.images, app.imagesPage?.hasMore]);

  const cacheGalleryAssets = useCallback(async (silent = false) => {
    if (embedded || assetCachingRef.current || !("caches" in window) || !galleryAssetUrls.length) return;
    assetCachingRef.current = true;
    setAssetCaching(true);
    if (!silent) setNotice("Saving gallery for offline use");
    try {
      const cache = await caches.open(assetCacheName);
      await Promise.allSettled(galleryAssetUrls.map(async (url) => {
        const request = new Request(url, { mode: url.startsWith("/") || url.startsWith(window.location.origin) ? "same-origin" : "cors", cache: "reload" });
        const response = await fetch(request).catch(() => fetch(url, { mode: "no-cors", cache: "reload" }));
        if (response) await cache.put(url, response);
      }));
      if (!silent) setNotice("Gallery saved on this device");
    } catch {
      if (!silent) setNotice("Offline save could not finish");
    } finally {
      assetCachingRef.current = false;
      setAssetCaching(false);
    }
  }, [assetCacheName, embedded, galleryAssetUrls]);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(storageKey) || "[]"));
      if (!embedded && !isStandalone) {
        const timer = window.setTimeout(() => setInstallOpen(true), 700);
        return () => window.clearTimeout(timer);
      }
    } catch {
      setFavorites([]);
    }
  }, [embedded, isStandalone, storageKey]);

  useEffect(() => {
    const handler = (event: Event) => {
      const promptEvent = event as DeferredPrompt;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
      if (!embedded && !isStandalone) setInstallOpen(true);
    };
    const installed = () => {
      setIsStandalone(true);
      setInstallOpen(false);
      setInstallPrompt(null);
      setNotice("Gallery app installed");
      void cacheGalleryAssets();
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, [cacheGalleryAssets, embedded, isStandalone]);

  useEffect(() => {
    if (embedded) return;
    const manifestHref = `/mobile-gallery/${encodeURIComponent(app.slug)}/manifest.webmanifest`;
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestHref;
  }, [app.slug, embedded]);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const appleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(appleMobile);
    setIsStandalone(Boolean(navigatorWithStandalone.standalone) || window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  useEffect(() => {
    if (embedded || !isStandalone) return;
    void cacheGalleryAssets(true);
    const refresh = () => {
      if (!document.hidden && navigator.onLine) void cacheGalleryAssets(true);
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [cacheGalleryAssets, embedded, isStandalone]);

  useEffect(() => {
    setSelecting(false);
    setSelectedIds([]);
  }, [tab]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const favoriteImages = useMemo(
    () => images.filter((image) => favorites.includes(image._id)),
    [favorites, images],
  );
  const visibleImages = tab === "favorites" ? favoriteImages : images;
  const selectedImages = useMemo(
    () => visibleImages.filter((image) => selectedIds.includes(image._id)),
    [selectedIds, visibleImages],
  );

  const toggleFavorite = (imageId: string) => {
    const next = favorites.includes(imageId)
      ? favorites.filter((id) => id !== imageId)
      : [...favorites, imageId];
    setFavorites(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const toggleSelected = (imageId: string) => {
    setSelectedIds((current) =>
      current.includes(imageId) ? current.filter((id) => id !== imageId) : [...current, imageId],
    );
  };

  const downloadImage = (image: MobileGalleryImage) => {
    const link = document.createElement("a");
    link.href = `/api/public-download?url=${encodeURIComponent(image.url)}&name=${encodeURIComponent(image.originalName || "photo")}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadZip = async (items: MobileGalleryImage[], suffix: string) => {
    if (!items.length || busy) return;
    setBusy(true);
    try {
      let zipItems = items;
      if (suffix === "all-photos" && imagesHasMore) {
        const loaded: MobileGalleryImage[] = [];
        let offset = images.length;
        let hasMore = imagesHasMore;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
        while (hasMore) {
          const response = await fetch(`${baseUrl}/public/mobile-gallery/apps/${encodeURIComponent(app.slug)}/images?limit=120&offset=${offset}`).catch(() => null);
          const payload = response?.ok ? await response.json().catch(() => null) : null;
          const page = payload?.data;
          if (!page?.items?.length) break;
          loaded.push(...page.items);
          offset += page.items.length;
          hasMore = Boolean(page.hasMore);
        }
        if (loaded.length) {
          const seen = new Set(zipItems.map((image) => image._id));
          zipItems = [...zipItems, ...loaded.filter((image) => !seen.has(image._id))];
          setImages((current) => {
            const currentIds = new Set(current.map((image) => image._id));
            return [...current, ...loaded.filter((image) => !currentIds.has(image._id))];
          });
          setImagesHasMore(false);
        }
      }
      const response = await fetch("/api/public-download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${app.slug}-${suffix}`,
          images: zipItems.map((image, index) => ({
            url: image.url,
            name: image.originalName || `photo-${index + 1}`,
          })),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Download failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${app.slug}-${suffix}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("ZIP download started");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: app.name, url }).catch(() => null);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => null);
    setNotice("Gallery link copied");
  };

  const openInstall = () => {
    setShowInstallHelp(false);
    setInstallOpen(true);
  };

  const install = async () => {
    if (!installPrompt) {
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setIsStandalone(true);
      setInstallOpen(false);
      setNotice("Gallery app installed");
      void cacheGalleryAssets();
    } else {
      setShowInstallHelp(true);
    }
    setInstallPrompt(null);
  };

  const loadMoreImages = async () => {
    if (imagesLoadingMore || !imagesHasMore) return;
    setImagesLoadingMore(true);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    const response = await fetch(`${baseUrl}/public/mobile-gallery/apps/${encodeURIComponent(app.slug)}/images?limit=48&offset=${images.length}`).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    const page = payload?.data;
    if (page?.items?.length) {
      setImages((current) => {
        const seen = new Set(current.map((image) => image._id));
        return [...current, ...page.items.filter((image: MobileGalleryImage) => !seen.has(image._id))];
      });
    }
    setImagesHasMore(Boolean(page?.hasMore));
    setImagesLoadingMore(false);
  };

  useEffect(() => {
    if (tab !== "home" || !imagesHasMore) return;
    const target = loaderRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreImages();
    }, { rootMargin: "800px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [images.length, imagesHasMore, imagesLoadingMore, tab]);

  const dismissInstall = () => {
    setShowInstallHelp(false);
    setInstallOpen(false);
  };

  const bg = design.backgroundColor || "#ffffff";
  const fg = design.textColor || "#222222";
  const columns = design.layout === "horizontal"
    ? { 350: 1, 700: 2, 1000: 3 }
    : { 350: 2, 700: 3, 1000: 4 };

  const photoButton = (image: MobileGalleryImage) => (
    <button
      key={image._id}
      type="button"
      className="group relative block w-full overflow-hidden bg-black/5"
      onClick={() => selecting ? toggleSelected(image._id) : setActiveImage(image)}
    >
      <img
        src={image.thumbnailUrl || image.url}
        alt={image.originalName || "Gallery photo"}
        className={`w-full object-cover transition duration-500 group-hover:scale-[1.02] ${design.layout === "horizontal" ? "aspect-[4/3]" : design.gridStyle === "grid" ? "aspect-[3/4]" : "h-auto"}`}
        loading="lazy"
      />
      {selecting ? (
        <span className={`absolute right-2 top-2 flex size-8 items-center justify-center rounded-full border-2 shadow-sm ${selectedIds.includes(image._id) ? "border-[#18bfa6] bg-[#18bfa6] text-white" : "border-white bg-black/25 text-transparent"}`}>
          <Check className="size-4" />
        </span>
      ) : (
        <span
          className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-black shadow-sm"
          onClick={(event) => {
            event.stopPropagation();
            toggleFavorite(image._id);
          }}
        >
          <Heart className={`size-4 ${favorites.includes(image._id) ? "fill-red-500 text-red-500" : ""}`} />
        </span>
      )}
    </button>
  );

  return (
    <main
      className={embedded ? "relative h-full overflow-y-auto pb-20" : "min-h-dvh pb-20"}
      style={{ backgroundColor: bg, color: fg, fontFamily: theme.fontFamily }}
    >
      <ScreenCaptureGuard enabled={!embedded} />
      <MobileGalleryCover app={app} design={design} images={images} />

      <section className="px-2 pb-8 sm:px-4">
        {(tab === "home" || tab === "favorites") && (
          <>
            <div className="mb-4 flex min-h-10 flex-wrap items-center justify-between gap-3 px-2 text-xs uppercase tracking-[0.12em] opacity-70">
              <span>{tab === "favorites" ? `${favoriteImages.length} favorites` : `${images.length} photos`}</span>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {selecting ? (
                  <>
                    <button type="button" onClick={() => setSelectedIds(selectedIds.length === visibleImages.length ? [] : visibleImages.map((image) => image._id))}>{selectedIds.length === visibleImages.length ? "Clear all" : "Select all"}</button>
                    <button type="button" disabled={!selectedImages.length || busy} onClick={() => downloadZip(selectedImages, "selected-photos")} className="flex items-center gap-1.5"><Download className="size-4" /> {busy ? "Preparing…" : `Selected (${selectedImages.length})`}</button>
                    <button type="button" onClick={() => { setSelecting(false); setSelectedIds([]); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={!visibleImages.length} onClick={() => setSelecting(true)}>Select</button>
                    <button type="button" onClick={() => downloadZip(visibleImages, tab === "favorites" ? "favorites" : "all-photos")} disabled={!visibleImages.length || busy} className="flex items-center gap-1.5"><Download className="size-4" /> {busy ? "Preparing…" : "Download ZIP"}</button>
                  </>
                )}
              </div>
            </div>

            {visibleImages.length ? (
              design.gridStyle === "grid" ? (
                <div className={`grid gap-1.5 ${design.layout === "horizontal" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                  {visibleImages.map(photoButton)}
                </div>
              ) : (
                <ResponsiveMasonry columnsCountBreakPoints={columns}>
                  <Masonry gutter="6px">{visibleImages.map(photoButton)}</Masonry>
                </ResponsiveMasonry>
              )
            ) : (
              <div className="flex min-h-72 items-center justify-center px-5 text-center text-sm opacity-60">
                {tab === "favorites" ? "Tap the heart on a photo to add it here." : "No photos have been added yet."}
              </div>
            )}

            {tab === "home" && imagesHasMore && (
              <div ref={loaderRef} className="flex h-24 items-center justify-center">
                {imagesLoadingMore && <span className="text-xs uppercase tracking-[0.14em] opacity-60">Loading</span>}
              </div>
            )}

            {app.settings?.callToAction?.enabled && app.settings.callToAction.url && (
              <div className="flex justify-center py-10">
                <a href={app.settings.callToAction.url} target="_blank" rel="noreferrer" className="border border-current px-8 py-3 text-sm uppercase tracking-[0.14em]">
                  {app.settings.callToAction.label || "Visit Website"}
                </a>
              </div>
            )}
          </>
        )}

        {tab === "share" && (
          <div className="mx-auto max-w-md px-6 py-16 text-center">
            <Share2 className="mx-auto size-9" />
            <h2 className="mt-5 text-2xl">Share this gallery</h2>
            <p className="mt-3 text-sm leading-6 opacity-65">Send the app link to friends and family or copy it to any messaging app.</p>
            <button type="button" onClick={share} className="mt-8 w-full bg-current px-5 py-4 text-sm font-semibold">
              <span style={{ color: bg }}>Share gallery link</span>
            </button>
            {!isStandalone && <button type="button" onClick={openInstall} className="mt-3 w-full border border-current px-5 py-4 text-sm font-semibold">Install on this device</button>}
          </div>
        )}

        {tab === "account" && (
          <div className="mx-auto max-w-md px-6 py-12">
            {profile.logoUrl && <img src={profile.logoUrl} alt="Business logo" className="mx-auto h-20 max-w-[220px] object-contain" />}
            <h2 className="mt-7 text-center text-2xl">About</h2>
            {profile.biography && <p className="mt-5 whitespace-pre-line text-sm leading-7 opacity-75">{profile.biography}</p>}
            <div className="mt-8 space-y-4 text-sm">
              {profile.contactEmail && <a href={`mailto:${profile.contactEmail}`} className="flex items-center gap-3"><Mail className="size-4" />{profile.contactEmail}</a>}
              {profile.phoneNumber && <a href={`tel:${profile.phoneNumber}`} className="flex items-center gap-3"><Phone className="size-4" />{profile.phoneNumber}</a>}
              {profile.businessAddress && <p className="flex items-start gap-3"><MapPin className="mt-0.5 size-4 shrink-0" />{profile.businessAddress}</p>}
              {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="flex items-center gap-3"><Globe2 className="size-4" />{profile.website}</a>}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {Object.entries(profile.socialLinks || {}).filter(([, value]) => Boolean(value)).map(([name, value]) => (
                <a key={name} href={value} target="_blank" rel="noreferrer" className="border border-current px-4 py-2 text-xs uppercase tracking-wider">{name}</a>
              ))}
            </div>
            {!isStandalone && <button type="button" onClick={openInstall} className="mt-8 w-full border border-current px-5 py-3 text-sm font-semibold">Install this gallery app</button>}
          </div>
        )}
      </section>

      <nav className={`${embedded ? "sticky" : "fixed"} inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t bg-white text-[#777]`}>
        {([
          ["home", Home, "Home"],
          ["favorites", Heart, "Favorites"],
          ["share", Share2, "Share"],
          ["account", UserRound, "Account"],
        ] as const).map(([value, Icon, label]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`flex flex-col items-center justify-center gap-1 text-[10px] ${tab === value ? "text-black" : ""}`}>
            <Icon className="size-5" />{label}
          </button>
        ))}
      </nav>

      {activeImage && (
        <div className={`${embedded ? "absolute" : "fixed"} inset-0 z-50 flex items-center justify-center bg-black/90 p-4`}>
          <button type="button" onClick={() => setActiveImage(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"><X className="size-6" /></button>
          <img src={activeImage.url} alt={activeImage.originalName || "Photo"} className="max-h-[82vh] max-w-full object-contain" />
          <div className="absolute bottom-6 flex gap-3">
            <button type="button" onClick={() => toggleFavorite(activeImage._id)} className="rounded-full bg-white p-3 text-black"><Heart className={`size-5 ${favorites.includes(activeImage._id) ? "fill-red-500 text-red-500" : ""}`} /></button>
            <button type="button" onClick={() => downloadImage(activeImage)} className="rounded-full bg-white p-3 text-black"><Download className="size-5" /></button>
          </div>
        </div>
      )}

      {installOpen && !embedded && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-[#222] shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {app.iconUrl ? <img src={app.iconUrl} alt="" className="size-16 shrink-0 rounded-2xl object-cover" /> : <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[#efefef]"><Smartphone className="size-7" /></div>}
                <div className="min-w-0"><p className="break-words font-semibold">{showInstallHelp ? "Add to Home Screen" : `Download ${app.name}`}</p><p className="mt-1 text-xs text-[#777]">{showInstallHelp ? "Follow the browser steps below." : "Install this gallery on your phone."}</p></div>
              </div>
              <button type="button" onClick={dismissInstall}><X className="size-5" /></button>
            </div>
            {showInstallHelp ? (
              <div className="mt-6">
                <ol className="space-y-3 text-sm leading-6 text-[#555]">
                  {isIOS ? <><li><b>1.</b> Open this link in Safari.</li><li><b>2.</b> Tap the Share button.</li><li><b>3.</b> Choose “Add to Home Screen”, then tap Add.</li></> : <><li><b>1.</b> Open your browser menu.</li><li><b>2.</b> Choose “Install app” or “Add to Home screen”.</li><li><b>3.</b> Confirm the installation.</li></>}
                </ol>
                <button type="button" onClick={dismissInstall} className="mt-6 w-full rounded-xl bg-[#18bfa6] px-5 py-3 font-semibold text-white">Got it</button>
              </div>
            ) : (
              <>
                <button type="button" onClick={install} className="mt-6 w-full rounded-xl bg-[#18bfa6] px-5 py-3 font-semibold text-white">{installPrompt ? "Install App" : isIOS ? "Show iPhone Install Steps" : "Show Install Instructions"}</button>
                {assetCaching && <p className="mt-3 text-center text-xs font-semibold text-[#18bfa6]">Saving photos for offline use...</p>}
                {!installPrompt && <p className="mt-3 text-center text-xs leading-5 text-[#777]">Automatic installation is not available in this browser, but the gallery can still be added to the home screen.</p>}
              </>
            )}
          </div>
        </div>
      )}

      {notice && <div className={`${embedded ? "absolute" : "fixed"} bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-black px-4 py-2 text-xs text-white shadow-xl`}>{notice}</div>}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Heart,
  ImageIcon,
  Loader2,
  Mail,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FavoritePageImage = {
  _id: string;
  url: string;
  thumbnailUrl?: string;
  originalName?: string;
};

type FavoritePageCollection = {
  _id: string;
  name: string;
  slug?: string;
  coverImage?: string;
  eventDate?: string;
  images?: FavoritePageImage[];
};

type StoredFavorites = {
  collectionFavorited: boolean;
  imageIds: string[];
};

export function PublicGalleryFavoritesPage({
  name,
  galary,
  collection,
}: {
  name: string;
  galary: string;
  collection: FavoritePageCollection;
}) {
  const galleryPath = `/${encodeURIComponent(galary)}`;
  const storageKey = `pixieset-public-favorites:${collection._id || collection.slug || galary}`;
  const images = useMemo(() => collection.images ?? [], [collection.images]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [collectionFavorited, setCollectionFavorited] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [zipBusy, setZipBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const favoriteImages = useMemo(
    () => images.filter((image) => favoriteIds.has(image._id)),
    [favoriteIds, images],
  );

  useEffect(() => {
    setEmail(window.localStorage.getItem("pixieset-favorite-email") || "");
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null") as StoredFavorites | null;
      const ids = new Set(Array.isArray(stored?.imageIds) ? stored.imageIds : []);
      setCollectionFavorited(Boolean(stored?.collectionFavorited));
      setFavoriteIds(ids);
      setSelectedIds(new Set(ids));
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const persist = (collectionValue: boolean, ids: Set<string>) => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      collectionFavorited: collectionValue,
      imageIds: Array.from(ids),
    } satisfies StoredFavorites));
  };

  const removePhoto = (imageId: string) => {
    const nextFavorites = new Set(favoriteIds);
    nextFavorites.delete(imageId);
    const nextSelected = new Set(selectedIds);
    nextSelected.delete(imageId);
    setFavoriteIds(nextFavorites);
    setSelectedIds(nextSelected);
    persist(collectionFavorited, nextFavorites);
    setNotice("Photo removed from My Favorites");
  };

  const removeCollection = () => {
    setCollectionFavorited(false);
    persist(false, favoriteIds);
    setNotice("Collection removed from My Favorites");
  };

  const toggleSelected = (imageId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(favoriteImages.map((image) => image._id)));
  const clearSelection = () => setSelectedIds(new Set());

  const recordDownload = async (downloadImages: FavoritePageImage[], type: "single" | "all") => {
    if (!email || !email.includes("@")) return;
    const apiBase = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    await fetch(`${apiBase}/public/collections/${encodeURIComponent(collection.slug || galary)}/download-activity?siteSlug=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        downloadType: type,
        items: downloadImages.map((image) => ({
          imageId: image._id,
          imageName: image.originalName || "favorite-photo",
          imageUrl: imageSrc(image.url),
        })),
      }),
    }).catch(() => null);
  };

  const downloadOne = async (image: FavoritePageImage, index: number) => {
    void recordDownload([image], "single");
    const link = document.createElement("a");
    link.href = `/api/public-download?url=${encodeURIComponent(imageSrc(image.url))}&name=${encodeURIComponent(image.originalName || `favorite-${index + 1}`)}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setNotice("Download started");
  };

  const downloadSelected = async () => {
    const selected = favoriteImages.filter((image) => selectedIds.has(image._id));
    if (!selected.length || zipBusy) return;
    setZipBusy(true);
    void recordDownload(selected, "all");
    try {
      const response = await fetch("/api/public-download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${collection.name}-favorites`,
          images: selected.map((image, index) => ({
            url: imageSrc(image.url),
            name: image.originalName || `favorite-${index + 1}`,
          })),
        }),
      });
      if (!response.ok) throw new Error("Could not create favorites ZIP");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName(collection.name)}-favorites.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("Favorites ZIP download started");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Download failed");
    } finally {
      setZipBusy(false);
    }
  };

  if (!loaded) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f5f2]"><Loader2 className="size-7 animate-spin" /></main>;
  }

  return (
    <main className="min-h-screen bg-[#f5f5f2] text-[#202326]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <Link href={galleryPath} className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft className="size-4" />Back to gallery</Link>
          <div className="flex items-center gap-2 text-xs text-[#777]">{email && <><Mail className="size-3.5" />{email}</>}</div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#16a894]">My Favorites</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{collection.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#687078]">Review the photos saved on this device, open any photo back inside the original gallery, or download individual images and a selected ZIP.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={galleryPath} className="inline-flex h-11 items-center gap-2 border bg-white px-5 text-sm font-bold"><ExternalLink className="size-4" />Go to collection</Link>
            <button onClick={downloadSelected} disabled={!selectedIds.size || zipBusy} className="inline-flex h-11 items-center gap-2 bg-[#202326] px-5 text-sm font-bold text-white disabled:opacity-40">{zipBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Download selected ({selectedIds.size})</button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Favorite photos" value={String(favoriteImages.length)} />
          <Stat label="Selected" value={String(selectedIds.size)} />
          <Stat label="Collection saved" value={collectionFavorited ? "Yes" : "No"} />
        </div>

        {collectionFavorited && (
          <div className="mt-8 flex flex-col gap-5 border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-500"><Heart className="size-5 fill-current" /></span>
              <div><p className="font-semibold">Entire collection is saved</p><p className="mt-1 text-sm text-[#777]">Open the full gallery whenever you need to continue viewing or selecting photos.</p></div>
            </div>
            <div className="flex gap-2"><Link href={galleryPath} className="inline-flex h-10 items-center gap-2 border px-4 text-sm font-bold"><ExternalLink className="size-4" />Open collection</Link><button onClick={removeCollection} className="inline-flex size-10 items-center justify-center border text-red-600" aria-label="Remove collection favorite"><Trash2 className="size-4" /></button></div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div><h2 className="text-xl font-semibold">Favorite photos</h2><p className="mt-1 text-sm text-[#777]">Select photos for a ZIP or manage them one at a time.</p></div>
          <div className="flex gap-2"><button onClick={selectAll} className="h-9 border bg-white px-4 text-xs font-bold">Select all</button><button onClick={clearSelection} className="h-9 border bg-white px-4 text-xs font-bold">Clear</button></div>
        </div>

        {favoriteImages.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favoriteImages.map((image, index) => {
              const selected = selectedIds.has(image._id);
              const photoPath = `${galleryPath}#photo-${encodeURIComponent(image._id)}`;
              return (
                <article key={image._id} className={cn("group overflow-hidden border bg-white transition", selected && "border-[#16a894] ring-2 ring-[#16a894]/20")}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e9e6]">
                    <img src={imageSrc(image.thumbnailUrl || image.url)} alt={image.originalName || `Favorite photo ${index + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                    <button onClick={() => toggleSelected(image._id)} className={cn("absolute left-3 top-3 flex size-9 items-center justify-center rounded-full border shadow", selected ? "border-[#16a894] bg-[#16a894] text-white" : "border-white/70 bg-white/95")} aria-label={selected ? "Deselect photo" : "Select photo"}>{selected ? <Check className="size-4" /> : <span className="size-3 rounded-full border" />}</button>
                  </div>
                  <div className="p-4">
                    <p className="truncate text-sm font-semibold">{image.originalName || `Favorite photo ${index + 1}`}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link href={photoPath} className="inline-flex h-10 items-center justify-center gap-2 border text-xs font-bold"><ImageIcon className="size-4" />Open in gallery</Link>
                      <button onClick={() => void downloadOne(image, index)} className="inline-flex h-10 items-center justify-center gap-2 bg-[#202326] text-xs font-bold text-white"><Download className="size-4" />Download</button>
                    </div>
                    <button onClick={() => removePhoto(image._id)} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 className="size-4" />Remove from favorites</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 border border-dashed bg-white px-6 py-20 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f2f2f0]"><Heart className="size-6 text-[#999]" /></span>
            <h3 className="mt-5 text-xl font-semibold">No favorite photos yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#777]">Return to the collection and use the heart button on any image. Your selections will appear here automatically.</p>
            <Link href={galleryPath} className="mt-6 inline-flex h-11 items-center gap-2 bg-[#202326] px-5 text-sm font-bold text-white"><ExternalLink className="size-4" />Browse collection</Link>
          </div>
        )}
      </section>

      {notice && <div className="fixed bottom-5 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-black px-5 py-3 text-center text-sm font-semibold text-white shadow-xl">{notice}</div>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#888]">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p></div>;
}

function imageSrc(url?: string) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    return `${baseUrl}${url}`;
  }
  return url;
}

function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "favorites";
}

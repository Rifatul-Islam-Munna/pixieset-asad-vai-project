"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Heart, Mail, Trash2, X } from "lucide-react";

export type FavoriteGalleryImage = {
  _id: string;
  url: string;
  thumbnailUrl?: string;
  originalName?: string;
};

type PendingFavorite =
  | { type: "collection" }
  | { type: "image"; imageId: string }
  | null;

type StoredFavorites = {
  collectionFavorited: boolean;
  imageIds: string[];
};

export function usePublicGalleryFavorites({
  collectionId,
  identifier,
  collectionTitle,
  images,
  enabled,
  maxFavorites,
}: {
  collectionId?: string;
  identifier: string;
  collectionTitle: string;
  images: FavoriteGalleryImage[];
  enabled: boolean;
  maxFavorites: number;
}) {
  const storageKey = `pixieset-public-favorites:${collectionId || identifier}`;
  const emailStorageKey = "pixieset-favorite-email";
  const [favoriteEmail, setFavoriteEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<PendingFavorite>(null);
  const [collectionFavorited, setCollectionFavorited] = useState(false);
  const [favoriteImageIds, setFavoriteImageIds] = useState<Set<string>>(() => new Set());
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteImageBusy, setFavoriteImageBusy] = useState("");
  const [notice, setNotice] = useState("");

  const favoriteImages = useMemo(
    () => images.filter((image) => favoriteImageIds.has(image._id)),
    [favoriteImageIds, images],
  );

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(emailStorageKey) || "";
    setFavoriteEmail(savedEmail);
    setEmailDraft(savedEmail);
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null") as StoredFavorites | null;
      setCollectionFavorited(Boolean(stored?.collectionFavorited));
      setFavoriteImageIds(new Set(Array.isArray(stored?.imageIds) ? stored.imageIds : []));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function persist(collectionValue: boolean, ids: Set<string>) {
    const payload: StoredFavorites = {
      collectionFavorited: collectionValue,
      imageIds: Array.from(ids),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  function requireEmail(action: PendingFavorite) {
    if (favoriteEmail) return true;
    setPendingFavorite(action);
    setEmailDraft("");
    setEmailDialogOpen(true);
    return false;
  }

  function applyCollectionToggle() {
    setFavoriteBusy(true);
    setCollectionFavorited((current) => {
      const next = !current;
      persist(next, favoriteImageIds);
      setNotice(next ? "Collection added to My Favorites" : "Collection removed from My Favorites");
      return next;
    });
    window.setTimeout(() => setFavoriteBusy(false), 220);
  }

  function applyImageToggle(imageId: string) {
    if (!enabled) {
      setNotice("Favorites are disabled for this gallery");
      return;
    }
    const adding = !favoriteImageIds.has(imageId);
    if (adding && maxFavorites > 0 && favoriteImageIds.size >= maxFavorites) {
      setNotice(`Favorite limit reached (${maxFavorites})`);
      return;
    }
    setFavoriteImageBusy(imageId);
    setFavoriteImageIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      persist(collectionFavorited, next);
      setNotice(next.has(imageId) ? "Photo added to My Favorites" : "Photo removed from My Favorites");
      return next;
    });
    window.setTimeout(() => setFavoriteImageBusy(""), 220);
  }

  function toggleCollectionFavorite() {
    if (!requireEmail({ type: "collection" })) return;
    applyCollectionToggle();
  }

  function toggleImageFavorite(image: FavoriteGalleryImage) {
    if (!requireEmail({ type: "image", imageId: image._id })) return;
    applyImageToggle(image._id);
  }

  function saveEmail() {
    const email = emailDraft.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setNotice("Enter a valid email address");
      return;
    }
    window.localStorage.setItem(emailStorageKey, email);
    setFavoriteEmail(email);
    setEmailDialogOpen(false);
    const action = pendingFavorite;
    setPendingFavorite(null);
    if (action?.type === "collection") applyCollectionToggle();
    if (action?.type === "image") applyImageToggle(action.imageId);
  }

  const overlays: ReactNode = (
    <>
      {emailDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md bg-white p-6 text-[#202326] shadow-[0_28px_90px_rgba(0,0,0,0.3)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="flex size-11 items-center justify-center rounded-full bg-[#eef8f6] text-[#009b8c]"><Mail className="size-5" /></span>
                <h2 className="mt-5 text-2xl font-semibold">Save your favorites</h2>
                <p className="mt-2 text-sm leading-6 text-[#666]">Enter your email once. It stays on this device, so you can favorite photos without creating an account.</p>
              </div>
              <button type="button" onClick={() => { setEmailDialogOpen(false); setPendingFavorite(null); }} aria-label="Close email dialog"><X className="size-5" /></button>
            </div>
            <input
              type="email"
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") saveEmail(); }}
              placeholder="you@example.com"
              className="mt-6 h-12 w-full border px-4 text-sm outline-none focus:border-[#16bda8]"
              autoFocus
            />
            <button type="button" onClick={saveEmail} className="mt-4 h-12 w-full bg-[#202326] text-sm font-bold text-white">Continue</button>
          </div>
        </div>
      )}

      {favoritesOpen && (
        <div className="fixed inset-0 z-[75] flex justify-end bg-black/45" onMouseDown={(event) => { if (event.currentTarget === event.target) setFavoritesOpen(false); }}>
          <aside className="h-full w-full max-w-[520px] overflow-y-auto bg-white p-5 text-[#202326] shadow-[-25px_0_70px_rgba(0,0,0,0.22)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#16a894]">My Favorites</p>
                <h2 className="mt-2 text-2xl font-semibold">{collectionTitle}</h2>
                <p className="mt-2 text-xs text-[#777]">{favoriteEmail || "Favorites saved on this device"}</p>
              </div>
              <button type="button" onClick={() => setFavoritesOpen(false)} aria-label="Close My Favorites"><X className="size-5" /></button>
            </div>

            {collectionFavorited && (
              <div className="mt-6 flex items-center justify-between gap-4 border bg-[#f5fbf9] p-4">
                <div className="flex items-center gap-3"><Heart className="size-5 fill-red-500 text-red-500" /><div><p className="font-semibold">Entire collection</p><p className="mt-1 text-xs text-[#777]">This collection is in My Favorites.</p></div></div>
                <button type="button" onClick={applyCollectionToggle} className="flex size-9 items-center justify-center text-red-600" aria-label="Remove collection favorite"><Trash2 className="size-4" /></button>
              </div>
            )}

            <div className="mt-7 flex items-center justify-between gap-4"><h3 className="font-semibold">Favorite photos</h3><span className="rounded-full bg-[#f1f1ef] px-3 py-1 text-xs font-bold">{favoriteImages.length}</span></div>
            {favoriteImages.length ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {favoriteImages.map((image) => (
                  <article key={image._id} className="group relative overflow-hidden bg-[#f1f1ef]">
                    <img src={favoriteImageSrc(image.thumbnailUrl || image.url)} alt={image.originalName || "Favorite photo"} className="aspect-square h-full w-full object-cover" />
                    <button type="button" onClick={() => applyImageToggle(image._id)} className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-white/95 text-red-600 shadow" aria-label="Remove favorite photo"><Trash2 className="size-4" /></button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-4 border border-dashed p-10 text-center"><Heart className="mx-auto size-7 text-[#aaa]" /><p className="mt-3 text-sm text-[#777]">Favorite photos will appear here.</p></div>
            )}
          </aside>
        </div>
      )}

      {notice && <div className="fixed bottom-5 left-1/2 z-[90] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-black px-5 py-3 text-center text-sm font-semibold text-white shadow-xl">{notice}</div>}
    </>
  );

  return {
    collectionFavorited,
    favoriteImageIds,
    favoriteBusy,
    favoriteImageBusy,
    favoriteEmail,
    favoriteImages,
    toggleCollectionFavorite,
    toggleImageFavorite,
    openFavorites: () => setFavoritesOpen(true),
    overlays,
  };
}

function favoriteImageSrc(url?: string) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    return `${baseUrl}${url}`;
  }
  return url;
}

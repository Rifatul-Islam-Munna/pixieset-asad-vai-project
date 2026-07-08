"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Mail, X } from "lucide-react";

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
  images,
  enabled,
  maxFavorites,
  favoritesPath,
}: {
  collectionId?: string;
  identifier: string;
  collectionTitle: string;
  images: FavoriteGalleryImage[];
  enabled: boolean;
  maxFavorites: number;
  favoritesPath?: string;
}) {
  const router = useRouter();
  const storageKey = `pixieset-public-favorites:${collectionId || identifier}`;
  const emailStorageKey = "pixieset-favorite-email";
  const [favoriteEmail, setFavoriteEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
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

  const openFavorites = () => {
    const target = favoritesPath || `${window.location.pathname.replace(/\/$/, "")}/favorites`;
    router.push(target);
  };

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
    openFavorites,
    overlays,
  };
}

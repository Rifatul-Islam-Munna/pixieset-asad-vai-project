"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

type GalleryImage = {
  _id?: string;
  url?: string;
  thumbnailUrl?: string;
};

type GalleryStoreSettings = {
  enabled?: boolean;
  storeStatus?: boolean;
  showPrintStoreNav?: boolean;
  showBuyPhotoButton?: boolean;
};

export function PublicGalleryStoreBridge({
  name,
  galary,
  collection,
}: {
  name: string;
  galary: string;
  collection?: {
    _id?: string;
    images?: GalleryImage[];
    settings?: { store?: GalleryStoreSettings };
  } | null;
}) {
  const store = collection?.settings?.store ?? {};
  const enabled = Boolean(store.enabled ?? store.storeStatus);
  const [imageId, setImageId] = useState("");
  const storeHref = `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}/store`;
  const images = useMemo(() => collection?.images ?? [], [collection?.images]);

  useEffect(() => {
    if (!enabled || store.showBuyPhotoButton === false) return;
    const listener = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      const source = target.currentSrc || target.src;
      const match = images.find(image => {
        const candidates = [image.url, image.thumbnailUrl].filter(Boolean) as string[];
        return candidates.some(candidate => source === candidate || source.endsWith(candidate));
      });
      if (match?._id) setImageId(match._id);
    };
    document.addEventListener("click", listener, true);
    return () => document.removeEventListener("click", listener, true);
  }, [enabled, images, store.showBuyPhotoButton]);

  if (!enabled) return null;

  return <div className="pointer-events-none fixed bottom-5 right-5 z-[75] flex flex-col items-end gap-3">
    {imageId && store.showBuyPhotoButton !== false && (
      <Link
        className="pointer-events-auto inline-flex h-11 items-center gap-2 bg-[#303030] px-5 text-sm font-semibold text-white shadow-lg"
        href={`${storeHref}?imageId=${encodeURIComponent(imageId)}&product=print`}
      >
        <ShoppingBag className="size-4" /> Buy Photo
      </Link>
    )}
    {store.showPrintStoreNav !== false && (
      <Link className="pointer-events-auto inline-flex h-11 items-center gap-2 border bg-white px-5 text-sm font-medium shadow-lg" href={storeHref}>
        <ShoppingBag className="size-4" /> Print Store
      </Link>
    )}
  </div>;
}

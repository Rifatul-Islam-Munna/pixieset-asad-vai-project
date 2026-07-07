"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { STORE_CATEGORY_ORDER, type PublicStoreData } from "@/lib/public-store";

type GalleryImage = {
  _id?: string;
  url?: string;
  thumbnailUrl?: string;
};

type GalleryStoreSettings = {
  enabled?: boolean;
  storeStatus?: boolean;
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
  const storeSettings = collection?.settings?.store ?? {};
  const enabled = Boolean(storeSettings.enabled ?? storeSettings.storeStatus);
  const [storeData, setStoreData] = useState<PublicStoreData | null>(null);
  const [imageId, setImageId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const storeHref = `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}/store`;
  const images = useMemo(() => collection?.images ?? [], [collection?.images]);
  const products = useMemo(
    () => (storeData?.products ?? []).filter((product) => product.active !== false),
    [storeData?.products],
  );

  useEffect(() => {
    if (!enabled) return;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    fetch(`${baseUrl}/public/collections/${encodeURIComponent(galary)}/store`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setStoreData(payload?.data ?? null))
      .catch(() => setStoreData(null));
  }, [enabled, galary]);

  useEffect(() => {
    if (!enabled) return;
    const hiddenLinks = new Set<HTMLElement>();
    const hideLegacyStoreLinks = () => {
      document.querySelectorAll<HTMLAnchorElement>(`a[href="${storeHref}"]`).forEach((link) => {
        if (link.dataset.referenceStoreLink === "true") return;
        link.style.display = "none";
        hiddenLinks.add(link);
      });
    };
    hideLegacyStoreLinks();
    const observer = new MutationObserver(hideLegacyStoreLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      hiddenLinks.forEach((link) => link.style.removeProperty("display"));
    };
  }, [enabled, storeHref]);

  useEffect(() => {
    if (!enabled) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const closeButton = target.closest('button[aria-label="Close image"]');
      if (closeButton) {
        setImageId("");
        return;
      }
      const image = target instanceof HTMLImageElement ? target : target.closest("img");
      if (!(image instanceof HTMLImageElement)) return;
      const source = image.currentSrc || image.src;
      const match = images.find((item) => {
        const candidates = [item.url, item.thumbnailUrl].filter(Boolean) as string[];
        return candidates.some((candidate) => source === candidate || source.endsWith(candidate));
      });
      if (match?._id) setImageId(match._id);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageId("");
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [enabled, images]);

  if (!enabled) return null;

  return (
    <>
      <div
        className="fixed right-[190px] top-0 z-[65] hidden h-16 items-center border-r border-black/10 bg-white px-5 lg:flex"
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
      >
        <Link
          href={storeHref}
          data-reference-store-link="true"
          className="text-sm font-medium text-[#222]"
        >
          Print Store
        </Link>
        {menuOpen && (
          <div className="fixed left-0 right-0 top-16 z-[64] border-b border-black/10 bg-[#f5f5f5] px-8 py-9 shadow-[0_12px_28px_rgba(0,0,0,0.06)]">
            <div className="mx-auto grid max-w-[760px] gap-16 md:grid-cols-2">
              {STORE_CATEGORY_ORDER.slice(0, 2).map((category) => {
                const categoryProducts = products.filter((product) => product.category === category);
                if (!categoryProducts.length) return null;
                return (
                  <div key={category}>
                    <p className="mb-4 text-sm font-medium text-black">{category}</p>
                    <div className="grid gap-4">
                      {categoryProducts.map((product) => (
                        <Link
                          key={product._id}
                          href={`${storeHref}?product=${encodeURIComponent(product.slug)}`}
                          className="text-sm text-[#777] transition hover:text-black"
                        >
                          {product.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {imageId && (
        <Link
          href={`${storeHref}?imageId=${encodeURIComponent(imageId)}&product=print`}
          className="fixed right-20 top-5 z-[70] inline-flex h-11 items-center gap-2 bg-[#303030] px-5 text-sm font-semibold text-white shadow-lg"
        >
          <ShoppingBag className="size-4" />
          Buy Photo
        </Link>
      )}
    </>
  );
}

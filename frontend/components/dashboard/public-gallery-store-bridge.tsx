"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronRight, ShoppingBag, X } from "lucide-react";
import {
  displayPrice,
  formatMoney,
  publicImageSrc,
  visibleVariants,
  type PublicStoreData,
  type PublicStoreImage,
  type PublicStoreProduct,
} from "@/lib/public-store";

type GalleryImage = PublicStoreImage;

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
  const [navHost, setNavHost] = useState<HTMLElement | null>(null);
  const [activeImageId, setActiveImageId] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const storeHref = `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}/store`;
  const images = useMemo(() => collection?.images ?? [], [collection?.images]);
  const selectedImage = images.find((image) => image._id === activeImageId);

  useEffect(() => {
    if (!enabled) return;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    fetch(`${baseUrl}/public/collections/${encodeURIComponent(galary)}/store`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setStoreData(payload?.data ?? null))
      .catch(() => setStoreData(null));
  }, [enabled, galary]);

  useEffect(() => {
    if (!enabled) return;

    let host: HTMLElement | null = null;
    const hiddenLinks = new Map<HTMLElement, string>();

    const attach = () => {
      const actions = document.querySelector<HTMLElement>("main nav .flex.items-center.gap-4");
      if (actions && !host) {
        host = document.createElement("div");
        host.dataset.printStoreHost = "true";
        actions.insertBefore(host, actions.firstChild);
        setNavHost(host);
      }

      document.querySelectorAll<HTMLAnchorElement>(`a[href="${storeHref}"]`).forEach((link) => {
        if (host?.contains(link) || link.dataset.printStoreReference === "true") return;
        if (!hiddenLinks.has(link)) hiddenLinks.set(link, link.style.display);
        link.style.display = "none";
      });
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      setNavHost(null);
      host?.remove();
      hiddenLinks.forEach((display, link) => {
        link.style.display = display;
      });
    };
  }, [enabled, storeHref]);

  useEffect(() => {
    if (!enabled) return;

    const matchImage = (source: string) =>
      images.find((image) => {
        const candidates = [image.url, image.thumbnailUrl].filter(Boolean) as string[];
        return candidates.some(
          (candidate) => source === publicImageSrc(candidate) || source.endsWith(candidate),
        );
      });

    const syncLightbox = () => {
      const closeButton = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Close image"]',
      );
      const lightbox = closeButton?.closest<HTMLElement>("div.fixed.inset-0");
      const preview = lightbox?.querySelector<HTMLImageElement>("img");
      const image = preview ? matchImage(preview.currentSrc || preview.src) : undefined;
      setActiveImageId(image?._id ?? "");
      if (!lightbox) setBuyOpen(false);
    };

    syncLightbox();
    const observer = new MutationObserver(syncLightbox);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
    return () => observer.disconnect();
  }, [enabled, images]);

  if (!enabled) return null;

  return (
    <>
      {navHost &&
        createPortal(
          <div
            className="relative"
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <Link
              href={storeHref}
              data-print-store-reference="true"
              className="inline-flex h-16 items-center gap-2 border-r border-black/10 pr-5 text-sm font-medium"
            >
              Print Store
            </Link>
            {menuOpen && (
              <GalleryStoreMegaMenu
                products={storeData?.products ?? []}
                storeHref={storeHref}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>,
          navHost,
        )}

      {activeImageId && !buyOpen && (
        <button
          type="button"
          className="fixed right-20 top-5 z-[70] inline-flex h-11 items-center gap-2 bg-[#303030] px-5 text-sm font-semibold text-white shadow-lg"
          onClick={() => setBuyOpen(true)}
        >
          <ShoppingBag className="size-4" />
          Buy This Photo
        </button>
      )}

      {buyOpen && selectedImage && (
        <BuyPhotoDialog
          image={selectedImage}
          products={storeData?.products ?? []}
          currency={storeData?.store?.currency ?? "EUR"}
          storeHref={storeHref}
          onClose={() => setBuyOpen(false)}
        />
      )}
    </>
  );
}

function GalleryStoreMegaMenu({
  products,
  storeHref,
  onClose,
}: {
  products: PublicStoreProduct[];
  storeHref: string;
  onClose: () => void;
}) {
  const categories = ["Prints", "Wall Art"];
  return (
    <div className="fixed left-0 right-0 top-16 z-[80] border-b border-black/10 bg-[#f5f5f5] px-8 py-9 text-[#222] shadow-[0_12px_28px_rgba(0,0,0,0.06)]">
      <div className="mx-auto grid max-w-[760px] gap-16 md:grid-cols-2">
        {categories.map((category) => (
          <div key={category}>
            <p className="mb-4 text-sm font-medium text-black">{category}</p>
            <div className="grid gap-4">
              {products
                .filter((product) => product.active !== false && product.category === category)
                .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
                .map((product) => (
                  <Link
                    key={product._id}
                    href={`${storeHref}/${encodeURIComponent(product.slug)}`}
                    className="text-sm text-[#777] transition hover:text-black"
                    onClick={onClose}
                  >
                    {product.name}
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuyPhotoDialog({
  image,
  products,
  currency,
  storeHref,
  onClose,
}: {
  image: GalleryImage;
  products: PublicStoreProduct[];
  currency: string;
  storeHref: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"Prints" | "Wall Art">("Prints");
  const activeProducts = products
    .filter((product) => product.active !== false && product.category === tab)
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  const mainPrint = products.find(
    (product) => product.active !== false && product.slug === "print",
  ) ?? activeProducts[0];
  const imageQuery = `?imageId=${encodeURIComponent(image._id)}`;

  return (
    <div className="fixed inset-0 z-[120] bg-black/55 p-0 md:p-4" role="dialog" aria-modal="true">
      <div className="mx-auto grid h-full max-h-[930px] w-full max-w-[1200px] overflow-hidden bg-white shadow-2xl lg:grid-cols-[400px_1fr]">
        <div className="relative hidden items-center justify-center overflow-hidden bg-[#a95a54] p-10 lg:flex">
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20" />
          <img
            src={publicImageSrc(image.url)}
            alt={image.originalName || "Selected photo"}
            className="relative z-10 max-h-[72%] w-full object-contain shadow-xl"
          />
        </div>

        <div className="min-h-0 overflow-y-auto bg-white">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5 md:px-10">
            <h2 className="text-lg font-medium">Buy This Photo</h2>
            <div className="flex items-center gap-5">
              <Link href={storeHref} className="text-sm text-[#777] hover:text-black">
                Visit Store <ChevronRight className="ml-1 inline size-4" />
              </Link>
              <button className="flex size-9 items-center justify-center" onClick={onClose} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
          </header>

          <div className="px-6 pb-10 pt-5 md:px-10">
            <div className="flex gap-7 border-b">
              {(["Prints", "Wall Art"] as const).map((category) => (
                <button
                  key={category}
                  className={`border-b-2 pb-3 text-sm ${
                    tab === category
                      ? "border-black font-semibold text-black"
                      : "border-transparent text-[#888]"
                  }`}
                  onClick={() => setTab(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {tab === "Prints" && mainPrint ? (
              <>
                <div className="divide-y border-b">
                  {visibleVariants(mainPrint).map((variant) => (
                    <Link
                      key={variant.id}
                      href={`${storeHref}/${encodeURIComponent(mainPrint.slug)}${imageQuery}`}
                      className="flex min-h-11 items-center justify-between gap-5 py-3 text-sm"
                    >
                      <span>{variant.label}</span>
                      <span className="flex items-center gap-5 text-[#777]">
                        {formatMoney(variant.price, currency)}
                        <ChevronRight className="size-4" />
                      </span>
                    </Link>
                  ))}
                </div>
                <h3 className="mt-9 text-base font-medium">Shop All Prints</h3>
                <ProductChoiceGrid
                  products={activeProducts}
                  currency={currency}
                  imageQuery={imageQuery}
                  storeHref={storeHref}
                />
              </>
            ) : (
              <ProductChoiceGrid
                products={activeProducts}
                currency={currency}
                imageQuery={imageQuery}
                storeHref={storeHref}
              />
            )}

            {!activeProducts.length && (
              <p className="py-16 text-center text-sm text-[#777]">
                No products are available in this category.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductChoiceGrid({
  products,
  currency,
  imageQuery,
  storeHref,
}: {
  products: PublicStoreProduct[];
  currency: string;
  imageQuery: string;
  storeHref: string;
}) {
  return (
    <div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const preview = product.previewImages?.[0] || product.images?.[0];
        return (
          <Link
            key={product._id}
            href={`${storeHref}/${encodeURIComponent(product.slug)}${imageQuery}`}
            className="group"
          >
            <div className="aspect-square overflow-hidden bg-[#f2f2f0]">
              {preview && (
                <img
                  src={publicImageSrc(preview)}
                  alt={product.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                />
              )}
            </div>
            <p className="mt-3 text-sm font-medium">{product.name}</p>
            <p className="mt-1 text-sm text-[#888]">
              From {formatMoney(displayPrice(product), currency)}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

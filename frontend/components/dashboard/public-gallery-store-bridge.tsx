"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import {
  displayPrice,
  formatMoney,
  storeCartKey,
  publicImageSrc,
  visibleVariants,
  type PublicStoreCartItem,
  type PublicStoreData,
  type PublicStoreImage,
  type PublicStoreProduct,
} from "@/lib/public-store";
import { PublicStoreCatalog } from "./public-store-catalog";
import { PublicStoreProductBuilder } from "./public-store-product-builder";
import { StoreCartPanel } from "./store-cart-panel";

type GalleryImage = PublicStoreImage;

type GalleryStoreSettings = {
  enabled?: boolean;
  storeStatus?: boolean;
  showPrintStoreNav?: boolean;
  showBuyPhotoButton?: boolean;
};

function productCategory(product: PublicStoreProduct) {
  return product.type === "digital-download" ? "Digital Downloads" : product.category || "Other";
}

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
  const showPrintStoreNav = storeSettings.showPrintStoreNav !== false;
  const showBuyPhotoButton = storeSettings.showBuyPhotoButton !== false;
  const [storeData, setStoreData] = useState<PublicStoreData | null>(null);
  const [navHost, setNavHost] = useState<HTMLElement | null>(null);
  const [cartHost, setCartHost] = useState<HTMLElement | null>(null);
  const [activeImageId, setActiveImageId] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<PublicStoreProduct | null>(null);
  const [cart, setCart] = useState<PublicStoreCartItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [extraImages, setExtraImages] = useState<GalleryImage[]>([]);
  const images = useMemo(() => {
    const base = collection?.images ?? [];
    const ids = new Set(base.map((image) => image._id));
    return [...base, ...extraImages.filter((image) => !ids.has(image._id))];
  }, [collection?.images, extraImages]);
  const selectedImage = images.find((image) => image._id === activeImageId);
  const cartKey = storeCartKey(collection?._id ?? galary);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const checkoutHref = `/${encodeURIComponent(galary)}/checkout`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(cartKey);
      if (stored) setCart(JSON.parse(stored) as PublicStoreCartItem[]);
    } catch {
      setCart([]);
    }
  }, [cartKey]);

  useEffect(() => {
    window.localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  const addItems = (incoming: PublicStoreCartItem[]) => {
    setCart((current) => {
      const next = [...current];
      incoming.forEach((item) => {
        const existing = next.find((entry) => entry.id === item.id);
        if (existing) existing.quantity += item.quantity;
        else next.push(item);
      });
      return next;
    });
    setCartOpen(true);
    toast.success(incoming.length > 1 ? `${incoming.length} products added to cart` : "Product added to cart");
  };

  useEffect(() => {
    if (!enabled) return;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    fetch(`${baseUrl}/public/collections/${encodeURIComponent(galary)}/store?siteSlug=${encodeURIComponent(name)}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setStoreData(payload?.data ?? null))
      .catch(() => setStoreData(null));
  }, [enabled, galary, name]);

  useEffect(() => {
    if (!enabled) return;

    let host: HTMLElement | null = null;
    let cartButtonHost: HTMLElement | null = null;
    const attach = () => {
      const navSlot = document.querySelector<HTMLElement>('[data-print-store-nav-host="true"]');
      if (navSlot && !host) {
        host = document.createElement("div");
        host.dataset.printStoreHost = "true";
        navSlot.replaceWith(host);
        setNavHost(host);
      }
      const cartSlot = document.querySelector<HTMLElement>('[data-public-store-cart-host="true"]');
      if (cartSlot && !cartButtonHost) {
        cartButtonHost = document.createElement("div");
        cartButtonHost.dataset.publicStoreCartHost = "true";
        cartSlot.replaceWith(cartButtonHost);
        setCartHost(cartButtonHost);
      }
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      setNavHost(null);
      setCartHost(null);
      host?.remove();
      cartButtonHost?.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const openStore = (event: MouseEvent) => {
      const trigger = (event.target as HTMLElement | null)?.closest("[data-public-store-open]");
      if (!trigger) return;
      event.preventDefault();
      setStoreOpen(true);
    };
    const openBuyPhoto = (event: MouseEvent) => {
      const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-buy-photo-open]");
      const imageId = trigger?.dataset.buyPhotoOpen;
      if (!imageId) return;
      event.preventDefault();
      if (!images.some((image) => image._id === imageId) && trigger.dataset.buyPhotoUrl) {
        setExtraImages((current) => [
          ...current,
          {
            _id: imageId,
            url: trigger.dataset.buyPhotoUrl || "",
            thumbnailUrl: trigger.dataset.buyPhotoThumbnail || undefined,
            originalName: trigger.dataset.buyPhotoName || undefined,
          },
        ]);
      }
      setActiveImageId(imageId);
      setBuyOpen(true);
    };
    document.addEventListener("click", openStore);
    document.addEventListener("click", openBuyPhoto);
    return () => {
      document.removeEventListener("click", openStore);
      document.removeEventListener("click", openBuyPhoto);
    };
  }, [enabled, images]);

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
        'button[aria-label="Back to gallery"], button[aria-label="Close image"], button[aria-label="Close slideshow"]',
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
      {navHost && showPrintStoreNav &&
        createPortal(
          <div
            className="relative hidden md:block"
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              data-print-store-reference="true"
              className="inline-flex h-16 items-center gap-2 text-sm font-medium text-black/70 transition-colors hover:text-black"
              onClick={() => setStoreOpen(true)}
            >
              Print Store
            </button>
            {menuOpen && (
              <GalleryStoreMegaMenu
                products={storeData?.products ?? []}
                onOpen={(product) => {
                  setActiveProduct(product);
                  setStoreOpen(false);
                  setMenuOpen(false);
                }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>,
          navHost,
        )}

      {cartHost &&
        createPortal(
          <button
            type="button"
            className="relative inline-flex size-10 items-center justify-center rounded-full bg-[#202326] text-white shadow-sm transition hover:opacity-90"
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingBag className="size-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-[#202326] shadow">
                {cartCount}
              </span>
            )}
          </button>,
          cartHost,
        )}

      {buyOpen && selectedImage && (
        <BuyPhotoDialog
          image={selectedImage}
          products={storeData?.products ?? []}
          currency={storeData?.store?.currency ?? "EUR"}
          onOpenStore={() => {
            setBuyOpen(false);
            setStoreOpen(true);
          }}
          onPickProduct={(product) => {
            setBuyOpen(false);
            setActiveProduct(product);
          }}
          onClose={() => setBuyOpen(false)}
        />
      )}

      {storeOpen && (
        <StoreOverlay
          data={storeData}
          currency={storeData?.store?.currency ?? "EUR"}
          onClose={() => setStoreOpen(false)}
          onOpenProduct={(product) => {
            setStoreOpen(false);
            setActiveProduct(product);
          }}
          onOpenCart={() => setCartOpen(true)}
          cartCount={cartCount}
        />
      )}

      <PublicStoreProductBuilder
        open={Boolean(activeProduct)}
        product={activeProduct}
        images={images}
        currency={storeData?.store?.currency ?? "EUR"}
        allowBulkBuy={Boolean(storeData?.store?.allowBulkBuy)}
        initialImageId={activeImageId}
        onClose={() => setActiveProduct(null)}
        onAdd={addItems}
      />

      <StoreCartPanel
        open={cartOpen}
        items={cart}
        data={storeData}
        identifier={galary}
        checkoutHref={checkoutHref}
        onClose={() => setCartOpen(false)}
        onChange={(itemId, patch) =>
          setCart((items) => items.map((item) => item.id === itemId ? { ...item, ...patch } : item))
        }
        onRemove={(itemId) => setCart((items) => items.filter((item) => item.id !== itemId))}
        onClear={() => setCart([])}
      />
    </>
  );
}

function GalleryStoreMegaMenu({
  products,
  onOpen,
  onClose,
}: {
  products: PublicStoreProduct[];
  onOpen: (product: PublicStoreProduct) => void;
  onClose: () => void;
}) {
  const categories = ["Prints", "Wall Art", "Digital Downloads", ...new Set(products.map(productCategory))]
    .filter((category, index, list) => list.indexOf(category) === index);
  return (
    <div className="fixed left-0 right-0 top-16 z-[80] border-b border-black/10 bg-white/98 px-8 py-9 text-[#222] shadow-[0_18px_40px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto grid max-w-[900px] gap-20 md:grid-cols-2">
        {categories.map((category) => (
          <div key={category}>
            <p className="mb-4 text-sm font-medium text-black">{category}</p>
            <div className="grid gap-4">
              {products
                .filter((product) => product.active !== false && productCategory(product) === category)
                .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
                .map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    className="text-left text-sm text-[#777] transition hover:text-black"
                    onClick={() => {
                      onOpen(product);
                      onClose();
                    }}
                  >
                    {product.name}
                  </button>
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
  onOpenStore,
  onPickProduct,
  onClose,
}: {
  image: GalleryImage;
  products: PublicStoreProduct[];
  currency: string;
  onOpenStore: () => void;
  onPickProduct: (product: PublicStoreProduct) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("Prints");
  const activeProducts = products
    .filter((product) => product.active !== false && productCategory(product) === tab)
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  const mainPrint = products.find(
    (product) => product.active !== false && product.slug === "print",
  ) ?? activeProducts[0];
  const categories = ["Prints", "Wall Art", "Digital Downloads", ...new Set(products.map(productCategory))]
    .filter((category, index, list) => list.indexOf(category) === index && products.some((product) => productCategory(product) === category));

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
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-4 md:px-10 md:py-5">
            <h2 className="min-w-0 text-lg font-medium">Buy This Photo</h2>
            <div className="flex shrink-0 items-center gap-3 sm:gap-5">
              <button type="button" onClick={onOpenStore} className="whitespace-nowrap text-sm text-[#777] hover:text-black">
                Visit Store <ChevronRight className="ml-1 inline size-4" />
              </button>
              <button className="flex size-9 items-center justify-center" onClick={onClose} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
          </header>

          <div className="px-4 pb-10 pt-5 md:px-10">
            <div className="flex gap-5 overflow-x-auto border-b md:gap-7 md:overflow-visible">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`shrink-0 border-b-2 pb-3 text-sm ${
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
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => onPickProduct(mainPrint)}
                      className="flex min-h-11 items-center justify-between gap-5 py-3 text-sm"
                    >
                      <span>{variant.label}</span>
                      <span className="flex items-center gap-5 text-[#777]">
                        {formatMoney(variant.price, currency)}
                        <ChevronRight className="size-4" />
                      </span>
                    </button>
                  ))}
                </div>
                <h3 className="mt-9 text-base font-medium">Shop All Prints</h3>
                <ProductChoiceGrid products={activeProducts} currency={currency} onPickProduct={onPickProduct} />
              </>
            ) : (
              <ProductChoiceGrid products={activeProducts} currency={currency} onPickProduct={onPickProduct} />
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
  onPickProduct,
}: {
  products: PublicStoreProduct[];
  currency: string;
  onPickProduct: (product: PublicStoreProduct) => void;
}) {
  return (
    <div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const preview = product.previewImages?.[0] || product.images?.[0];
        return (
          <button
            key={product._id}
            type="button"
            className="group text-left"
            onClick={() => onPickProduct(product)}
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
          </button>
        );
      })}
    </div>
  );
}

function StoreOverlay({
  data,
  currency,
  cartCount,
  onClose,
  onOpenProduct,
  onOpenCart,
}: {
  data: PublicStoreData | null;
  currency: string;
  cartCount: number;
  onClose: () => void;
  onOpenProduct: (product: PublicStoreProduct) => void;
  onOpenCart: () => void;
}) {
  const products = (data?.products ?? []).filter((product) => product.active !== false);
  return (
    <div className="fixed inset-0 z-[110] bg-black/55 p-0 md:p-5" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-h-[940px] w-full max-w-[1180px] flex-col overflow-hidden bg-white shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#888]">Store</p>
            <h2 className="truncate text-lg font-medium">{data?.collection?.name || "Collection Store"}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button className="inline-flex h-10 items-center gap-2 border px-4 text-sm" onClick={onOpenCart} type="button">
              <ShoppingBag className="size-4" /> {cartCount}
            </button>
            <button className="flex size-10 items-center justify-center" onClick={onClose} aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">
          <PublicStoreCatalog
            products={products}
            currency={currency}
            enabled={data?.store?.enabled !== false}
            onOpen={onOpenProduct}
          />
        </div>
      </div>
    </div>
  );
}

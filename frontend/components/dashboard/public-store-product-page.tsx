"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { PublicStoreProductBuilder } from "./public-store-product-builder";
import { StoreCartPanel } from "./store-cart-panel";
import {
  displayPrice,
  formatMoney,
  publicImageSrc,
  storeCartKey,
  stripHtml,
  visibleVariants,
  type PublicStoreCartItem,
  type PublicStoreData,
} from "@/lib/public-store";

export function PublicStoreProductPage({
  data,
  identifier,
  backHref,
  productSlug,
  initialImageId,
}: {
  data?: PublicStoreData | null;
  identifier: string;
  backHref: string;
  productSlug: string;
  initialImageId?: string;
}) {
  const products = data?.products ?? [];
  const product = products.find(
    (item) => item.slug === productSlug || item._id === productSlug,
  );
  const related = products
    .filter(
      (item) =>
        item.active !== false &&
        item._id !== product?._id &&
        item.category === product?.category,
    )
    .slice(0, 4);
  const currency = data?.store?.currency ?? "EUR";
  const [builderOpen, setBuilderOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<PublicStoreCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activePreview, setActivePreview] = useState(0);
  const [infoOpen, setInfoOpen] = useState(true);
  const cartKey = storeCartKey(data?.collection?._id);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const previews = useMemo(
    () => product?.previewImages?.length ? product.previewImages : product?.images ?? [],
    [product],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(cartKey);
      if (stored) setCart(JSON.parse(stored) as PublicStoreCartItem[]);
    } catch {
      window.localStorage.removeItem(cartKey);
    }
    setHydrated(true);
  }, [cartKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey, hydrated]);

  useEffect(() => setActivePreview(0), [product?._id]);

  const addItems = (incoming: PublicStoreCartItem[]) => {
    setCart((current) => {
      const next = [...current];
      incoming.forEach((entry) => {
        const index = next.findIndex((item) => item.id === entry.id);
        if (index >= 0) {
          next[index] = {
            ...next[index],
            quantity: next[index].quantity + entry.quantity,
          };
        } else {
          next.push(entry);
        }
      });
      return next;
    });
    setCartOpen(true);
    toast.success(incoming.length > 1 ? `${incoming.length} products added` : "Product added");
  };

  if (!data || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-medium">Product unavailable</h1>
          <Link href={`${backHref}/store`} className="mt-6 inline-flex border px-6 py-3 text-sm">
            Back to store
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="flex h-[68px] items-center justify-between gap-5 px-4 md:px-8">
          <Link href={backHref} className="min-w-0">
            <h1 className="truncate text-sm font-medium uppercase tracking-[0.05em] md:text-base">
              {data.collection?.name}
            </h1>
            {data.collection?.studioName && (
              <p className="mt-1 truncate text-[9px] uppercase tracking-[0.26em] text-[#8a8a8a]">
                {data.collection.studioName}
              </p>
            )}
          </Link>
          <div className="flex items-center gap-6">
            <Link href={`${backHref}/store`} className="text-sm font-medium">Print Store</Link>
            <Link href={backHref} className="hidden text-sm text-[#777] md:block">View Gallery</Link>
            <button className="relative flex size-10 items-center justify-center" onClick={() => setCartOpen(true)} aria-label="Open cart">
              <ShoppingBag className="size-5" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-full bg-[#28b9a4] text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-5 pb-20 pt-8 md:px-8">
        <div className="mb-5 text-sm text-[#888]">
          <Link href={`${backHref}/store`}>Home</Link>
          <span className="mx-2">/</span>
          <span>{product.category}</span>
          <span className="mx-2">/</span>
          <span className="font-medium text-[#222]">{product.name}</span>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(390px,0.95fr)]">
          <div className="bg-[#f2f3f3]">
            <div className="flex min-h-[560px] items-center justify-center p-8">
              {previews[activePreview] && (
                <img
                  src={publicImageSrc(previews[activePreview])}
                  alt={product.name}
                  className="max-h-[620px] w-full object-contain"
                />
              )}
            </div>
            {previews.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t bg-white p-3">
                {previews.map((preview, index) => (
                  <button
                    key={`${preview}-${index}`}
                    className={`size-16 shrink-0 border p-1 ${
                      activePreview === index ? "border-black" : "border-transparent"
                    }`}
                    onClick={() => setActivePreview(index)}
                  >
                    <img src={publicImageSrc(preview)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="py-1">
            <h2 className="text-3xl font-normal">{product.name}</h2>
            <p className="mt-3 text-lg">
              From {formatMoney(displayPrice(product), currency)}
            </p>
            <p className="mt-6 text-sm leading-7 text-[#555]">
              {stripHtml(product.description)}
            </p>

            {visibleVariants(product).length > 0 && (
              <div className="mt-8">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#777]">
                  Size
                </p>
                <div className="flex flex-wrap gap-2">
                  {visibleVariants(product).map((variant) => (
                    <button
                      key={variant.id}
                      className="border px-3 py-2 text-sm transition hover:border-black"
                      onClick={() => setBuilderOpen(true)}
                    >
                      {variant.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="mt-10 h-12 w-full max-w-[300px] bg-[#303030] text-sm font-semibold text-white"
              onClick={() => setBuilderOpen(true)}
            >
              {initialImageId ? "Buy This Photo" : product.category === "Wall Art" ? "Buy Wall Art" : "Buy Prints"}
            </button>

            <div className="mt-10 border-y">
              <button
                className="flex w-full items-center justify-between py-5 text-sm font-medium"
                onClick={() => setInfoOpen((value) => !value)}
              >
                <span className="text-[11px] uppercase tracking-[0.2em]">Product info</span>
                <ChevronDown className={`size-4 transition ${infoOpen ? "rotate-180" : ""}`} />
              </button>
              {infoOpen && (
                <div className="pb-6 text-sm leading-7 text-[#555]">
                  <p>{stripHtml(product.productInfo) || stripHtml(product.description)}</p>
                  {product.productionNote && (
                    <p className="mt-3">{stripHtml(product.productionNote)}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="pt-16">
            <h3 className="text-2xl font-normal">You Might Also Like</h3>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => {
                const preview = item.previewImages?.[0] || item.images?.[0];
                return (
                  <Link
                    key={item._id}
                    href={`${backHref}/store/${encodeURIComponent(item.slug)}${
                      initialImageId ? `?imageId=${encodeURIComponent(initialImageId)}` : ""
                    }`}
                  >
                    <div className="aspect-square overflow-hidden bg-[#f2f2f0]">
                      {preview && (
                        <img src={publicImageSrc(preview)} alt={item.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <p className="mt-3 text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-sm text-[#888]">
                      From {formatMoney(displayPrice(item), currency)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </section>

      <PublicStoreProductBuilder
        open={builderOpen}
        product={product}
        images={data.collection?.images ?? []}
        currency={currency}
        allowBulkBuy={data.store?.allowBulkBuy !== false}
        initialImageId={initialImageId}
        onClose={() => setBuilderOpen(false)}
        onAdd={addItems}
      />

      <StoreCartPanel
        open={cartOpen}
        items={cart}
        data={data}
        identifier={identifier}
        onClose={() => setCartOpen(false)}
        onChange={(itemId, patch) =>
          setCart((items) =>
            items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
          )
        }
        onRemove={(itemId) => setCart((items) => items.filter((item) => item.id !== itemId))}
        onClear={() => setCart([])}
      />
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PublicStoreProductBuilder } from "./public-store-product-builder";
import { StoreCartPanel } from "./store-cart-panel";
import { PublicStoreCatalog, StoreMegaMenu, categoryNames } from "./public-store-catalog";
import {
  storeCartKey,
  type PublicStoreCartItem,
  type PublicStoreData,
  type PublicStoreProduct,
} from "@/lib/public-store";

export function PublicStore({
  data,
  identifier,
  backHref,
  initialProductSlug,
  initialImageId,
}: {
  data?: PublicStoreData | null;
  identifier: string;
  backHref: string;
  initialProductSlug?: string;
  initialImageId?: string;
}) {
  const products = useMemo(
    () => (data?.products ?? [])
      .filter((product) => product.active !== false)
      .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
    [data?.products],
  );
  const categories = useMemo(() => categoryNames(products), [products]);
  const [activeProduct, setActiveProduct] = useState<PublicStoreProduct | null>(null);
  const [cart, setCart] = useState<PublicStoreCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const currency = data?.store?.currency ?? "EUR";
  const cartStorageKey = storeCartKey(data?.collection?._id);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const collectionSets = data?.collection?.sets ?? [];

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(cartStorageKey);
      if (stored) setCart(JSON.parse(stored) as PublicStoreCartItem[]);
    } catch {
      window.localStorage.removeItem(cartStorageKey);
    }
    setHydrated(true);
  }, [cartStorageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey, hydrated]);

  useEffect(() => {
    if (!initialProductSlug || !products.length) return;
    const product = products.find((item) => item.slug === initialProductSlug || item._id === initialProductSlug);
    if (product) setActiveProduct(product);
  }, [initialProductSlug, products]);

  const addItems = (incoming: PublicStoreCartItem[]) => {
    setCart((current) => {
      const next = [...current];
      incoming.forEach((entry) => {
        const index = next.findIndex((item) => item.id === entry.id);
        if (index >= 0) next[index] = { ...next[index], quantity: next[index].quantity + entry.quantity };
        else next.push(entry);
      });
      return next;
    });
    incoming.forEach((item) => {
      void fetch(`/api/public-print-store/${encodeURIComponent(identifier)}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "add_to_cart",
          metadata: {
            productId: item.product._id,
            productName: item.product.name,
            imageId: item.image?._id,
            source: initialImageId ? "buy-photo" : "public-store",
            amount: Number(item.variant?.price ?? item.product.price ?? 0) * item.quantity,
            currency,
          },
        }),
      }).catch(() => null);
    });
    toast.success(incoming.length > 1 ? `${incoming.length} products added to cart` : "Product added to cart");
  };

  const updateCartItem = (itemId: string, patch: Partial<PublicStoreCartItem>) => {
    setCart((items) => items.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  };

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <div>
          <h1 className="text-2xl font-medium">Store unavailable</h1>
          <p className="mt-3 text-sm text-[#666]">This collection does not have an active print store.</p>
          <Link href={backHref} className="mt-7 inline-flex border px-6 py-3 text-sm font-medium">Back to gallery</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="flex h-[68px] items-center justify-between gap-5 px-4 md:px-8">
          <Link href={backHref} className="min-w-0 max-w-[430px]">
            <h1 className="truncate text-sm font-medium uppercase tracking-[0.05em] md:text-base">
              {data.collection?.name || "Collection Store"}
            </h1>
            {data.collection?.studioName && (
              <p className="mt-1 truncate text-[9px] uppercase tracking-[0.26em] text-[#8a8a8a]">
                {data.collection.studioName}
              </p>
            )}
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-7 overflow-hidden text-sm lg:flex">
            {collectionSets.slice(0, 8).map((set) => (
              <Link
                key={set.id}
                href={`${backHref}#gallery`}
                className="shrink-0 text-[#777] transition hover:text-black"
              >
                {set.name}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-5">
            <div
              className="relative hidden lg:block"
              onMouseEnter={() => setMenuOpen(true)}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button className="flex h-[67px] items-center border-r pr-6 text-sm font-medium">
                Print Store
              </button>
              {menuOpen && (
                <StoreMegaMenu
                  products={products}
                  currency={currency}
                  onOpen={(product) => {
                    setActiveProduct(product);
                    setMenuOpen(false);
                  }}
                />
              )}
            </div>
            <Link href={backHref} className="hidden text-sm text-[#777] md:block">View Gallery</Link>
            <button className="relative flex size-10 items-center justify-center" onClick={() => setCartOpen(true)} aria-label="Open cart">
              <ShoppingBag className="size-5" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-full bg-[#28b9a4] text-[10px] font-bold text-white">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 pt-10 md:px-10">
        <div className="grid gap-8 border-b pb-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#888]">Print Store</p>
            <h2 className="mt-2 text-2xl font-normal md:text-4xl">Shop this collection</h2>
            <p className="mt-4 max-w-[720px] text-sm leading-7 text-[#666]">
              Curated prints, wall art, and keepsakes built from this gallery. Choose a product,
              personalize it, then checkout in one flow.
            </p>
            {categories.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <a
                    key={category}
                    href={`#${category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                    className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition hover:border-black"
                  >
                    {category}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="border bg-[#f7f7f4] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#888]">Collection</p>
              <p className="mt-3 text-lg font-medium">{data.collection?.name || "Collection Store"}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-[#666]">
                <Sparkles className="size-4 text-[#22bda7]" />
                {products.length} active product{products.length === 1 ? "" : "s"}
              </div>
            </div>
            <button className="inline-flex h-12 items-center justify-center gap-2 border px-4 text-sm font-medium" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="size-4" /> Cart ({cartCount})
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <PublicStoreCatalog
          products={products}
          currency={currency}
          enabled={data.store?.enabled !== false}
          onOpen={setActiveProduct}
        />
      </section>

      <PublicStoreProductBuilder
        open={Boolean(activeProduct)}
        product={activeProduct}
        images={data.collection?.images ?? []}
        currency={currency}
        allowBulkBuy={data.store?.allowBulkBuy !== false}
        initialImageId={initialImageId}
        onClose={() => setActiveProduct(null)}
        onAdd={addItems}
      />
      <StoreCartPanel
        open={cartOpen}
        items={cart}
        data={data}
        identifier={identifier}
        onClose={() => setCartOpen(false)}
        onChange={updateCartItem}
        onRemove={(itemId) => setCart((items) => items.filter((item) => item.id !== itemId))}
        onClear={() => setCart([])}
      />
    </main>
  );
}

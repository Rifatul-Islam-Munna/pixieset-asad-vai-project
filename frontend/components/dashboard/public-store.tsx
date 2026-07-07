"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { PublicStoreProductBuilder } from "./public-store-product-builder";
import { StoreCartPanel } from "./store-cart-panel";
import { PublicStoreCatalog, StoreMegaMenu, categoryNames, slugify } from "./public-store-catalog";
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
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="flex min-h-[70px] items-center justify-between gap-5 px-4 md:px-8">
          <Link href={backHref} className="min-w-0">
            <h1 className="truncate text-sm font-medium uppercase tracking-[0.06em] md:max-w-[520px] md:text-base">
              {data.collection?.name || "Collection Store"}
            </h1>
            {data.collection?.studioName && (
              <p className="mt-1 truncate text-[9px] uppercase tracking-[0.26em] text-[#8a8a8a]">{data.collection.studioName}</p>
            )}
          </Link>

          <nav className="hidden items-center gap-7 text-sm lg:flex">
            {categories.slice(0, 4).map((category) => (
              <a key={category} href={`#${slugify(category)}`} className="text-[#595959] transition hover:text-black">{category}</a>
            ))}
            {data.store?.showPrintStoreNav !== false && (
              <div className="relative" onMouseEnter={() => setMenuOpen(true)} onMouseLeave={() => setMenuOpen(false)}>
                <button className="flex h-[69px] items-center gap-1.5 font-medium" onClick={() => setMenuOpen((value) => !value)}>
                  Print Store <ChevronDown className="size-3.5" />
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
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-4">
            <Link href={backHref} className="hidden text-sm text-[#666] md:block">View Gallery</Link>
            <button className="relative flex size-10 items-center justify-center" onClick={() => setCartOpen(true)} aria-label="Open cart">
              <ShoppingBag className="size-5" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-full bg-[#28b9a4] text-[10px] font-bold text-white">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 pt-12 md:px-10 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b pb-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#888]">Print Store</p>
            <h2 className="mt-3 text-3xl font-normal tracking-tight md:text-4xl">Preserve your favourite moments</h2>
            <p className="mt-3 max-w-[680px] text-sm leading-7 text-[#656565]">Choose photographs from this collection and order professional prints, wall art or digital downloads.</p>
          </div>
          <button className="inline-flex h-11 items-center gap-3 border px-5 text-sm" onClick={() => setCartOpen(true)}>
            <ShoppingBag className="size-4" /> Cart ({cartCount})
          </button>
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

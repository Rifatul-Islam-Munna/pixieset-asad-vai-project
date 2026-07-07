"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { StoreOrderPanel } from "./store-order-panel";
import { storeCartKey, type PublicStoreCartItem, type PublicStoreData } from "@/lib/public-store";

export function PublicStoreCheckoutPage({
  data,
  identifier,
  backHref,
}: {
  data?: PublicStoreData | null;
  identifier: string;
  backHref: string;
}) {
  const cartKey = storeCartKey(data?.collection?._id ?? identifier);
  const [items, setItems] = useState<PublicStoreCartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(cartKey);
      setItems(stored ? (JSON.parse(stored) as PublicStoreCartItem[]) : []);
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, [cartKey]);

  const clearCart = () => {
    setItems([]);
    window.localStorage.removeItem(cartKey);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-8 text-[#202326] md:px-8">
      <div className="mx-auto max-w-[980px] bg-white shadow-sm">
        <header className="flex min-h-16 items-center justify-between border-b px-5 md:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#888]">Checkout</p>
            <h1 className="text-xl font-semibold">{data?.collection?.name ?? "Print Store"}</h1>
          </div>
          <Link href={backHref} className="text-sm font-semibold text-[#555] hover:text-black">
            Back to gallery
          </Link>
        </header>

        {!loaded ? (
          <div className="p-10 text-sm text-[#777]">Loading cart...</div>
        ) : !count ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#f3f3f1]"><ShoppingBag className="size-7" /></span>
            <h2 className="mt-5 text-xl font-medium">Your cart is empty</h2>
            <Link href={backHref} className="mt-7 inline-flex h-11 items-center bg-[#303030] px-7 text-sm font-semibold text-white">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="flex min-h-[720px]">
            <StoreOrderPanel
              items={items}
              data={data}
              identifier={identifier}
              backLabel="Back to gallery"
              onBack={() => {
                window.location.href = backHref;
              }}
              onClear={clearCart}
            />
          </div>
        )}
      </div>
    </main>
  );
}

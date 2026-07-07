"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  cartItemPrice,
  formatMoney,
  publicImageSrc,
  type PublicStoreCartItem,
  type PublicStoreData,
} from "@/lib/public-store";
import { PhotoAdjustDialog } from "./photo-adjust-dialog";
import { StoreOrderPanel } from "./store-order-panel";

export function StoreCartPanel({
  open,
  items,
  data,
  identifier,
  checkoutHref,
  onClose,
  onChange,
  onRemove,
  onClear,
}: {
  open: boolean;
  items: PublicStoreCartItem[];
  data?: PublicStoreData | null;
  identifier: string;
  checkoutHref?: string;
  onClose: () => void;
  onChange: (itemId: string, patch: Partial<PublicStoreCartItem>) => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
}) {
  const [orderOpen, setOrderOpen] = useState(false);
  const [cropItemId, setCropItemId] = useState("");
  const currency = data?.store?.currency ?? "EUR";
  const cropItem = items.find((item) => item.id === cropItemId);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + cartItemPrice(item) * item.quantity, 0),
    [items],
  );
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/45" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" aria-label="Close cart" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b px-5 md:px-7">
          <div>
            <p className="text-lg font-medium">{orderOpen ? "Checkout" : "Your Cart"}</p>
            <p className="text-xs text-[#777]">{count} {count === 1 ? "item" : "items"}</p>
          </div>
          <button className="flex size-10 items-center justify-center" onClick={onClose} aria-label="Close"><X className="size-5" /></button>
        </header>

        {!items.length ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#f3f3f1]"><ShoppingBag className="size-7" /></span>
            <h2 className="mt-5 text-xl font-medium">Your cart is empty</h2>
            <p className="mt-2 max-w-[300px] text-sm leading-6 text-[#666]">Choose a print, wall-art product or digital download from this collection.</p>
            <button className="mt-7 h-11 bg-[#303030] px-7 text-sm font-semibold text-white" onClick={onClose}>Continue Shopping</button>
          </div>
        ) : orderOpen ? (
          <StoreOrderPanel
            items={items}
            data={data}
            identifier={identifier}
            onBack={() => setOrderOpen(false)}
            onClear={onClear}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 md:px-7">
              {items.map((item) => (
                <article key={item.id} className="grid grid-cols-[92px_1fr] gap-4 border-b py-5">
                  <div className="aspect-square overflow-hidden bg-[#f1f1ef]">
                    {(item.image?.url || item.product.images?.[0]) && (
                      <img
                        src={publicImageSrc(item.image?.thumbnailUrl || item.image?.url || item.product.images?.[0])}
                        alt=""
                        className="h-full w-full object-cover"
                        style={item.crop ? { transform: `scale(${Math.min(1.35, item.crop.zoom)})` } : undefined}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{item.product.name}</h3>
                        {item.variant?.label && <p className="mt-1 text-xs text-[#777]">{item.variant.label}</p>}
                        {item.image?.originalName && <p className="mt-1 truncate text-xs text-[#777]">{item.image.originalName}</p>}
                      </div>
                      <button className="text-[#888] hover:text-red-600" onClick={() => onRemove(item.id)} aria-label="Remove item"><Trash2 className="size-4" /></button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex h-9 items-center border">
                        <button className="flex size-9 items-center justify-center" onClick={() => onChange(item.id, { quantity: Math.max(1, item.quantity - 1) })}><Minus className="size-3" /></button>
                        <span className="w-8 text-center text-xs">{item.quantity}</span>
                        <button className="flex size-9 items-center justify-center" onClick={() => onChange(item.id, { quantity: Math.min(99, item.quantity + 1) })}><Plus className="size-3" /></button>
                      </div>
                      <span className="text-sm font-medium">{formatMoney(cartItemPrice(item) * item.quantity, currency)}</span>
                    </div>
                    {item.crop && (
                      <button className="mt-3 text-xs font-medium underline underline-offset-4" onClick={() => setCropItemId(item.id)}>Edit crop</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <footer className="shrink-0 border-t px-5 py-5 md:px-7">
              <div className="flex items-center justify-between text-base font-semibold"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
              <button
                className="mt-4 h-12 w-full bg-[#303030] text-sm font-semibold text-white"
                onClick={() => {
                  if (checkoutHref) window.location.href = checkoutHref;
                  else setOrderOpen(true);
                }}
              >
                Checkout
              </button>
              <button className="mt-3 h-10 w-full text-xs font-medium text-[#777]" onClick={onClear}>Clear cart</button>
            </footer>
          </>
        )}

        {cropItem && (
          <PhotoAdjustDialog
            item={cropItem}
            onClose={() => setCropItemId("")}
            onSave={(crop) => {
              onChange(cropItem.id, { crop });
              setCropItemId("");
              toast.success("Crop updated");
            }}
          />
        )}
      </aside>
    </div>
  );
}

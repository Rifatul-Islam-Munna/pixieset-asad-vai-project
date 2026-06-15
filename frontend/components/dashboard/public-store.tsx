"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type PublicProduct = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  type: "digital-download" | "self-fulfilled";
  images?: string[];
};

type PublicStoreData = {
  collection?: { name?: string };
  store?: {
    currency?: string;
    globalStatus?: boolean;
    canCheckout?: boolean;
    checkoutMessage?: string;
    paymentMethods?: {
      stripe?: {
        enabled?: boolean;
        publishableKey?: string;
      };
    };
  };
  products?: PublicProduct[];
  shipping?: { _id: string; name: string; region?: string; price: number; shipInternational?: boolean }[];
  coupons?: { code: string; name: string; discountType: "percent" | "fixed"; amount: number }[];
  taxes?: { region?: string; rate: number; applyShipping?: boolean; applyDigitalDownloads?: boolean }[];
};

export function PublicStore({
  data,
  identifier,
  backHref,
}: {
  data?: PublicStoreData | null;
  identifier: string;
  backHref: string;
}) {
  const products = data?.products ?? [];
  const currency = data?.store?.currency ?? "EUR";
  const [activeProduct, setActiveProduct] = useState<PublicProduct | null>(null);
  const [cart, setCart] = useState<{ product: PublicProduct; quantity: number }[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", country: "" });
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingMethod = (data?.shipping ?? []).find((method) => method._id === shippingMethodId);
  const shipping = shippingMethod ? Number(shippingMethod.price ?? 0) : 0;
  const coupon = (data?.coupons ?? []).find((item) => item.code.toUpperCase() === couponCode.trim().toUpperCase());
  const discount = coupon
    ? coupon.discountType === "percent"
      ? Math.min(subtotal, (subtotal * Number(coupon.amount ?? 0)) / 100)
      : Math.min(subtotal, Number(coupon.amount ?? 0))
    : 0;
  const taxRule = (data?.taxes ?? []).find((tax) => !tax.region || tax.region === customer.country || tax.region === "All");
  const taxBase = Math.max(0, subtotal - discount) + (taxRule?.applyShipping ? shipping : 0);
  const tax = taxRule ? (taxBase * Number(taxRule.rate ?? 0)) / 100 : 0;
  const total = Math.max(0, subtotal + shipping + tax - discount);
  const stripeReady = Boolean(
    data?.store?.canCheckout ||
      (
        data?.store?.paymentMethods?.stripe?.enabled &&
        data?.store?.paymentMethods?.stripe?.publishableKey
      ),
  );
  const paymentMessage = data?.store?.checkoutMessage ?? "No payment method active at this moment.";
  const addToCart = (product: PublicProduct) => {
    setCart((items) => {
      const existing = items.find((item) => item.product._id === product._id);
      if (existing) {
        toast.info("Product already in cart");
        return items;
      }
      toast.success("Product added to cart");
      return [...items, { product, quantity: 1 }];
    });
  };
  const checkout = async () => {
    setCheckoutMessage("");
    const currentUrl = window.location.href.replace(/\/$/, "");
    const response = await fetch(`/api/public-store/${encodeURIComponent(identifier)}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer,
        successUrl: `${currentUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: currentUrl,
        shippingMethodId,
        couponCode,
        items: cart.map((item) => ({
          productId: item.product._id,
          name: item.product.name,
          type: item.product.type,
          unitPrice: item.product.price,
          price: item.product.price,
          quantity: item.quantity,
        })),
      }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setCheckoutMessage(payload?.message ?? "Checkout failed");
      return;
    }
    if (payload?.data?.checkoutUrl) {
      window.location.href = payload.data.checkoutUrl;
      return;
    }
    setCheckoutMessage("Stripe checkout URL missing.");
  };

  return (
    <main className="min-h-screen bg-white px-5 py-7 text-[#111] md:px-10">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-[#555]">
        <ArrowLeft className="size-4" />
        Back to gallery
      </Link>
      <header className="mt-8 flex flex-wrap items-end justify-between gap-5 border-b pb-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#777]">Store</p>
          <h1 className="mt-3 text-3xl font-semibold">{data?.collection?.name ?? "Collection Store"}</h1>
        </div>
        <button className="relative" onClick={() => setCheckoutOpen(true)} aria-label="Open cart">
          <ShoppingBag className="size-8" />
          {cart.length > 0 && (
            <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-[#111] text-xs font-bold text-white">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      {!products.length ? (
        <p className="mt-12 text-sm text-[#666]">No products available yet.</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <article key={product._id} className="border bg-white">
              <div className="aspect-square bg-[#f3f3f3]">
                {product.images?.[0] ? (
                  <img src={imageSrc(product.images[0])} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#777]">
                    {product.type === "digital-download" ? "Digital Download" : "Print Product"}
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#777]">{product.category ?? product.type}</p>
                <h2 className="mt-2 line-clamp-2 min-h-[44px] text-base font-semibold leading-snug">{product.name}</h2>
                {product.description && (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#666]">{plainText(product.description)}</p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="rounded-full bg-[#f1f1f1] px-3 py-1 text-sm font-bold">
                    {currency} {formatPrice(product.price)}
                  </p>
                  <button
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#111]"
                    onClick={() => setActiveProduct(product)}
                  >
                    <Eye className="size-4" />
                    View
                  </button>
                </div>
                <button className="mt-4 w-full bg-[#111] px-4 py-2 text-sm font-bold text-white" onClick={() => addToCart(product)}>
                  Add to Cart
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative grid max-h-[92dvh] w-full max-w-[980px] overflow-y-auto bg-white md:grid-cols-[1.1fr_0.9fr]">
            <button
              className="absolute right-4 top-4 z-10 bg-white p-2 text-black shadow-sm"
              onClick={() => setActiveProduct(null)}
              aria-label="Close product"
            >
              <X className="size-5" />
            </button>
            <div className="bg-[#f3f3f3]">
              {activeProduct.images?.[0] ? (
                <img src={imageSrc(activeProduct.images[0])} alt="" className="h-full min-h-[420px] w-full object-cover" />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center text-sm text-[#777]">
                  {activeProduct.type === "digital-download" ? "Digital Download" : "Print Product"}
                </div>
              )}
            </div>
            <div className="p-8">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#777]">{activeProduct.category ?? activeProduct.type}</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight">{activeProduct.name}</h2>
              <p className="mt-5 inline-flex rounded-full bg-[#111] px-4 py-2 text-sm font-bold text-white">
                {currency} {formatPrice(activeProduct.price)}
              </p>
              {activeProduct.description && (
                <p className="mt-6 text-sm leading-7 text-[#555]">{plainText(activeProduct.description)}</p>
              )}
              <button className="mt-8 w-full bg-[#111] px-5 py-3 text-sm font-bold text-white" onClick={() => addToCart(activeProduct)}>
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/55">
          <div className="h-full w-full max-w-[430px] overflow-y-auto bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Cart</h2>
              <button onClick={() => setCheckoutOpen(false)} aria-label="Close cart">
                <X className="size-5" />
              </button>
            </div>

            {!cart.length ? (
              <p className="mt-8 text-sm text-[#666]">Cart empty.</p>
            ) : (
              <div className="mt-7 flex flex-col gap-4">
                {cart.map((item) => (
                  <div key={item.product._id} className="flex gap-3 border-b pb-4">
                    <div className="size-16 shrink-0 bg-[#f2f2f2]">
                      {item.product.images?.[0] && (
                        <img src={imageSrc(item.product.images[0])} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.product.name}</p>
                      <p className="mt-1 text-sm text-[#666]">
                        {currency} {formatPrice(item.product.price)} x {item.quantity}
                      </p>
                    </div>
                    <button
                      className="text-red-600"
                      onClick={() => setCart((items) => items.filter((entry) => entry.product._id !== item.product._id))}
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <div className="grid gap-3">
                  <input className="h-11 border px-3 text-sm outline-none" placeholder="Name" value={customer.name} onChange={(event) => setCustomer((value) => ({ ...value, name: event.target.value }))} />
                  <input className="h-11 border px-3 text-sm outline-none" placeholder="Email" value={customer.email} onChange={(event) => setCustomer((value) => ({ ...value, email: event.target.value }))} />
                  <input className="h-11 border px-3 text-sm outline-none" placeholder="Phone" value={customer.phone} onChange={(event) => setCustomer((value) => ({ ...value, phone: event.target.value }))} />
                  <input className="h-11 border px-3 text-sm outline-none" placeholder="Country" value={customer.country} onChange={(event) => setCustomer((value) => ({ ...value, country: event.target.value }))} />
                </div>
                {(data?.shipping?.length ?? 0) > 0 && (
                  <select
                    value={shippingMethodId}
                    onChange={(event) => setShippingMethodId(event.target.value)}
                    className="h-11 border px-3 text-sm outline-none"
                  >
                    <option value="">No shipping</option>
                    {(data?.shipping ?? []).map((method) => (
                      <option key={method._id} value={method._id}>
                        {method.name} - {currency} {formatPrice(method.price)}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  className="h-11 border px-3 text-sm uppercase outline-none"
                  placeholder="Coupon code"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
                />
                {couponCode && !coupon && (
                  <p className="text-xs font-semibold text-red-600">Coupon not valid.</p>
                )}
                <div className="border-t pt-4 text-sm">
                  <div className="flex justify-between"><span>Items</span><span>{currency} {formatPrice(subtotal)}</span></div>
                  <div className="mt-2 flex justify-between"><span>Shipping</span><span>{currency} {formatPrice(shipping)}</span></div>
                  <div className="mt-2 flex justify-between"><span>Tax</span><span>{currency} {formatPrice(tax)}</span></div>
                  {discount > 0 && <div className="mt-2 flex justify-between text-[#008b7d]"><span>Discount</span><span>-{currency} {formatPrice(discount)}</span></div>}
                  <div className="mt-4 flex items-center justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{currency} {formatPrice(total)}</span>
                  </div>
                </div>
                <button
                  className="bg-[#111] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  disabled={!customer.email.trim() || !stripeReady}
                  onClick={checkout}
                >
                  Checkout
                </button>
                {!stripeReady && (
                  <p className="text-sm font-semibold text-red-600">
                    {paymentMessage}
                  </p>
                )}
                {checkoutMessage && <p className="text-sm font-semibold text-[#555]">{checkoutMessage}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function plainText(value?: string) {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPrice(value: number) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function imageSrc(url?: string) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    return `${baseUrl}${url}`;
  }
  return url;
}

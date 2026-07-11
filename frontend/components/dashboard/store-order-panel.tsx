"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2, Package } from "lucide-react";
import {
  cartItemPrice,
  formatMoney,
  type PublicStoreCartItem,
  type PublicStoreData,
} from "@/lib/public-store";

export function StoreOrderPanel({
  items,
  data,
  identifier,
  backLabel = "Back to cart",
  onBack,
  onClear,
}: {
  items: PublicStoreCartItem[];
  data?: PublicStoreData | null;
  identifier: string;
  backLabel?: string;
  onBack: () => void;
  onClear: () => void;
}) {
  const currency = data?.store?.currency ?? "EUR";
  const [customer, setCustomer] = useState({
    name: "", email: "", phone: "", country: "", line1: "", line2: "",
    city: "", state: "", postalCode: "",
  });
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [professional, setProfessional] = useState({ company: "", taxId: "", invoiceNote: "" });
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [pricing, setPricing] = useState<any>(null);
  const [pricingPending, setPricingPending] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [message, setMessage] = useState("");
  const localSubtotal = items.reduce((sum, item) => sum + cartItemPrice(item) * item.quantity, 0);
  const requiresShipping = useMemo(
    () => items.some((item) => item.product.type !== "digital-download"),
    [items],
  );
  const availableShipping = useMemo(() => {
    if (!requiresShipping) return [];
    const country = customer.country.trim().toLowerCase();
    return (data?.shipping ?? []).filter((method) => {
      const region = String(method.region ?? "").trim().toLowerCase();
      if (!country || !region || region === "all" || region === "worldwide") return true;
      return region === country || Boolean(method.shipInternational);
    });
  }, [customer.country, data?.shipping, requiresShipping]);

  useEffect(() => {
    if (!requiresShipping) setShippingMethodId("");
    else if (shippingMethodId && !availableShipping.some((method) => method._id === shippingMethodId)) {
      setShippingMethodId("");
    }
  }, [availableShipping, requiresShipping, shippingMethodId]);

  const requestBody = () => ({
    checkoutSource: "public-store",
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: {
        country: customer.country,
        line1: customer.line1,
        line2: customer.line2,
        city: customer.city,
        state: customer.state,
        postalCode: customer.postalCode,
      },
    },
    professionalInfo: professional,
    marketingOptIn,
    shippingMethodId: requiresShipping && shippingMethodId ? shippingMethodId : undefined,
    couponCode,
    items: items.map((item) => ({
      productId: item.product._id,
      variantId: item.variant?.id,
      imageId: item.image?._id,
      imageUrl: item.image?.url,
      crop: item.crop,
      quantity: item.quantity,
    })),
  });

  const refreshPricing = async () => {
    if (!items.length) return;
    setPricingPending(true);
    setMessage("");
    const response = await fetch(`/api/public-print-store/${encodeURIComponent(identifier)}/cart/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody()),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    if (response?.ok) setPricing(payload?.data ?? null);
    else {
      setPricing(null);
      setMessage(payload?.message ?? "Unable to calculate order totals.");
    }
    setPricingPending(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshPricing(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, shippingMethodId, couponCode, customer.country]);

  const submit = async () => {
    if (!customer.name.trim() || !customer.email.includes("@")) {
      setMessage("Enter your name and a valid email address.");
      return;
    }
    if (data?.store?.requireProfessionalInfo && !professional.company.trim()) {
      setMessage("Company or professional information is required.");
      return;
    }
    if (requiresShipping && availableShipping.length > 0 && !shippingMethodId) {
      setMessage("Choose a shipping method.");
      return;
    }
    setPlacingOrder(true);
    setMessage("");
    const currentUrl = window.location.href.split("?")[0].replace(/\/$/, "");
    const galleryUrl = currentUrl.endsWith("/checkout")
      ? currentUrl.replace(/\/checkout$/, "")
      : currentUrl;
    const successUrl = galleryUrl.endsWith("/store")
      ? `${galleryUrl}/success?session_id={CHECKOUT_SESSION_ID}`
      : `${galleryUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`;
    const response = await fetch(`/api/public-print-store/${encodeURIComponent(identifier)}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...requestBody(),
        successUrl,
        cancelUrl: currentUrl,
      }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    if (!response?.ok || !payload?.data?.checkoutUrl) {
      setMessage(payload?.message ?? "Checkout could not be created.");
      setPlacingOrder(false);
      return;
    }
    onClear();
    window.location.href = payload.data.checkoutUrl;
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-7">
      <button className="mb-6 inline-flex items-center gap-2 text-sm" onClick={onBack}>
        <ArrowLeft className="size-4" /> {backLabel}
      </button>
      <Section title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field placeholder="Full name" value={customer.name} onChange={(name) => setCustomer((v) => ({ ...v, name }))} />
          <Field type="email" placeholder="Email" value={customer.email} onChange={(email) => setCustomer((v) => ({ ...v, email }))} />
          <Field placeholder="Phone" value={customer.phone} onChange={(phone) => setCustomer((v) => ({ ...v, phone }))} wide />
        </div>
        {data?.marketing?.optIn?.storeCheckout && (
          <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#666]">
            <input type="checkbox" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} className="mt-1" />
            <span>Send me updates and special offers.</span>
          </label>
        )}
      </Section>

      <div className="mt-7 flex items-start gap-3 border bg-[#f8f8f6] p-4 text-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
          {requiresShipping ? <Package className="size-4" /> : <Download className="size-4" />}
        </span>
        <div>
          <p className="font-semibold">{requiresShipping ? "Physical delivery" : "Digital delivery"}</p>
          <p className="mt-1 leading-5 text-[#666]">{requiresShipping ? "Shipping is calculated from the selected shipping method and product settings." : "No shipping fee is charged for a cart containing only digital products."}</p>
        </div>
      </div>

      <Section title={requiresShipping ? "Shipping address" : "Billing / tax location"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field placeholder="Country" value={customer.country} onChange={(country) => setCustomer((v) => ({ ...v, country }))} wide />
          {requiresShipping && (
            <>
              <Field placeholder="Address line 1" value={customer.line1} onChange={(line1) => setCustomer((v) => ({ ...v, line1 }))} wide />
              <Field placeholder="Address line 2" value={customer.line2} onChange={(line2) => setCustomer((v) => ({ ...v, line2 }))} wide />
              <Field placeholder="City" value={customer.city} onChange={(city) => setCustomer((v) => ({ ...v, city }))} />
              <Field placeholder="State / region" value={customer.state} onChange={(state) => setCustomer((v) => ({ ...v, state }))} />
              <Field placeholder="Postal code" value={customer.postalCode} onChange={(postalCode) => setCustomer((v) => ({ ...v, postalCode }))} />
            </>
          )}
        </div>
      </Section>
      {data?.store?.requireProfessionalInfo && (
        <Section title="Professional information">
          <div className="grid gap-3">
            <Field placeholder="Company / studio" value={professional.company} onChange={(company) => setProfessional((v) => ({ ...v, company }))} />
            <Field placeholder="Tax ID" value={professional.taxId} onChange={(taxId) => setProfessional((v) => ({ ...v, taxId }))} />
            <textarea className="min-h-24 border p-3 text-sm outline-none" value={professional.invoiceNote} onChange={(event) => setProfessional((v) => ({ ...v, invoiceNote: event.target.value }))} placeholder="Invoice note" />
          </div>
        </Section>
      )}
      {requiresShipping && availableShipping.length > 0 && (
        <Section title="Shipping method">
          <div className="grid gap-2">
            {availableShipping.map((method) => (
              <label key={method._id} className="flex cursor-pointer items-center justify-between border px-4 py-4 text-sm">
                <span className="flex items-center gap-3">
                  <input type="radio" name="shipping" checked={shippingMethodId === method._id} onChange={() => setShippingMethodId(method._id)} />
                  <span><span className="block font-medium">{method.name}</span>{method.region && <span className="mt-1 block text-xs text-[#777]">{method.region}</span>}</span>
                </span>
                <span>{formatMoney(method.price, currency)}</span>
              </label>
            ))}
          </div>
        </Section>
      )}
      <Section title="Coupon">
        <div className="flex gap-2">
          <Field placeholder="Code" value={couponCode} onChange={(value) => setCouponCode(value.toUpperCase())} />
          <button className="h-11 border px-5 text-sm" onClick={() => void refreshPricing()}>Apply</button>
        </div>
      </Section>
      <Section title="Order total">
        <div className="grid gap-2 text-sm">
          <PriceRow label="Subtotal" value={pricing?.subtotal ?? localSubtotal} currency={currency} />
          {(requiresShipping || Number(pricing?.shipping ?? 0) > 0) && <PriceRow label="Shipping" value={pricing?.shipping ?? 0} currency={currency} />}
          <PriceRow label="Tax" value={pricing?.tax ?? 0} currency={currency} />
          {(pricing?.discount ?? 0) > 0 && <PriceRow label="Discount" value={-pricing.discount} currency={currency} />}
          <div className="mt-2 flex justify-between border-t pt-4 text-base font-semibold">
            <span>Total</span><span>{formatMoney(pricing?.total ?? localSubtotal, currency)}</span>
          </div>
        </div>
        {pricingPending && <p className="mt-3 flex items-center gap-2 text-xs text-[#777]"><Loader2 className="size-3 animate-spin" /> Recalculating totals</p>}
      </Section>
      {message && <p className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
      {!data?.store?.canCheckout && <p className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{data?.store?.checkoutMessage || "The collection owner has not finished Stripe setup."}</p>}
      <button className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-[#303030] text-sm font-semibold text-white disabled:opacity-45" disabled={!data?.store?.canCheckout || placingOrder || pricingPending} onClick={() => void submit()}>
        {placingOrder && <Loader2 className="size-4 animate-spin" />}
        {placingOrder ? "Opening secure checkout..." : "Pay with Stripe"}
      </button>
      <p className="mt-3 text-center text-[11px] text-[#888]">Payment uses the collection owner's Stripe account.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-7 border-t pt-6 first:mt-0 first:border-0 first:pt-0"><h3 className="mb-3 text-sm font-semibold">{title}</h3>{children}</section>;
}

function Field({ value, onChange, placeholder, type = "text", wide = false }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string; wide?: boolean }) {
  return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`h-11 min-w-0 border px-3 text-sm outline-none ${wide ? "sm:col-span-2" : ""}`} />;
}

function PriceRow({ label, value, currency }: { label: string; value: number; currency: string }) {
  return <div className="flex justify-between text-[#555]"><span>{label}</span><span>{formatMoney(value, currency)}</span></div>;
}

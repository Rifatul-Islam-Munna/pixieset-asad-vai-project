"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, RotateCw, X } from "lucide-react";
import { type PublicStoreImage, type StoreCrop } from "@/lib/public-store";
import { CropCanvas, defaultCrop } from "./public-store-product-builder";

export function FreePrintRequestDialog({ image, identifier, siteSlug, onClose }: {
  image: PublicStoreImage;
  identifier: string;
  siteSlug: string;
  onClose: () => void;
}) {
  const [crop, setCrop] = useState<StoreCrop>(() => defaultCrop());
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  useEffect(() => {
    setCrop(defaultCrop());
    setCustomer({ name: "", email: "" });
    setNote("");
    setError("");
    setOrderNumber("");
  }, [image._id]);

  const submit = async () => {
    if (!customer.name.trim() || !customer.email.includes("@")) {
      setError("Enter your name and a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/public-print-store/${encodeURIComponent(identifier)}/checkout?siteSlug=${encodeURIComponent(siteSlug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printRequest: true,
          checkoutSource: "print-request",
          customer,
          note: note.trim(),
          items: [{ imageId: image._id, imageUrl: image.url, crop, quantity: 1 }],
        }),
      },
    ).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    if (!response?.ok || !payload?.data?.completed) {
      setError(payload?.message ?? "Print request could not be submitted.");
      setBusy(false);
      return;
    }
    setOrderNumber(String(payload.data.order?.orderNumber ?? "submitted"));
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/65 p-0 md:p-5" role="dialog" aria-modal="true" aria-label="Free print request">
      <div className="mx-auto flex h-full max-h-[940px] w-full max-w-[1100px] flex-col overflow-hidden bg-white shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-5 md:px-8">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#159d8b]">Free print request</p><h2 className="mt-1 text-base font-medium">Adjust photo and add notes</h2></div>
          <button type="button" className="flex size-10 items-center justify-center" onClick={onClose} aria-label="Close print request"><X className="size-5" /></button>
        </header>

        {orderNumber ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#eaf8f4] text-[#159d8b]"><CheckCircle2 className="size-8" /></span>
            <h3 className="mt-5 text-2xl font-semibold">Request sent</h3>
            <p className="mt-3 text-sm text-[#666]">No payment charged. Photographer received photo, adjustment, and notes.</p>
            {orderNumber !== "submitted" && <p className="mt-4 border bg-[#fafafa] px-4 py-2 text-xs text-[#666]">Request {orderNumber}</p>}
            <button type="button" className="mt-7 h-11 bg-[#303030] px-7 text-sm font-semibold text-white" onClick={onClose}>Back to gallery</button>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_390px]">
            <div className="flex min-h-[340px] items-center justify-center bg-[#ececea] p-5 md:p-8">
              <CropCanvas crop={crop} imageUrl={image.url} alt={image.originalName || "Selected photo"} onChange={setCrop} />
            </div>
            <div className="p-5 sm:p-7 md:p-8">
              <p className="text-sm leading-6 text-[#666]">Drag photo, zoom, or rotate. This adjustment is saved with request.</p>
              <Slider label="Horizontal" min={-100} max={100} step={1} value={crop.x} onChange={(x) => setCrop((value) => ({ ...value, x }))} />
              <Slider label="Vertical" min={-100} max={100} step={1} value={crop.y} onChange={(y) => setCrop((value) => ({ ...value, y }))} />
              <Slider label="Zoom" min={0.2} max={4} step={0.05} value={crop.zoom} onChange={(zoom) => setCrop((value) => ({ ...value, zoom }))} />
              <div className="mt-5 flex gap-2">
                <button type="button" className="flex h-10 flex-1 items-center justify-center gap-2 border text-sm" onClick={() => setCrop((value) => ({ ...value, rotation: value.rotation - 90 }))}><RotateCcw className="size-4" /> Left</button>
                <button type="button" className="flex h-10 flex-1 items-center justify-center gap-2 border text-sm" onClick={() => setCrop((value) => ({ ...value, rotation: value.rotation + 90 }))}><RotateCw className="size-4" /> Right</button>
              </div>
              <input className="mt-7 h-11 w-full border px-3 text-sm" placeholder="Your name" value={customer.name} onChange={(event) => setCustomer((value) => ({ ...value, name: event.target.value }))} />
              <input className="mt-3 h-11 w-full border px-3 text-sm" type="email" placeholder="Email address" value={customer.email} onChange={(event) => setCustomer((value) => ({ ...value, email: event.target.value }))} />
              <textarea className="mt-3 min-h-24 w-full resize-y border p-3 text-sm" placeholder="Notes for photographer" value={note} onChange={(event) => setNote(event.target.value)} />
              {error && <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button type="button" className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[#159d8b] text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void submit()}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Sending request..." : "Request print for free"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return <label className="mt-5 block"><span className="flex justify-between text-xs font-medium"><span>{label}</span><span className="text-[#777]">{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span><input className="mt-2 w-full accent-[#159d8b]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

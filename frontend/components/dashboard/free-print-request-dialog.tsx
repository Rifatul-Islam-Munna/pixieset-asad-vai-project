"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus, X } from "lucide-react";
import { publicImageSrc, type PublicStoreImage } from "@/lib/public-store";

const DEFAULT_SIZES = ["4 x 6", "5 x 7", "8 x 10", "8 x 12"];
const DEFAULT_PAPERS = ["Glossy", "Matte"];

export function FreePrintRequestDialog({
  image,
  identifier,
  siteSlug,
  sizes,
  papers,
  onClose,
}: {
  image: PublicStoreImage;
  identifier: string;
  siteSlug: string;
  sizes?: string[];
  papers?: string[];
  onClose: () => void;
}) {
  const sizeOptions = useMemo(
    () => (sizes?.map((value) => value.trim()).filter(Boolean).length ? sizes.map((value) => value.trim()).filter(Boolean) : DEFAULT_SIZES),
    [sizes],
  );
  const paperOptions = useMemo(
    () => (papers?.map((value) => value.trim()).filter(Boolean).length ? papers.map((value) => value.trim()).filter(Boolean) : DEFAULT_PAPERS),
    [papers],
  );
  const [size, setSize] = useState(sizeOptions[0] ?? "");
  const [paper, setPaper] = useState(paperOptions[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  const submit = async () => {
    if (!customer.name.trim() || !customer.email.includes("@")) {
      setError("Enter your name and a valid email address.");
      return;
    }
    if (!size || !paper) {
      setError("Choose a print size and paper type.");
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
          items: [{ imageId: image._id, imageUrl: image.url, size, paper, quantity }],
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
      <div className="mx-auto flex h-full max-h-[900px] w-full max-w-[1000px] flex-col overflow-hidden bg-white shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-5 md:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#159d8b]">Free print request</p>
            <h2 className="mt-1 text-base font-medium">Choose size, paper, and quantity</h2>
          </div>
          <button type="button" className="flex size-10 items-center justify-center" onClick={onClose} aria-label="Close print request"><X className="size-5" /></button>
        </header>

        {orderNumber ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#eaf8f4] text-[#159d8b]"><CheckCircle2 className="size-8" /></span>
            <h3 className="mt-5 text-2xl font-semibold">Request sent</h3>
            <p className="mt-3 text-sm text-[#666]">No payment charged. Photographer received the photo, size, paper, quantity, and notes.</p>
            {orderNumber !== "submitted" && <p className="mt-4 border bg-[#fafafa] px-4 py-2 text-xs text-[#666]">Request {orderNumber}</p>}
            <button type="button" className="mt-7 h-11 bg-[#303030] px-7 text-sm font-semibold text-white" onClick={onClose}>Back to gallery</button>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_390px]">
            <div className="flex min-h-[340px] items-center justify-center bg-[#ececea] p-5 md:p-8">
              <img src={publicImageSrc(image.url)} alt={image.originalName || "Selected photo"} className="max-h-[620px] max-w-full object-contain shadow-lg" />
            </div>
            <div className="p-5 sm:p-7 md:p-8">
              <p className="text-sm leading-6 text-[#666]">Choose how you want this free print prepared. These options are set by the photographer.</p>

              <label className="mt-6 block text-sm font-semibold">Size
                <select value={size} onChange={(event) => setSize(event.target.value)} className="mt-2 h-12 w-full border bg-white px-3 text-sm outline-none focus:border-[#159d8b]">
                  {sizeOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>

              <label className="mt-4 block text-sm font-semibold">Paper
                <select value={paper} onChange={(event) => setPaper(event.target.value)} className="mt-2 h-12 w-full border bg-white px-3 text-sm outline-none focus:border-[#159d8b]">
                  {paperOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>

              <div className="mt-4">
                <p className="text-sm font-semibold">Quantity</p>
                <div className="mt-2 flex h-12 items-center border bg-white">
                  <button type="button" className="flex h-full w-12 items-center justify-center border-r disabled:opacity-40" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity"><Minus className="size-4" /></button>
                  <input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.min(100, Math.max(1, Math.floor(Number(event.target.value) || 1))))} className="h-full min-w-0 flex-1 text-center text-sm outline-none" aria-label="Print quantity" />
                  <button type="button" className="flex h-full w-12 items-center justify-center border-l disabled:opacity-40" disabled={quantity >= 100} onClick={() => setQuantity((value) => Math.min(100, value + 1))} aria-label="Increase quantity"><Plus className="size-4" /></button>
                </div>
              </div>

              <div className="mt-5 border bg-[#fafafa] px-4 py-3 text-sm text-[#555]">
                <span className="font-semibold">Your request:</span> {quantity} × {size} · {paper}
              </div>
              <input className="mt-5 h-11 w-full border px-3 text-sm" placeholder="Your name" value={customer.name} onChange={(event) => setCustomer((value) => ({ ...value, name: event.target.value }))} />
              <input className="mt-3 h-11 w-full border px-3 text-sm" type="email" placeholder="Email address" value={customer.email} onChange={(event) => setCustomer((value) => ({ ...value, email: event.target.value }))} />
              <textarea className="mt-3 min-h-24 w-full resize-y border p-3 text-sm" placeholder="Notes for photographer" value={note} onChange={(event) => setNote(event.target.value)} />
              {error && <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button type="button" className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[#159d8b] text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void submit()}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? "Sending request..." : "Request print for free"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

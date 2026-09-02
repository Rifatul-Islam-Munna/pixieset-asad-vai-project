"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus, Trash2, X } from "lucide-react";
import { publicImageSrc, type PublicStoreImage } from "@/lib/public-store";

const DEFAULT_SIZES = ["4 x 6", "5 x 7", "8 x 10", "8 x 12"];
const DEFAULT_PAPERS = ["Glossy", "Matte"];
type SizeRow = { id: number; size: string; paper: string; quantity: number };

export function FreePrintRequestDialog({ image, identifier, siteSlug, sizes, papers, onClose }: { image: PublicStoreImage; identifier: string; siteSlug: string; sizes?: string[]; papers?: string[]; onClose: () => void }) {
  const sizeOptions = useMemo(() => sizes?.map((v) => v.trim()).filter(Boolean).length ? sizes.map((v) => v.trim()).filter(Boolean) : DEFAULT_SIZES, [sizes]);
  const paperOptions = useMemo(() => papers?.map((v) => v.trim()).filter(Boolean).length ? papers.map((v) => v.trim()).filter(Boolean) : DEFAULT_PAPERS, [papers]);
  const [rows, setRows] = useState<SizeRow[]>([{ id: 1, size: sizeOptions[0] ?? "", paper: paperOptions[0] ?? "", quantity: 1 }]);
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const usedSizes = new Set(rows.map((row) => row.size));
  const canAddSize = sizeOptions.some((size) => !usedSizes.has(size));
  const patchRow = (id: number, patch: Partial<SizeRow>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  const addRow = () => { const size = sizeOptions.find((value) => !usedSizes.has(value)); if (size) setRows((current) => [...current, { id: Date.now(), size, paper: paperOptions[0] ?? "", quantity: 1 }]); };
  const openSizePicker = (container: HTMLDivElement) => {
    const select = container.querySelector<HTMLSelectElement>('select[data-size-select="true"]');
    if (!select) return;
    try {
      if (typeof select.showPicker === "function") select.showPicker();
      else { select.focus(); select.click(); }
    } catch {
      select.focus();
    }
  };

  const submit = async () => {
    if (!customer.name.trim() || !customer.email.includes("@")) return setError("Enter your name and a valid email address.");
    if (!rows.length || rows.some((row) => !row.size || !row.paper)) return setError("Choose a size and paper type for every print row.");
    setBusy(true); setError("");
    const response = await fetch(`/api/public-print-store/${encodeURIComponent(identifier)}/checkout?siteSlug=${encodeURIComponent(siteSlug)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ printRequest: true, checkoutSource: "print-request", customer, note: note.trim(), items: rows.map((row) => ({ imageId: image._id, imageUrl: image.url, size: row.size, paper: row.paper, quantity: row.quantity })) }) }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    if (!response?.ok || !payload?.data?.completed) { setError(payload?.message ?? "Print request could not be submitted."); setBusy(false); return; }
    setOrderNumber(String(payload.data.order?.orderNumber ?? "submitted")); setBusy(false);
  };

  return <div className="fixed inset-0 z-[130] bg-black/65 p-0 md:p-5" role="dialog" aria-modal="true" aria-label="Free print request"><div className="mx-auto flex h-full max-h-[900px] w-full max-w-[1000px] flex-col overflow-hidden bg-white shadow-2xl">
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-5 md:px-8"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#159d8b]">Free print request</p><h2 className="mt-1 text-base font-medium">Choose sizes, paper, and quantity for each size</h2></div><button type="button" className="flex size-10 items-center justify-center" onClick={onClose} aria-label="Close print request"><X className="size-5" /></button></header>
    {orderNumber ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><span className="flex size-16 items-center justify-center rounded-full bg-[#eaf8f4] text-[#159d8b]"><CheckCircle2 className="size-8" /></span><h3 className="mt-5 text-2xl font-semibold">Request sent</h3><p className="mt-3 text-sm text-[#666]">No payment charged. The photographer received every requested size, paper type, and quantity.</p>{orderNumber !== "submitted" && <p className="mt-4 border bg-[#fafafa] px-4 py-2 text-xs text-[#666]">Request {orderNumber}</p>}<button type="button" className="mt-7 h-11 bg-[#303030] px-7 text-sm font-semibold text-white" onClick={onClose}>Back to gallery</button></div> :
    <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_390px]"><div className="flex min-h-[340px] items-center justify-center bg-[#ececea] p-5 md:p-8"><img src={publicImageSrc(image.url)} alt={image.originalName || "Selected photo"} className="max-h-[620px] max-w-full object-contain shadow-lg" /></div><div className="p-5 sm:p-7 md:p-8">
      <p className="text-sm leading-6 text-[#666]">Add one or more print sizes. Every size has its own paper type and quantity.</p>
      <div className="mt-6">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold">Print sizes</p><button type="button" disabled={!canAddSize} onClick={addRow} className="text-xs font-semibold text-[#159d8b] disabled:opacity-40">+ Add size</button></div>
        <div className="mt-2 grid gap-3">{rows.map((row) => <div key={row.id} className="cursor-pointer border p-3 transition hover:border-[#159d8b]/60 hover:bg-[#fbfffe]" onClick={(event) => { const target = event.target as HTMLElement; if (target.closest("button,input,select,textarea,label")) return; openSizePicker(event.currentTarget); }}>
          <div className="flex gap-2"><select data-size-select="true" value={row.size} onChange={(e) => patchRow(row.id, { size: e.target.value })} className="h-11 min-w-0 flex-1 cursor-pointer border bg-white px-3 text-sm">{sizeOptions.map((value) => <option key={value} value={value} disabled={value !== row.size && usedSizes.has(value)}>{value}</option>)}</select>{rows.length > 1 && <button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="flex size-11 items-center justify-center border text-[#777]" aria-label="Remove size"><Trash2 className="size-4" /></button>}</div>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.12em] text-[#777]">Paper<select value={row.paper} onChange={(e) => patchRow(row.id, { paper: e.target.value })} className="mt-2 h-11 w-full cursor-pointer border bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#222]">{paperOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <div className="mt-3 flex h-11 items-center border"><button type="button" className="flex size-11 items-center justify-center border-r" onClick={() => patchRow(row.id, { quantity: Math.max(1, row.quantity - 1) })}><Minus className="size-4" /></button><input type="number" min={1} max={100} value={row.quantity} onChange={(e) => patchRow(row.id, { quantity: Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 1))) })} className="h-full min-w-0 flex-1 text-center text-sm outline-none" /><button type="button" className="flex size-11 items-center justify-center border-l" onClick={() => patchRow(row.id, { quantity: Math.min(100, row.quantity + 1) })}><Plus className="size-4" /></button></div>
        </div>)}</div>
      </div>
      <div className="mt-5 border bg-[#fafafa] px-4 py-3 text-sm text-[#555]"><span className="font-semibold">Your request:</span> {rows.map((row) => `${row.quantity} x ${row.size} (${row.paper})`).join(" + ")}</div>
      <input className="mt-5 h-11 w-full border px-3 text-sm" placeholder="Your name" value={customer.name} onChange={(e) => setCustomer((v) => ({ ...v, name: e.target.value }))} /><input className="mt-3 h-11 w-full border px-3 text-sm" type="email" placeholder="Email address" value={customer.email} onChange={(e) => setCustomer((v) => ({ ...v, email: e.target.value }))} /><textarea className="mt-3 min-h-24 w-full resize-y border p-3 text-sm" placeholder="Notes for photographer" value={note} onChange={(e) => setNote(e.target.value)} />{error && <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<button type="button" className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[#159d8b] text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void submit()}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Sending request..." : "Request prints for free"}</button>
    </div></div>}
  </div></div>;
}

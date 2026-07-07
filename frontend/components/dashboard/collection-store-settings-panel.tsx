"use client";

import { Loader2, Save } from "lucide-react";

export type StoreSettingsForm = {
  enabled: boolean;
  priceSheetId: string;
  showPrintStoreNav: boolean;
  showBuyPhotoButton: boolean;
  allowBulkBuy: boolean;
  minimumOrderAmount: string;
  currency: string;
  requireProfessionalInfo: boolean;
};

export type StoreSheetSummary = {
  _id: string;
  name: string;
  productCount?: number;
  collectionIds?: string[];
};

export function CollectionStoreSettingsPanel({ form, busy, priceSheets, onChange, onSave }: {
  form: StoreSettingsForm;
  busy: boolean;
  priceSheets?: StoreSheetSummary[];
  onChange: (patch: Partial<StoreSettingsForm>) => void;
  onSave: () => void;
}) {
  const sheets = priceSheets ?? [];
  return (
    <section className="mt-6 max-w-[760px] border bg-white p-6 md:p-8">
      <h2 className="text-xl font-medium">Collection storefront</h2>
      <p className="mt-2 text-sm leading-6 text-[#666]">
        Enable the store for this collection. Prints, wall art, sizes and default prices are prepared automatically.
      </p>
      <div className="mt-7 grid gap-5">
        <label className="flex cursor-pointer items-center justify-between gap-5 border px-5 py-5">
          <span>
            <span className="block text-base font-medium">Enable store</span>
            <span className="mt-1 block text-xs leading-5 text-[#777]">
              Adds Print Store to the gallery and Buy This Photo to the image viewer.
            </span>
          </span>
          <input type="checkbox" checked={form.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} className="size-4" />
        </label>
        <label className="block text-sm font-medium">
          Active pricing sheet
          <select
            value={form.priceSheetId}
            onChange={(event) => onChange({ priceSheetId: event.target.value })}
            className="mt-2 h-12 w-full border bg-white px-4 text-sm outline-none focus:border-[#555]"
          >
            <option value="">Global Print & Wall Art</option>
            {sheets.map((sheet) => (
              <option key={sheet._id} value={sheet._id}>
                {sheet.name} ({sheet.productCount ?? 0} products)
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs font-normal text-[#777]">
            Choose which sheet this collection sells from.
          </span>
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-5 border px-5 py-5">
          <span>
            <span className="block text-base font-medium">Show Print Store nav</span>
            <span className="mt-1 block text-xs leading-5 text-[#777]">
              Shows the middle Print Store dropdown in the public gallery.
            </span>
          </span>
          <input type="checkbox" checked={form.showPrintStoreNav} onChange={(event) => onChange({ showPrintStoreNav: event.target.checked })} className="size-4" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-5 border px-5 py-5">
          <span>
            <span className="block text-base font-medium">Buy this photo</span>
            <span className="mt-1 block text-xs leading-5 text-[#777]">
              Shows purchase action inside photo preview.
            </span>
          </span>
          <input type="checkbox" checked={form.showBuyPhotoButton} onChange={(event) => onChange({ showBuyPhotoButton: event.target.checked })} className="size-4" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-5 border px-5 py-5">
          <span>
            <span className="block text-base font-medium">Bulk purchase</span>
            <span className="mt-1 block text-xs leading-5 text-[#777]">
              Lets visitors select multiple photos for eligible products.
            </span>
          </span>
          <input type="checkbox" checked={form.allowBulkBuy} onChange={(event) => onChange({ allowBulkBuy: event.target.checked })} className="size-4" />
        </label>
        <label className="block text-sm font-medium">
          Minimum order
          <input type="number" min="0" step="0.01" value={form.minimumOrderAmount} onChange={(event) => onChange({ minimumOrderAmount: event.target.value })} className="mt-2 h-12 w-full border px-4 text-sm outline-none focus:border-[#555]" placeholder="0" />
          <span className="mt-2 block text-xs font-normal text-[#777]">Leave this at 0 when there is no minimum order amount.</span>
        </label>
      </div>
      <p className="mt-6 border-t pt-5 text-xs leading-5 text-[#777]">
        The full reference catalog is automatic. Products and prices remain editable below and from the full products page.
      </p>
      <button className="mt-6 inline-flex h-11 items-center gap-2 bg-[#303030] px-6 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={onSave}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings
      </button>
    </section>
  );
}

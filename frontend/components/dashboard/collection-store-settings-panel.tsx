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

export function CollectionStoreSettingsPanel(props: {
  form: StoreSettingsForm;
  sheets: StoreSheetSummary[];
  busy: boolean;
  onChange: (patch: Partial<StoreSettingsForm>) => void;
  onSave: () => void;
  onCreateCatalog: () => void;
  onAddDefaults: () => void;
}) {
  return (
    <section className="mt-6 max-w-[760px] border bg-white p-6 md:p-8">
      <h2 className="text-xl font-medium">Collection storefront</h2>
      <p className="mt-2 text-sm leading-6 text-[#666]">
        Turn the store on for this collection. The product catalog is created and connected automatically.
      </p>

      <div className="mt-7 grid gap-4">
        <label className="flex cursor-pointer items-center justify-between gap-5 border px-5 py-5 text-sm font-medium">
          <span>
            <span className="block text-base">Enable store</span>
            <span className="mt-1 block text-xs font-normal text-[#777]">
              Show Print Store navigation and Buy Photo inside the image viewer.
            </span>
          </span>
          <input
            type="checkbox"
            checked={props.form.enabled}
            onChange={(event) => props.onChange({ enabled: event.target.checked })}
            className="size-4"
          />
        </label>

        <label className="text-sm font-medium">
          Minimum order
          <input
            type="number"
            min="0"
            step="0.01"
            value={props.form.minimumOrderAmount}
            onChange={(event) => props.onChange({ minimumOrderAmount: event.target.value })}
            className="mt-2 h-12 w-full border px-4 text-sm outline-none focus:border-[#555]"
            placeholder="0"
          />
          <span className="mt-2 block text-xs font-normal text-[#777]">
            Leave this at 0 when there is no minimum order amount.
          </span>
        </label>
      </div>

      <button
        className="mt-7 inline-flex h-11 items-center gap-2 bg-[#303030] px-6 text-sm font-semibold text-white disabled:opacity-50"
        disabled={props.busy}
        onClick={props.onSave}
      >
        {props.busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save settings
      </button>
    </section>
  );
}

"use client";

import { Loader2, Printer, Save } from "lucide-react";
import { useHomepageSettings } from "@/api-hooks/use-homepage";
import { usePlanFeatureAccess } from "@/api-hooks/use-plan-capabilities";

export type StoreSettingsForm = {
  enabled: boolean;
  printRequestsEnabled: boolean;
  printLabEmail: string;
  notifyPrintLabForFreeRequests: boolean;
  notifyPrintLabForPaidOrders: boolean;
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
  onSave: (patch?: Partial<StoreSettingsForm>) => void;
}) {
  const sheets = priceSheets ?? [];
  const multiStore = usePlanFeatureAccess("multipleGalleryStores");
  const homepage = useHomepageSettings().query.data?.data;
  const siteName = homepage?.brandName?.trim() || homepage?.slug?.trim() || "your website";
  return (
    <section className="mt-6 max-w-[760px] bg-white p-4 sm:p-6 md:p-8">
      <h2 className="text-2xl font-medium">Store Settings</h2>
      {multiStore.locked && (
        <div className="mt-5 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your plan supports one active gallery store. Multiple Gallery Stores requires an upgrade. The backend will block activating a second store.
        </div>
      )}
      <div className="mt-8 bg-[#eef7f9] p-6">
        <p className="font-bold">Activate Store</p>
        <p className="mt-4 text-sm leading-7 text-[#222]">
          Set up {siteName} Store to sell prints, digital downloads, and more from this collection.
        </p>
      </div>
      <div className="mt-12 grid gap-10">
        <label className="grid cursor-pointer gap-3">
          <span className="block text-sm font-bold">Store Status</span>
          <span className="flex items-center gap-3">
            <input type="checkbox" checked={form.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} className="size-5 accent-[#22bda7]" />
            <span>{form.enabled ? "On" : "Off"}</span>
          </span>
          <span className="block text-sm leading-6 text-[#666]">
            Allow visitors to purchase products for photos from this collection.
          </span>
        </label>
        <label className="grid cursor-pointer gap-3 border border-[#d9eee9] bg-[#f4fbf9] p-5">
          <span className="flex items-center gap-2 text-sm font-bold"><Printer className="size-4 text-[#159d8b]" /> Free Print Requests</span>
          <span className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.printRequestsEnabled}
              onChange={(event) => {
                const printRequestsEnabled = event.target.checked;
                onChange({ printRequestsEnabled });
                onSave({ printRequestsEnabled });
              }}
              className="size-5 accent-[#22bda7]"
            />
            <span>{form.printRequestsEnabled ? "On" : "Off"}</span>
          </span>
          <span className="block text-sm leading-6 text-[#56635f]">
            Adds a Print Request button to each photo. Visitors choose print size, paper, quantity, and send a free request with notes. Store products and prices stay unchanged.
          </span>
        </label>
        <div className="grid gap-4 border border-[#d9eee9] bg-[#f4fbf9] p-5">
          <div>
            <p className="font-bold">Print-company notifications</p>
            <p className="mt-2 text-sm leading-6 text-[#56635f]">
              Send print requests and paid order notifications to your print company.
            </p>
          </div>
          <label className="block text-sm font-medium">
            <span className="font-bold">Print-company email</span>
            <input
              type="email"
              value={form.printLabEmail}
              onChange={(event) => onChange({ printLabEmail: event.target.value })}
              className="mt-3 h-12 w-full border bg-white px-4 text-sm outline-none focus:border-[#555]"
              placeholder="orders@example.com"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.notifyPrintLabForFreeRequests}
              onChange={(event) => onChange({ notifyPrintLabForFreeRequests: event.target.checked })}
              className="size-5 accent-[#22bda7]"
            />
            <span>Notify for free print requests</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.notifyPrintLabForPaidOrders}
              onChange={(event) => onChange({ notifyPrintLabForPaidOrders: event.target.checked })}
              className="size-5 accent-[#22bda7]"
            />
            <span>Notify for paid orders</span>
          </label>
        </div>
        <label className="block text-sm font-medium">
          <span className="font-bold">Price Sheet</span>
          <select
            value={form.priceSheetId}
            onChange={(event) => onChange({ priceSheetId: event.target.value })}
            className="mt-3 h-12 w-full border bg-white px-4 text-sm outline-none focus:border-[#555]"
          >
            <option value="">My Price Sheet</option>
            {sheets.map((sheet) => (
              <option key={sheet._id} value={sheet._id}>
                {sheet.name}
              </option>
            ))}
          </select>
          <span className="mt-3 block text-sm font-normal text-[#666]">
            Set which products are for sale in this collection.
          </span>
        </label>
        <label className="grid cursor-pointer gap-3">
          <span className="block text-sm font-bold">Show Print Store Nav</span>
          <span className="flex items-center gap-3">
            <input type="checkbox" checked={form.showPrintStoreNav} onChange={(event) => onChange({ showPrintStoreNav: event.target.checked })} className="size-5 accent-[#22bda7]" />
            <span>{form.showPrintStoreNav ? "On" : "Off"}</span>
          </span>
        </label>
        <label className="grid cursor-pointer gap-3">
          <span className="block text-sm font-bold">Buy This Photo</span>
          <span className="flex items-center gap-3">
            <input type="checkbox" checked={form.showBuyPhotoButton} onChange={(event) => onChange({ showBuyPhotoButton: event.target.checked })} className="size-5 accent-[#22bda7]" />
            <span>{form.showBuyPhotoButton ? "On" : "Off"}</span>
          </span>
        </label>
        <label className="grid cursor-pointer gap-3">
          <span className="block text-sm font-bold">Personalized Product Preview</span>
          <span className="flex items-center gap-3">
            <input type="checkbox" checked={form.allowBulkBuy} onChange={(event) => onChange({ allowBulkBuy: event.target.checked })} className="size-5 accent-[#22bda7]" />
            <span>{form.allowBulkBuy ? "On" : "Off"}</span>
          </span>
        </label>
        <label className="block text-sm font-medium">
          <span className="font-bold">Minimum Order</span>
          <input type="number" min="0" step="0.01" value={form.minimumOrderAmount} onChange={(event) => onChange({ minimumOrderAmount: event.target.value })} className="mt-3 h-12 w-full border px-4 text-sm outline-none focus:border-[#555]" placeholder="0" />
          <span className="mt-3 block text-sm font-normal text-[#666]">Leave at 0 when there is no minimum order amount.</span>
        </label>
      </div>
      <button className="mt-8 inline-flex h-11 items-center gap-2 bg-[#22bda7] px-6 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => onSave()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings
      </button>
    </section>
  );
}

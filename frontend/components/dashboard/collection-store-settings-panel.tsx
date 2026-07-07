"use client";

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
  const { form, sheets } = props;
  return <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
    <section className="border bg-white p-6">
      <h2 className="text-xl font-medium">Collection storefront</h2>
      <label className="mt-5 block text-sm">Price sheet
        <select className="mt-2 h-11 w-full border bg-white px-3" value={form.priceSheetId} onChange={event => props.onChange({ priceSheetId: event.target.value })}>
          <option value="">Choose a price sheet</option>
          {sheets.map(sheet => <option key={sheet._id} value={sheet._id}>{sheet.name} ({sheet.productCount ?? 0})</option>)}
        </select>
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Currency" value={form.currency} onChange={currency => props.onChange({ currency: currency.toUpperCase() })} />
        <Input label="Minimum order" value={form.minimumOrderAmount} onChange={minimumOrderAmount => props.onChange({ minimumOrderAmount })} type="number" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Toggle label="Enable store" checked={form.enabled} onChange={enabled => props.onChange({ enabled })} />
        <Toggle label="Show Print Store navigation" checked={form.showPrintStoreNav} onChange={showPrintStoreNav => props.onChange({ showPrintStoreNav })} />
        <Toggle label="Show Buy Photo" checked={form.showBuyPhotoButton} onChange={showBuyPhotoButton => props.onChange({ showBuyPhotoButton })} />
        <Toggle label="Allow bulk selection" checked={form.allowBulkBuy} onChange={allowBulkBuy => props.onChange({ allowBulkBuy })} />
        <Toggle label="Require professional info" checked={form.requireProfessionalInfo} onChange={requireProfessionalInfo => props.onChange({ requireProfessionalInfo })} />
      </div>
      <button className="mt-6 h-11 bg-[#303030] px-6 text-sm font-semibold text-white disabled:opacity-50" disabled={props.busy} onClick={props.onSave}>Save settings</button>
    </section>
    <aside className="border bg-white p-6">
      <h2 className="text-lg font-medium">Catalog setup</h2>
      <p className="mt-2 text-sm leading-6 text-[#666]">Create a price sheet and add the default products.</p>
      <button className="mt-5 h-11 w-full border text-sm" disabled={props.busy} onClick={props.onCreateCatalog}>Create default price sheet</button>
      <button className="mt-3 h-11 w-full bg-[#303030] text-sm text-white disabled:opacity-50" disabled={props.busy || !form.priceSheetId} onClick={props.onAddDefaults}>Add default products</button>
    </aside>
  </div>;
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-sm">{label}<input className="mt-2 h-11 w-full border px-3" type={type} value={value} onChange={event => onChange(event.target.value)} /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between border px-4 py-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}

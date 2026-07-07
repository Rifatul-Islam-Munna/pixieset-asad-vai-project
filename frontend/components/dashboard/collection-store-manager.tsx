"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Settings, Store } from "lucide-react";
import { useCollectionStoreAdmin } from "@/api-hooks/use-collection-store-admin";
import { CollectionStoreSettingsPanel } from "./collection-store-settings-panel";
import { StoreProductAdminCard } from "./store-product-admin-card";

export function CollectionStoreManager({ collectionId }: { collectionId: string }) {
  const admin = useCollectionStoreAdmin(collectionId);
  const [tab, setTab] = useState<"settings" | "products">("settings");

  if (admin.collectionLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="size-7 animate-spin" /></div>;
  }
  if (!admin.collection) return <div className="p-8">Collection not found.</div>;

  const publicHref = `/collection/${encodeURIComponent(admin.collection.name)}/${encodeURIComponent(admin.collection.slug || admin.collection._id)}/store`;
  const products = admin.sheet?.products ?? [];

  return <div className="min-h-screen bg-[#f6f6f4] px-4 py-6 text-[#202020] md:px-8">
    <div className="mx-auto max-w-[1280px]">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#d9d9d5] pb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#777]">Collection Store</p>
          <h1 className="mt-2 text-3xl">{admin.collection.name}</h1>
          <p className="mt-2 text-sm text-[#666]">Control this collection's storefront, products and default preview images.</p>
        </div>
        <Link href={publicHref} target="_blank" className="inline-flex h-11 items-center gap-2 border bg-white px-5 text-sm">
          View public store <ExternalLink className="size-4" />
        </Link>
      </header>

      <div className="mt-6 flex gap-2">
        <Tab active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings className="size-4" />} label="Settings" />
        <Tab active={tab === "products"} onClick={() => setTab("products")} icon={<Store className="size-4" />} label={`Products (${products.length})`} />
      </div>

      {tab === "settings" && <CollectionStoreSettingsPanel
        form={admin.form}
        sheets={admin.sheets}
        busy={admin.busy}
        onChange={patch => admin.setForm(value => ({ ...value, ...patch }))}
        onSave={admin.saveSettings}
        onCreateCatalog={admin.createCatalog}
        onAddDefaults={admin.addDefaults}
      />}

      {tab === "products" && <section className="mt-6 grid gap-4">
        {!admin.form.priceSheetId && <div className="border bg-white p-8 text-center text-sm text-[#666]">Choose a price sheet in Settings.</div>}
        {admin.sheetLoading && <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>}
        {products.map(product => <StoreProductAdminCard
          key={product._id}
          product={product}
          saving={admin.busy}
          onSave={patch => admin.saveProduct(product._id, patch)}
          onDelete={() => {
            if (!window.confirm("Remove this product from the price sheet?")) return Promise.resolve();
            return admin.removeProduct(product._id);
          }}
        />)}
        {admin.form.priceSheetId && !admin.sheetLoading && !products.length && <div className="border bg-white p-8 text-center text-sm text-[#666]">No products yet. Add the default catalog from Settings.</div>}
      </section>}
    </div>
  </div>;
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button className={`inline-flex h-11 items-center gap-2 border px-5 text-sm ${active ? "bg-[#303030] text-white" : "bg-white"}`} onClick={onClick}>{icon}{label}</button>;
}

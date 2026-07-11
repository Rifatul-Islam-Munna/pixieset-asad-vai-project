"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCollectionStoreAdmin } from "@/api-hooks/use-collection-store-admin";
import { useStorePriceSheets } from "@/api-hooks/use-store";
import { CollectionStoreSettingsPanel } from "./collection-store-settings-panel";

export function CollectionStoreManager({ collectionId }: { collectionId: string }) {
  const admin = useCollectionStoreAdmin(collectionId);
  const { priceSheetsQuery } = useStorePriceSheets();
  const preparing = useRef(false);

  useEffect(() => {
    if (
      admin.collectionLoading ||
      admin.form.priceSheetId ||
      admin.busy ||
      preparing.current
    ) return;
    preparing.current = true;
    void admin.createCatalog().finally(() => {
      preparing.current = false;
    });
  }, [admin.busy, admin.collectionLoading, admin.form.priceSheetId, admin.createCatalog]);

  if (admin.collectionLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin" />
      </div>
    );
  }
  if (!admin.collection) return <div className="p-8">Collection not found.</div>;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f6f4] px-3 py-6 text-[#202020] sm:px-4 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#d9d9d5] pb-6">
          <div className="min-w-0">
            <Link
              href={`/dashboard/store-gallery/collections/${collectionId}`}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#666] hover:text-[#222]"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#777]">Collection Store</p>
            <h1 className="mt-2 break-words text-2xl sm:text-3xl">{admin.collection.name}</h1>
            <p className="mt-2 text-sm text-[#666]">
              Configure product sales for this collection.
            </p>
          </div>
        </header>

        <CollectionStoreSettingsPanel
          form={admin.form}
          busy={admin.busy}
          priceSheets={priceSheetsQuery.data?.data ?? []}
          onChange={(patch) => admin.setForm((value) => ({ ...value, ...patch }))}
          onSave={admin.saveSettings}
        />
      </div>
    </div>
  );
}

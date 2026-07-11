"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, Loader2, Settings } from "lucide-react";
import { useCollectionStoreAdmin } from "@/api-hooks/use-collection-store-admin";
import { useStorePriceSheets } from "@/api-hooks/use-store";
import { CollectionStoreSettingsPanel } from "./collection-store-settings-panel";
import { StoreActivityList } from "./store-activity-list";

export function CollectionStoreManager({ collectionId }: { collectionId: string }) {
  const admin = useCollectionStoreAdmin(collectionId);
  const { priceSheetsQuery } = useStorePriceSheets();
  const [tab, setTab] = useState<"settings" | "activity">("settings");
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
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#777]">Collection Store</p>
            <h1 className="mt-2 break-words text-2xl sm:text-3xl">{admin.collection.name}</h1>
            <p className="mt-2 text-sm text-[#666]">
              Enable collection store and activity. Product pricing is managed in Store Gallery Pricing.
            </p>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-2">
          <Tab
            active={tab === "settings"}
            onClick={() => setTab("settings")}
            icon={<Settings className="size-4" />}
            label="Settings"
          />
          <Tab
            active={tab === "activity"}
            onClick={() => setTab("activity")}
            icon={<Activity className="size-4" />}
            label="Activity"
          />
        </div>

        {tab === "settings" && (
          <CollectionStoreSettingsPanel
            form={admin.form}
            busy={admin.busy}
            priceSheets={priceSheetsQuery.data?.data ?? []}
            onChange={(patch) => admin.setForm((value) => ({ ...value, ...patch }))}
            onSave={admin.saveSettings}
          />
        )}

        {tab === "activity" && (
          <StoreActivityList collectionId={collectionId} currency={admin.form.currency} />
        )}
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      className={`inline-flex h-11 items-center gap-2 border px-5 text-sm ${
        active ? "bg-[#303030] text-white" : "bg-white"
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

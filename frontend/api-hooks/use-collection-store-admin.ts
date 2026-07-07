"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCollectionDetail } from "./use-collections";
import {
  addCollectionStoreProduct,
  editCollectionStoreProduct,
  ensureCollectionStoreCatalog,
  getCollectionStoreCatalog,
  hideCollectionStoreProduct,
} from "./collection-store-api";
import type { StoreSettingsForm } from "@/components/dashboard/collection-store-settings-panel";

const defaults: StoreSettingsForm = {
  enabled: false,
  priceSheetId: "",
  showPrintStoreNav: true,
  showBuyPhotoButton: true,
  allowBulkBuy: true,
  minimumOrderAmount: "0",
  currency: "EUR",
  requireProfessionalInfo: false,
};

export function useCollectionStoreAdmin(collectionId: string) {
  const client = useQueryClient();
  const { collectionQuery, updateCollection } = useCollectionDetail(collectionId);
  const collection = collectionQuery.data?.data;
  const [form, setForm] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const catalogQuery = useQuery({
    enabled: Boolean(collectionId),
    queryKey: ["collection-store-catalog", collectionId],
    queryFn: () => getCollectionStoreCatalog(collectionId),
    retry: 1,
  });

  useEffect(() => {
    if (!collection || loaded) return;
    const store = collection.settings?.store ?? {};
    setForm({
      ...defaults,
      enabled: Boolean(store.enabled ?? store.storeStatus),
      priceSheetId: store.priceSheetId ?? "",
      showPrintStoreNav: store.showPrintStoreNav ?? defaults.showPrintStoreNav,
      showBuyPhotoButton: store.showBuyPhotoButton ?? defaults.showBuyPhotoButton,
      allowBulkBuy: store.allowBulkBuy ?? defaults.allowBulkBuy,
      minimumOrderAmount: String(store.minimumOrderAmount ?? 0),
      currency: String(store.currency ?? "EUR").toUpperCase(),
      requireProfessionalInfo: Boolean(store.requireProfessionalInfo),
    });
    setLoaded(true);
  }, [collection, loaded]);

  const refresh = () => client.invalidateQueries({
    queryKey: ["collection-store-catalog", collectionId],
  });

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      const result = await action();
      await refresh();
      toast.success(message);
      return result;
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!collection) return;
    try {
      const catalog = form.priceSheetId
        ? { _id: form.priceSheetId }
        : await ensureCollectionStoreCatalog(
            collectionId,
            Number(form.minimumOrderAmount || 0),
          );
      await updateCollection.mutateAsync({
        settings: {
          ...(collection.settings ?? {}),
          store: {
            ...(collection.settings?.store ?? {}),
            enabled: form.enabled,
            storeStatus: form.enabled,
            priceSheetId: catalog._id,
            showPrintStoreNav: form.showPrintStoreNav,
            showBuyPhotoButton: form.showBuyPhotoButton,
            allowBulkBuy: form.allowBulkBuy,
            minimumOrderAmount: Number(form.minimumOrderAmount || 0),
            currency: form.currency,
            requireProfessionalInfo: form.requireProfessionalInfo,
          },
        },
      });
      await refresh();
      toast.success(form.enabled ? "Collection store enabled" : "Collection store disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save store settings");
    }
  };

  const createCatalog = async () => {
    if (!collectionId) return null;
    setBusy(true);
    try {
      const result = await ensureCollectionStoreCatalog(
        collectionId,
        Number(form.minimumOrderAmount || 0),
      );
      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  };

  return {
    collection,
    collectionLoading: collectionQuery.isLoading || !loaded,
    form,
    setForm,
    catalog: catalogQuery.data?.data,
    sheet: catalogQuery.data?.data,
    catalogLoading: catalogQuery.isLoading,
    sheetLoading: catalogQuery.isLoading,
    catalogError: catalogQuery.error instanceof Error ? catalogQuery.error.message : "",
    retryCatalog: catalogQuery.refetch,
    busy,
    createCatalog,
    saveSettings,
    createProduct: (payload: Record<string, unknown>) => run(
      () => addCollectionStoreProduct(collectionId, payload),
      "Product added",
    ),
    saveProduct: (id: string, patch: Record<string, unknown>) => run(
      () => editCollectionStoreProduct(collectionId, id, patch),
      "Product updated",
    ),
    removeProduct: (id: string) => run(
      () => hideCollectionStoreProduct(collectionId, id),
      "Product hidden",
    ),
  };
}

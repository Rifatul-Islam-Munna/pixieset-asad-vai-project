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
import { validatePrintLabSettings } from "@/lib/print-lab-settings";

const defaults: StoreSettingsForm = {
  enabled: false,
  printRequestsEnabled: false,
  freePrintSizes: ["4 x 6", "5 x 7", "8 x 10", "8 x 12"],
  freePrintPapers: ["Glossy", "Matte"],
  printLabEmail: "",
  notifyPrintLabForFreeRequests: false,
  notifyPrintLabForPaidOrders: false,
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
    if (!collection || loaded || catalogQuery.isLoading) return;
    const store = (collection.settings?.store ?? {}) as Record<string, any>;
    const catalog = catalogQuery.data?.data;
    setForm({
      ...defaults,
      enabled: Boolean(store.enabled || store.storeStatus),
      printRequestsEnabled: Boolean(store.printRequestsEnabled),
      freePrintSizes: optionList(store.freePrintSizes, catalog?.freePrintSizes, defaults.freePrintSizes),
      freePrintPapers: optionList(store.freePrintPapers, catalog?.freePrintPapers, defaults.freePrintPapers),
      printLabEmail: String(store.printLabEmail ?? ""),
      notifyPrintLabForFreeRequests: Boolean(store.notifyPrintLabForFreeRequests),
      notifyPrintLabForPaidOrders: Boolean(store.notifyPrintLabForPaidOrders),
      priceSheetId: store.priceSheetId ?? "",
      showPrintStoreNav: store.showPrintStoreNav ?? defaults.showPrintStoreNav,
      showBuyPhotoButton: store.showBuyPhotoButton ?? defaults.showBuyPhotoButton,
      allowBulkBuy: store.allowBulkBuy ?? defaults.allowBulkBuy,
      minimumOrderAmount: String(store.minimumOrderAmount ?? 0),
      currency: String(store.currency ?? "EUR").toUpperCase(),
      requireProfessionalInfo: Boolean(store.requireProfessionalInfo),
    });
    setLoaded(true);
  }, [collection, loaded, catalogQuery.isLoading, catalogQuery.data]);

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

  const saveSettings = async (patch: Partial<StoreSettingsForm> = {}) => {
    if (!collection) return;
    const nextForm = { ...form, ...patch };
    nextForm.freePrintSizes = cleanOptions(nextForm.freePrintSizes);
    nextForm.freePrintPapers = cleanOptions(nextForm.freePrintPapers);
    const validationError = validatePrintLabSettings(nextForm);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      const catalog = !(nextForm.enabled || nextForm.printRequestsEnabled)
        ? null
        : nextForm.priceSheetId
          ? { _id: nextForm.priceSheetId }
          : await ensureCollectionStoreCatalog(
              collectionId,
              Number(nextForm.minimumOrderAmount || 0),
            );
      await updateCollection.mutateAsync({
        settings: {
          ...(collection.settings ?? {}),
          store: {
            ...(collection.settings?.store ?? {}),
            enabled: nextForm.enabled,
            storeStatus: nextForm.enabled,
            printRequestsEnabled: nextForm.printRequestsEnabled,
            freePrintSizes: nextForm.freePrintSizes,
            freePrintPapers: nextForm.freePrintPapers,
            printLabEmail: nextForm.printLabEmail.trim(),
            notifyPrintLabForFreeRequests: nextForm.notifyPrintLabForFreeRequests,
            notifyPrintLabForPaidOrders: nextForm.notifyPrintLabForPaidOrders,
            priceSheetId: catalog?._id ?? nextForm.priceSheetId,
            showPrintStoreNav: nextForm.showPrintStoreNav,
            showBuyPhotoButton: nextForm.showBuyPhotoButton,
            allowBulkBuy: nextForm.allowBulkBuy,
            minimumOrderAmount: Number(nextForm.minimumOrderAmount || 0),
            currency: nextForm.currency,
            requireProfessionalInfo: nextForm.requireProfessionalInfo,
          },
        },
      });
      await refresh();
      toast.success("Collection store settings saved");
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

function cleanOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.map((item) => String(item ?? "").trim().slice(0, 80)).filter((item) => { const key = item.toLowerCase(); if (!item || seen.has(key)) return false; seen.add(key); return true; }).slice(0, 50);
}

function optionList(...sources: unknown[]): string[] {
  for (const source of sources) { const options = cleanOptions(source); if (options.length) return options; }
  return [];
}

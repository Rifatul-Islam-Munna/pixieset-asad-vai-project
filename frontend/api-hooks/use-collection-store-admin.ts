"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCollectionDetail } from "./use-collections";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";
import type { StoreSettingsForm, StoreSheetSummary } from "@/components/dashboard/collection-store-settings-panel";
import type { PublicStoreProduct } from "@/lib/public-store";

type SheetDetail = StoreSheetSummary & { products?: PublicStoreProduct[] };

const initialForm: StoreSettingsForm = {
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
  const queryClient = useQueryClient();
  const { collectionQuery, updateCollection } = useCollectionDetail(collectionId);
  const collection = collectionQuery.data?.data;
  const [form, setForm] = useState<StoreSettingsForm>(initialForm);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const sheetsQuery = useQuery({
    queryKey: ["store-catalog", "price-sheets"],
    queryFn: () => GetRequestNormal<{ data: StoreSheetSummary[] }>("/store/catalog/price-sheets"),
  });
  const sheets = sheetsQuery.data?.data ?? [];
  const sheetQuery = useQuery({
    enabled: Boolean(form.priceSheetId),
    queryKey: ["store-catalog", "price-sheet", form.priceSheetId],
    queryFn: () => GetRequestNormal<{ data: SheetDetail }>(`/store/catalog/price-sheets/${form.priceSheetId}`),
  });

  useEffect(() => {
    if (!collection || loaded) return;
    const store = collection.settings?.store ?? {};
    setForm({
      enabled: Boolean(store.enabled ?? store.storeStatus),
      priceSheetId: store.priceSheetId ?? "",
      showPrintStoreNav: store.showPrintStoreNav !== false,
      showBuyPhotoButton: store.showBuyPhotoButton !== false,
      allowBulkBuy: store.allowBulkBuy !== false,
      minimumOrderAmount: String(store.minimumOrderAmount ?? 0),
      currency: String(store.currency ?? "EUR").toUpperCase(),
      requireProfessionalInfo: Boolean(store.requireProfessionalInfo),
    });
    setLoaded(true);
  }, [collection, loaded]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["store-catalog"] });

  const saveSettings = async () => {
    if (!collection) return;
    if (form.enabled && !form.priceSheetId) {
      toast.error("Choose a price sheet before enabling the store");
      return;
    }
    setBusy(true);
    try {
      await updateCollection.mutateAsync({
        settings: {
          ...(collection.settings ?? {}),
          store: {
            ...(collection.settings?.store ?? {}),
            ...form,
            storeStatus: form.enabled,
            minimumOrderAmount: Number(form.minimumOrderAmount || 0),
            currency: form.currency.toUpperCase(),
          },
        },
      });
      if (form.priceSheetId) {
        const sheet = sheets.find(item => item._id === form.priceSheetId);
        const collectionIds = [...new Set([...(sheet?.collectionIds ?? []), collectionId])];
        const [, error] = await PatchRequestAxios<any>(`/store/catalog/price-sheets/${form.priceSheetId}`, {
          collectionIds,
          minimumOrderAmount: Number(form.minimumOrderAmount || 0),
        });
        if (error) throw new Error(error.message);
      }
      await refresh();
      toast.success("Collection store settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save store settings");
    } finally {
      setBusy(false);
    }
  };

  const createCatalog = async () => {
    setBusy(true);
    const [response, error] = await PostRequestAxios<{ data: StoreSheetSummary }>("/store/catalog/price-sheets/default", {
      name: `${collection?.name || "Collection"} Print Store`,
      isDefault: sheets.length === 0,
      collectionIds: [collectionId],
      minimumOrderAmount: Number(form.minimumOrderAmount || 0),
    });
    setBusy(false);
    if (error || !response) return toast.error(error?.message || "Unable to create catalog");
    setForm(value => ({ ...value, priceSheetId: response.data._id }));
    await refresh();
    toast.success("Default print catalog created");
  };

  const addDefaults = async () => {
    if (!form.priceSheetId) return;
    setBusy(true);
    const [response, error] = await PostRequestAxios<any>(`/store/catalog/price-sheets/${form.priceSheetId}/default-products`, { replace: false });
    setBusy(false);
    if (error || !response) toast.error(error?.message || "Unable to add products");
    else {
      await refresh();
      toast.success("Default products added");
    }
  };

  const saveProduct = async (productId: string, patch: Record<string, unknown>) => {
    if (!form.priceSheetId) return;
    setBusy(true);
    const [, error] = await PatchRequestAxios<any>(`/store/catalog/price-sheets/${form.priceSheetId}/products/${productId}`, patch);
    setBusy(false);
    if (error) throw new Error(error.message);
    await refresh();
    toast.success("Product updated");
  };

  const removeProduct = async (productId: string) => {
    if (!form.priceSheetId) return;
    setBusy(true);
    const [, error] = await DeleteRequestAxios<any>(`/store/catalog/price-sheets/${form.priceSheetId}/products/${productId}`);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      await refresh();
      toast.success("Product removed");
    }
  };

  return {
    collection,
    collectionLoading: collectionQuery.isLoading || !loaded,
    form,
    setForm,
    sheets,
    sheet: sheetQuery.data?.data,
    sheetLoading: sheetQuery.isLoading,
    busy,
    saveSettings,
    createCatalog,
    addDefaults,
    saveProduct,
    removeProduct,
  };
}

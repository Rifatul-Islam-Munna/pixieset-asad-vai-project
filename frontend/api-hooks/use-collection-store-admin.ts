"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCollectionDetail } from "./use-collections";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";
import type { StoreSettingsForm, StoreSheetSummary } from "@/components/dashboard/collection-store-settings-panel";
import type { PublicStoreProduct } from "@/lib/public-store";

type SheetDetail = StoreSheetSummary & { products?: PublicStoreProduct[] };

type CreateCatalogResponse = {
  data: StoreSheetSummary;
  defaults?: { created: number; total: number };
};

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
      showPrintStoreNav: true,
      showBuyPhotoButton: true,
      allowBulkBuy: true,
      minimumOrderAmount: String(store.minimumOrderAmount ?? 0),
      currency: String(store.currency ?? "EUR").toUpperCase(),
      requireProfessionalInfo: false,
    });
    setLoaded(true);
  }, [collection, loaded]);

  useEffect(() => {
    if (!loaded || form.priceSheetId || !sheets.length) return;
    setForm((value) => ({ ...value, priceSheetId: sheets[0]._id }));
  }, [form.priceSheetId, loaded, sheets]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["store-catalog"] });

  const createAutomaticCatalog = async () => {
    const [response, error] = await PostRequestAxios<CreateCatalogResponse>(
      "/store/catalog/price-sheets/default",
      {
        name: "Default Print Store",
        isDefault: sheets.length === 0,
        collectionIds: [collectionId],
        minimumOrderAmount: Number(form.minimumOrderAmount || 0),
      },
    );
    if (error || !response?.data?._id) {
      throw new Error(error?.message || "Unable to create the automatic print catalog");
    }
    return response.data._id;
  };

  const ensureDefaults = async (priceSheetId: string) => {
    const [, error] = await PostRequestAxios<any>(
      `/store/catalog/price-sheets/${priceSheetId}/default-products`,
      { replace: false },
    );
    if (error) throw new Error(error.message);
  };

  const saveSettings = async () => {
    if (!collection) return;
    setBusy(true);
    try {
      let priceSheetId = form.priceSheetId || sheets[0]?._id || "";
      if (form.enabled && !priceSheetId) {
        priceSheetId = await createAutomaticCatalog();
      }
      if (form.enabled && priceSheetId) {
        await ensureDefaults(priceSheetId);
      }

      const settings = {
        ...(collection.settings ?? {}),
        store: {
          ...(collection.settings?.store ?? {}),
          enabled: form.enabled,
          storeStatus: form.enabled,
          priceSheetId,
          showPrintStoreNav: true,
          showBuyPhotoButton: true,
          allowBulkBuy: true,
          minimumOrderAmount: Number(form.minimumOrderAmount || 0),
          currency: form.currency.toUpperCase(),
          requireProfessionalInfo: false,
        },
      };

      await updateCollection.mutateAsync({ settings });
      if (priceSheetId) {
        const sheet = sheets.find((item) => item._id === priceSheetId);
        const collectionIds = [...new Set([...(sheet?.collectionIds ?? []), collectionId])];
        const [, error] = await PatchRequestAxios<any>(`/store/catalog/price-sheets/${priceSheetId}`, {
          collectionIds,
        });
        if (error) throw new Error(error.message);
      }
      setForm((value) => ({ ...value, priceSheetId }));
      await refresh();
      toast.success(form.enabled ? "Collection store enabled" : "Collection store disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save store settings");
    } finally {
      setBusy(false);
    }
  };

  const createCatalog = async () => {
    setBusy(true);
    try {
      const priceSheetId = await createAutomaticCatalog();
      setForm((value) => ({ ...value, priceSheetId }));
      await refresh();
      toast.success("Print catalog created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create catalog");
    } finally {
      setBusy(false);
    }
  };

  const addDefaults = async () => {
    if (!form.priceSheetId) return;
    setBusy(true);
    try {
      await ensureDefaults(form.priceSheetId);
      await refresh();
      toast.success("Default products added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add products");
    } finally {
      setBusy(false);
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

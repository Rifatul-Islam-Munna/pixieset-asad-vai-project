"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DeleteRequestAxios,
  GetRequestNormal,
  PatchRequestAxios,
  PostRequestAxios,
} from "./api-hooks";

export type StoreProductType = "digital-download" | "self-fulfilled";

export type StoreProductRecord = {
  _id: string;
  priceSheetId: string;
  type: StoreProductType;
  name: string;
  description?: string;
  price: number;
  extraShipping?: number;
  category?: string;
  images?: string[];
  downloadType?: "single-photo" | "all-photos";
  downloadSize?: string;
  options?: { name: string; values: string[] }[];
  noImageRequired?: boolean;
  exemptFromSalesTax?: boolean;
  limitOnePerCheckout?: boolean;
  allowBulkPurchase?: boolean;
  createdAt?: string;
};

export type StorePriceSheetRecord = {
  _id: string;
  name: string;
  isDefault?: boolean;
  collectionIds?: string[];
  minimumOrderAmount?: number;
  fulfillment?: "self-fulfilled";
  productCount?: number;
  collectionCount?: number;
  products?: StoreProductRecord[];
  createdAt?: string;
};

type ListResponse<T> = { data: T };

export type StoreProductPayload = Omit<
  Partial<StoreProductRecord>,
  "_id" | "priceSheetId" | "createdAt"
> & {
  type: StoreProductType;
  name: string;
  price: number;
};

export function useStorePriceSheets(collectionId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["store-price-sheets", collectionId ?? "all"] as const;
  const queryString = collectionId
    ? `?collectionId=${encodeURIComponent(collectionId)}`
    : "";
  const priceSheetsQuery = useQuery({
    queryKey,
    queryFn: () =>
      GetRequestNormal<ListResponse<StorePriceSheetRecord[]>>(
        `/store/price-sheets${queryString}`,
      ),
  });

  const createPriceSheet = useMutation({
    mutationFn: async (payload: {
      name: string;
      isDefault?: boolean;
      collectionIds?: string[];
      minimumOrderAmount?: number;
    }) => {
      const [data, error] = await PostRequestAxios<
        ListResponse<StorePriceSheetRecord> & { message: string }
      >("/store/price-sheets", payload);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-price-sheets"] });
    },
  });

  return { priceSheetsQuery, createPriceSheet };
}

export function useStorePriceSheet(priceSheetId?: string) {
  const queryClient = useQueryClient();
  const priceSheetQuery = useQuery({
    enabled: Boolean(priceSheetId),
    queryKey: ["store-price-sheet", priceSheetId],
    queryFn: () =>
      GetRequestNormal<
        ListResponse<StorePriceSheetRecord & { products: StoreProductRecord[] }>
      >(`/store/price-sheets/${priceSheetId}`),
  });

  const updatePriceSheet = useMutation({
    mutationFn: async (payload: Partial<StorePriceSheetRecord>) => {
      if (!priceSheetId) throw new Error("Price sheet is required");
      const [data, error] = await PatchRequestAxios<
        ListResponse<StorePriceSheetRecord> & { message: string }
      >(`/store/price-sheets/${priceSheetId}`, payload as any);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-price-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["store-price-sheet", priceSheetId] });
    },
  });

  const createProduct = useMutation({
    mutationFn: async (payload: StoreProductPayload) => {
      if (!priceSheetId) throw new Error("Price sheet is required");
      const [data, error] = await PostRequestAxios<
        ListResponse<StoreProductRecord> & { message: string }
      >(`/store/price-sheets/${priceSheetId}/products`, payload);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-price-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["store-price-sheet", priceSheetId] });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({
      productId,
      payload,
    }: {
      productId: string;
      payload: Partial<StoreProductPayload>;
    }) => {
      if (!priceSheetId) throw new Error("Price sheet is required");
      const [data, error] = await PatchRequestAxios<
        ListResponse<StoreProductRecord> & { message: string }
      >(`/store/price-sheets/${priceSheetId}/products/${productId}`, payload as any);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-price-sheet", priceSheetId] });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      if (!priceSheetId) throw new Error("Price sheet is required");
      const [data, error] = await DeleteRequestAxios<
        ListResponse<StoreProductRecord> & { message: string }
      >(`/store/price-sheets/${priceSheetId}/products/${productId}`);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-price-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["store-price-sheet", priceSheetId] });
    },
  });

  return {
    priceSheetQuery,
    updatePriceSheet,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}

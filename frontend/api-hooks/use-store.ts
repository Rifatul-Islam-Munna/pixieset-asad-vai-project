"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
  active?: boolean;
  name: string;
  description?: string;
  price: number;
  extraShipping?: number;
  category?: string;
  images?: string[];
  downloadType?: "single-photo" | "all-photos";
  downloadSize?: string;
  options?: StoreProductOption[];
  variants?: StoreProductVariant[];
  noImageRequired?: boolean;
  exemptFromSalesTax?: boolean;
  limitOnePerCheckout?: boolean;
  allowBulkPurchase?: boolean;
  createdAt?: string;
};

export type StoreProductOption = { name: string; values: string[] };

export type StoreProductVariant = {
  id: string;
  label: string;
  options: Record<string, string>;
  price: number;
  hidden?: boolean;
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

export type StoreOrderStatus =
  | "pending"
  | "processing"
  | "fulfilled"
  | "shipped"
  | "delivered"
  | "cancelled";

export type StoreOrderRecord = {
  _id: string;
  orderNumber: string;
  customerId?: string;
  customer: { name: string; email: string; phone?: string; address?: Record<string, any> };
  items: {
    productId?: string;
    name: string;
    type: string;
    variantId?: string;
    variantLabel?: string;
    options?: Record<string, string>;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  shipping: number;
  shippingMethodId?: string;
  shippingMethodName?: string;
  shippingNote?: string;
  discount: number;
  total: number;
  status: StoreOrderStatus;
  paymentStatus: "unpaid" | "paid" | "refunded";
  trackingNumber?: string;
  trackingUrl?: string;
  note?: string;
  createdAt?: string;
};

export type StoreCustomerRecord = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: Record<string, any>;
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: string;
  createdAt?: string;
};

export type StoreCouponRecord = {
  _id: string;
  code: string;
  name: string;
  discountType: "percent" | "fixed";
  amount: number;
  active: boolean;
  usageCount?: number;
  expiresAt?: string;
  createdAt?: string;
};

export type StoreTaxRecord = {
  _id: string;
  name: string;
  region?: string;
  rate: number;
  applyShipping?: boolean;
  applyDigitalDownloads?: boolean;
  active: boolean;
  createdAt?: string;
};

export type StoreShippingRecord = {
  _id: string;
  name: string;
  region?: string;
  shipInternational?: boolean;
  price: number;
  freeOver?: number;
  active: boolean;
  createdAt?: string;
};

export type StoreDashboardRecord = {
  revenue: number;
  orderCount: number;
  customerCount: number;
  productCount: number;
  couponCount: number;
  pending: number;
  averageOrderValue: number;
  statusCounts: Record<string, number>;
  recentOrders: StoreOrderRecord[];
};

export type StoreSettingsRecord = {
  _id?: string;
  globalStatus: boolean;
  currency: string;
  orderDelay: string;
  maintainMarkup: boolean;
  roundPricesUpTo: string;
  paymentMethods: {
    stripe?: {
      enabled: boolean;
      publishableKey?: string;
      secretKey?: string;
      accountLink?: string;
    };
  };
  links: { label: string; url: string }[];
  domain: { hostname?: string; dnsTarget?: string; verified?: boolean };
  giftCardSharingEmail: string;
  termsOfSale: string;
  digitalImageLicense: string;
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
        `/store/catalog/price-sheets${queryString}`,
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
      >("/store/catalog/price-sheets/default", payload);

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
      >(`/store/catalog/price-sheets/${priceSheetId}`),
  });

  const updatePriceSheet = useMutation({
    mutationFn: async (payload: Partial<StorePriceSheetRecord>) => {
      if (!priceSheetId) throw new Error("Price sheet is required");
      const [data, error] = await PatchRequestAxios<
        ListResponse<StorePriceSheetRecord> & { message: string }
      >(`/store/catalog/price-sheets/${priceSheetId}`, payload as any);

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
      >(`/store/catalog/price-sheets/${priceSheetId}/products`, payload);

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
      >(`/store/catalog/price-sheets/${priceSheetId}/products/${productId}`, payload as any);

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
      >(`/store/catalog/price-sheets/${priceSheetId}/products/${productId}`);

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

export function useStorePriceSheetDetails(priceSheetIds: string[]) {
  return useQueries({
    queries: priceSheetIds.map((priceSheetId) => ({
      enabled: Boolean(priceSheetId),
      queryKey: ["store-price-sheet", priceSheetId],
      queryFn: () =>
        GetRequestNormal<
          ListResponse<StorePriceSheetRecord & { products: StoreProductRecord[] }>
        >(`/store/catalog/price-sheets/${priceSheetId}`),
    })),
  });
}

export function useStoreProductUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      priceSheetId,
      productId,
      payload,
    }: {
      priceSheetId: string;
      productId: string;
      payload: Partial<StoreProductRecord>;
    }) => {
      const [data, error] = await PatchRequestAxios<
        ListResponse<StoreProductRecord> & { message: string }
      >(`/store/catalog/price-sheets/${priceSheetId}/products/${productId}`, payload as any);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["store-price-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["store-price-sheet", variables.priceSheetId] });
    },
  });
}

export function useStoreDashboard() {
  return useQuery({
    queryKey: ["store-dashboard"],
    queryFn: () =>
      GetRequestNormal<ListResponse<StoreDashboardRecord>>("/store/dashboard"),
  });
}

export function useStoreSettings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["store-settings"],
    queryFn: () =>
      GetRequestNormal<ListResponse<StoreSettingsRecord>>("/store/settings"),
  });

  const saveSettings = useMutation({
    mutationFn: async (payload: StoreSettingsRecord) => {
      const [data, error] = await PatchRequestAxios<
        ListResponse<StoreSettingsRecord> & { message: string }
      >("/store/settings", payload as any);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-settings"] }),
  });

  return { settingsQuery, saveSettings };
}

export function useStripePayments() {
  const createIntent = useMutation({
    mutationFn: async (payload: { amount: number; currency?: string; orderId?: string }) => {
      const [data, error] = await PostRequestAxios<{
        message: string;
        data: {
          publishableKey: string;
          paymentIntentId: string;
          clientSecret: string;
          status: string;
        };
      }>("/store/payments/stripe-intent", payload);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const verifyPayment = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const [data, error] = await PostRequestAxios<{
        message: string;
        data: {
          paymentIntentId: string;
          status: string;
          success: boolean;
          amount: number;
          currency: string;
        };
      }>("/store/payments/stripe-verify", { paymentIntentId });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  return { createIntent, verifyPayment };
}

export function useStoreOrders() {
  const queryClient = useQueryClient();
  const ordersQuery = useQuery({
    queryKey: ["store-orders"],
    queryFn: () => GetRequestNormal<ListResponse<StoreOrderRecord[]>>("/store/orders"),
  });

  const createOrder = useMutation({
    mutationFn: async (payload: Partial<StoreOrderRecord>) => {
      const [data, error] = await PostRequestAxios<
        ListResponse<StoreOrderRecord> & { message: string }
      >("/store/orders", payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-orders"] });
      queryClient.invalidateQueries({ queryKey: ["store-customers"] });
      queryClient.invalidateQueries({ queryKey: ["store-dashboard"] });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: Partial<StoreOrderRecord>;
    }) => {
      const [data, error] = await PatchRequestAxios<
        ListResponse<StoreOrderRecord> & { message: string }
      >(`/store/orders/${orderId}`, payload as any);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-orders"] });
      queryClient.invalidateQueries({ queryKey: ["store-customers"] });
      queryClient.invalidateQueries({ queryKey: ["store-dashboard"] });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const [data, error] = await DeleteRequestAxios<
        ListResponse<StoreOrderRecord> & { message: string }
      >(`/store/orders/${orderId}`);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-orders"] });
      queryClient.invalidateQueries({ queryKey: ["store-customers"] });
      queryClient.invalidateQueries({ queryKey: ["store-dashboard"] });
    },
  });

  return { ordersQuery, createOrder, updateOrder, deleteOrder };
}

export function useStoreCustomers() {
  const queryClient = useQueryClient();
  const customersQuery = useQuery({
    queryKey: ["store-customers"],
    queryFn: () =>
      GetRequestNormal<ListResponse<StoreCustomerRecord[]>>("/store/customers"),
  });

  const createCustomer = useMutation({
    mutationFn: async (payload: Partial<StoreCustomerRecord>) => {
      const [data, error] = await PostRequestAxios<
        ListResponse<StoreCustomerRecord> & { message: string }
      >("/store/customers", payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-customers"] }),
  });

  return { customersQuery, createCustomer };
}

type StoreRuleKind = "coupons" | "taxes" | "shipping";
type StoreRuleRecord = StoreCouponRecord | StoreTaxRecord | StoreShippingRecord;

export function useStoreRules<T extends StoreRuleRecord>(kind: StoreRuleKind) {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({
    queryKey: ["store-rules", kind],
    queryFn: () =>
      GetRequestNormal<ListResponse<T[]>>(`/store/${kind}`).catch(() => ({ data: [] as T[] })),
  });

  const saveRule = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      const [data, error] = await PostRequestAxios<
        ListResponse<T> & { message: string }
      >(`/store/${kind}`, payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-rules", kind] });
      queryClient.invalidateQueries({ queryKey: ["store-dashboard"] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const [data, error] = await DeleteRequestAxios<
        ListResponse<T> & { message: string }
      >(`/store/${kind}/${id}`);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-rules", kind] });
      queryClient.invalidateQueries({ queryKey: ["store-dashboard"] });
    },
  });

  return { rulesQuery, saveRule, deleteRule };
}

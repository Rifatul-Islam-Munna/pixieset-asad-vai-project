"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { mergeHomeCms, type HomeCmsData } from "@/lib/home-cms";
import { apiBaseUrl } from "@/lib/api-base-url";

export type AdminUser = {
  _id: string;
  name: string;
  email?: string;
  phoneNumber: string;
  role: "admin" | "editor" | "user";
  gender?: string;
  collectionCount?: number;
  planId?: string;
  planName?: string;
  createdAt?: string;
};

export type AdminCollection = {
  _id: string;
  userId: string;
  name: string;
  slug?: string;
  imageCount?: number;
  status?: string;
  createdAt?: string;
  user?: Pick<AdminUser, "_id" | "name" | "email" | "phoneNumber"> | null;
};

export type AdminPlan = {
  _id: string;
  name: string;
  storageGb: number;
  monthlyEmails: number;
  videoMinutes?: number;
  videoQuality?: "hd" | "4k";
  priceMonthly?: number;
  yearlyEnabled?: boolean;
  priceYearly?: number;
  features?: Record<string, boolean>;
  active: boolean;
  createdAt?: string;
};

export type AdminDefaultStoreVariant = {
  id: string;
  label: string;
  options?: Record<string, string>;
  price: number;
  extraShipping?: number;
  hidden?: boolean;
  sortOrder?: number;
  isDefault?: boolean;
};

export type AdminDefaultStoreProduct = {
  _id: string;
  slug: string;
  type: "digital-download" | "self-fulfilled";
  name: string;
  category: string;
  active: boolean;
  sortOrder: number;
  description?: string;
  productInfo?: string;
  productionNote?: string;
  price: number;
  extraShipping?: number;
  images?: string[];
  previewImages?: string[];
  variants?: AdminDefaultStoreVariant[];
  options?: { name: string; values: string[] }[];
  updatedAt?: string;
};

export type AdminStripeSetting = {
  enabled: boolean;
  publishableKey: string;
  secretKey?: string;
  webhookSecret?: string;
  hasSecretKey?: boolean;
  hasWebhookSecret?: boolean;
};

export type AdminFreePlanSetting = {
  storageGb: number;
  monthlyEmails: number;
};

export type AdminDashboardData = {
  stats: {
    users: number;
    collections: number;
    images: number;
    plans?: number;
    orders?: number;
    revenue?: number;
    monthly?: { month: string; users: number; orders: number; revenue: number }[];
    planMix?: { name: string; value: number }[];
    recentUsers?: AdminUser[];
  };
  users: AdminUser[];
  collections: AdminCollection[];
  plans: AdminPlan[];
  stripe: AdminStripeSetting;
  freePlan: AdminFreePlanSetting;
  homeCms: HomeCmsData;
};

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (await cookies()).get("access_token")?.value;
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: token ?? "",
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) redirect("/login");
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? "Request failed");
  return payload?.data as T;
}

async function adminOptionalRequest<T>(path: string, fallback: T): Promise<T> {
  try {
    return await adminRequest<T>(path);
  } catch {
    return fallback;
  }
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const [stats, users, collections, plans, stripe, freePlan, homeCms] = await Promise.all([
    adminRequest<AdminDashboardData["stats"]>("/admin/dashboard"),
    adminRequest<AdminUser[]>("/admin/users"),
    adminRequest<AdminCollection[]>("/admin/collections"),
    adminRequest<AdminPlan[]>("/admin/plans"),
    adminOptionalRequest<AdminStripeSetting>("/admin/stripe", {
      enabled: false,
      publishableKey: "",
      hasSecretKey: false,
      hasWebhookSecret: false,
    }),
    adminOptionalRequest<AdminFreePlanSetting>("/admin/free-plan", {
      storageGb: 3,
      monthlyEmails: 1000,
    }),
    adminOptionalRequest<HomeCmsData>("/home-cms", mergeHomeCms()),
  ]);
  return { stats, users, collections, plans, stripe, freePlan, homeCms: mergeHomeCms(homeCms) };
}

export async function createAdminUser(payload: {
  name: string;
  phoneNumber: string;
  password: string;
  email?: string;
  role: AdminUser["role"];
  gender?: string;
  planId?: string;
}) {
  const data = await adminRequest<AdminUser>("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  revalidatePath("/admin");
  return data;
}

export async function updateAdminUser(id: string, payload: Partial<AdminUser> & { password?: string }) {
  const data = await adminRequest<AdminUser>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/admin");
  return data;
}

export async function deleteAdminUser(id: string) {
  const data = await adminRequest<AdminUser>(`/admin/users/${id}`, { method: "DELETE" });
  revalidatePath("/admin");
  return data;
}

export async function deleteAdminCollection(id: string) {
  const data = await adminRequest<AdminCollection>(`/admin/collections/${id}`, { method: "DELETE" });
  revalidatePath("/admin");
  return data;
}

export async function createAdminPlan(payload: Omit<AdminPlan, "_id" | "createdAt">) {
  const data = await adminRequest<AdminPlan>("/admin/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  revalidatePath("/admin");
  return data;
}

export async function updateAdminPlan(id: string, payload: Partial<Omit<AdminPlan, "_id" | "createdAt">>) {
  const data = await adminRequest<AdminPlan>(`/admin/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/admin");
  return data;
}

export async function deleteAdminPlan(id: string) {
  const data = await adminRequest<AdminPlan>(`/admin/plans/${id}`, { method: "DELETE" });
  revalidatePath("/admin");
  return data;
}

export async function updateAdminStripeSettings(payload: AdminStripeSetting) {
  const data = await adminRequest<AdminStripeSetting>("/admin/stripe", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/admin");
  return data;
}

export async function updateAdminFreePlanSettings(payload: AdminFreePlanSetting) {
  const data = await adminRequest<AdminFreePlanSetting>("/admin/free-plan", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/admin");
  return data;
}

export async function updateHomeCms(payload: HomeCmsData) {
  const data = await adminRequest<HomeCmsData>("/home-cms", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/login");
  revalidatePath("/register");
  revalidatePath("/terms-of-service");
  revalidatePath("/privacy-policy");
  return mergeHomeCms(data);
}

export async function uploadHomeCmsFile(formData: FormData) {
  const response = await fetch(`${apiBaseUrl()}/image-upload/upload-image`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? "Upload failed");
  return payload?.data as string;
}

export async function getAdminHomeCms() {
  return adminRequest<HomeCmsData>("/home-cms");
}

export async function getAdminDefaultStoreProducts() {
  return adminRequest<AdminDefaultStoreProduct[]>("/admin/default-store-products");
}

export async function createAdminDefaultStoreProduct(payload: Partial<AdminDefaultStoreProduct>) {
  const data = await adminRequest<AdminDefaultStoreProduct>("/admin/default-store-products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  revalidatePath("/admin/default-products");
  return data;
}

export async function updateAdminDefaultStoreProduct(id: string, payload: Partial<AdminDefaultStoreProduct>) {
  const data = await adminRequest<AdminDefaultStoreProduct>(`/admin/default-store-products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  revalidatePath("/admin/default-products");
  return data;
}

export async function deleteAdminDefaultStoreProduct(id: string) {
  const data = await adminRequest<AdminDefaultStoreProduct>(`/admin/default-store-products/${id}`, {
    method: "DELETE",
  });
  revalidatePath("/admin/default-products");
  return data;
}

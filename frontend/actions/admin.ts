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
  username?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  website?: string;
  businessAddress?: string;
  biography?: string;
  avatar?: string;
  collectionCount?: number;
  imageCount?: number;
  orderCount?: number;
  planId?: string;
  planName?: string;
  storageLimitGb?: number;
  storageUsedBytes?: number;
  galleryLimit?: number;
  monthlyEmailLimit?: number;
  monthlyEmailsUsed?: number;
  videoUploadLimitMinutes?: number;
  videoUploadQuality?: "hd" | "4k";
  planActivatedAt?: string;
  planExpiresAt?: string;
  planBillingInterval?: "month" | "year";
  createdAt?: string;
  collections?: AdminCollection[];
};

export type AdminLoginAccess = {
  email: string;
  pin: string;
  link: string;
  expiresAt: string;
  expiresInHours: number;
  validity: string;
  subject: string;
  message: string;
  sent: boolean;
  skipped?: boolean;
  reason?: string;
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
  galleryLimit?: number;
  monthlyEmails: number;
  videoMinutes?: number;
  videoQuality?: "hd" | "4k";
  priceMonthly?: number;
  yearlyEnabled?: boolean;
  priceYearly?: number;
  features?: Record<string, boolean>;
  recommended?: boolean;
  sortOrder?: number;
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

export async function createAdminLoginAccess(id: string, expiresInHours: number) {
  return adminRequest<AdminLoginAccess>(`/admin/users/${id}/login-access`, {
    method: "POST",
    body: JSON.stringify({ expiresInHours }),
  });
}

export async function sendAdminLoginAccessEmail(id: string, payload: Pick<AdminLoginAccess, "pin" | "link" | "subject" | "message">) {
  return adminRequest<{ email: string; expiresAt: string; sent: boolean; skipped?: boolean; reason?: string }>(`/admin/users/${id}/login-access/send`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminUserDetails(id: string) {
  return adminRequest<AdminUser>(`/admin/users/${id}/details`);
}

export async function impersonateAdminUser(id: string) {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("access_token")?.value;
  const adminUser = cookieStore.get("user")?.value;
  const data = await adminRequest<{ accessToken: string; user: AdminUser }>(`/admin/users/${id}/impersonate`, { method: "POST" });
  if (adminToken) cookieStore.set("admin_access_token_backup", adminToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 2 });
  if (adminUser) cookieStore.set("admin_user_backup", adminUser, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 2 });
  cookieStore.set("access_token", data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 2 });
  cookieStore.set("user", JSON.stringify(data.user), { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 2 });
  cookieStore.set("admin_impersonating", "1", { httpOnly: false, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 2 });
  return true;
}

export async function restoreAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_access_token_backup")?.value;
  const user = cookieStore.get("admin_user_backup")?.value;
  if (!token || !user) return false;
  cookieStore.set("access_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 10 });
  cookieStore.set("user", user, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 10 });
  cookieStore.delete("admin_access_token_backup");
  cookieStore.delete("admin_user_backup");
  cookieStore.delete("admin_impersonating");
  return true;
}

export async function updateAdminCollection(id: string, payload: { name?: string; slug?: string; status?: string }) {
  const data = await adminRequest<AdminCollection>(`/admin/collections/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
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

export async function reorderAdminPlans(planIds: string[]) {
  const data = await adminRequest<AdminPlan[]>("/admin/plans/reorder", {
    method: "PATCH",
    body: JSON.stringify({ planIds }),
  });
  revalidatePath("/admin");
  revalidatePath("/plans");
  revalidatePath("/pricing");
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
  revalidatePath("/admin/email-templates");
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

export type AdminBlog = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  thumbnailUrl?: string;
  author?: string;
  keywords?: string[];
  published: boolean;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getAdminBlogs() {
  return adminRequest<AdminBlog[]>("/blogs/admin/all");
}

export async function createAdminBlog(payload: Partial<AdminBlog>) {
  const data = await adminRequest<AdminBlog>("/blogs/admin", { method: "POST", body: JSON.stringify(payload) });
  revalidatePath("/admin/blogs"); revalidatePath("/blog");
  return data;
}

export async function updateAdminBlog(id: string, payload: Partial<AdminBlog>) {
  const data = await adminRequest<AdminBlog>(`/blogs/admin/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  revalidatePath("/admin/blogs"); revalidatePath("/blog"); revalidatePath(`/blog/${data.slug}`);
  return data;
}

export async function deleteAdminBlog(id: string) {
  const data = await adminRequest<AdminBlog>(`/blogs/admin/${id}`, { method: "DELETE" });
  revalidatePath("/admin/blogs"); revalidatePath("/blog");
  return data;
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export type AdminUser = {
  _id: string;
  name: string;
  email?: string;
  phoneNumber: string;
  role: "admin" | "editor" | "user";
  gender?: string;
  collectionCount?: number;
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
  priceMonthly?: number;
  features?: Record<string, boolean>;
  active: boolean;
  createdAt?: string;
};

export type AdminStripeSetting = {
  enabled: boolean;
  publishableKey: string;
  secretKey?: string;
  webhookSecret?: string;
  hasSecretKey?: boolean;
  hasWebhookSecret?: boolean;
};

export type AdminDashboardData = {
  stats: { users: number; collections: number; images: number };
  users: AdminUser[];
  collections: AdminCollection[];
  plans: AdminPlan[];
  stripe: AdminStripeSetting;
};

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (await cookies()).get("access_token")?.value;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: token ?? "",
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) redirect("/admin/login");
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
  const [stats, users, collections, plans, stripe] = await Promise.all([
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
  ]);
  return { stats, users, collections, plans, stripe };
}

export async function createAdminUser(payload: {
  name: string;
  phoneNumber: string;
  password: string;
  email?: string;
  role: AdminUser["role"];
  gender?: string;
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

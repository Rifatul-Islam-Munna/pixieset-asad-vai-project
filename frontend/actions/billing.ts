"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminPlan } from "./admin";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export type BillingUser = {
  _id: string;
  name?: string;
  avatar?: string;
  planName?: string;
  storageLimitGb?: number;
  monthlyEmailLimit?: number;
  storageUsedBytes?: number;
  monthlyEmailsUsed?: number;
  planFeatures?: Record<string, boolean>;
};

export type PlanPurchase = { _id: string; planName: string; amount: number; source: "admin" | "checkout" | "free"; status: "active" | "paid"; createdAt: string };

function normalizePlans(value: unknown): AdminPlan[] {
  if (!Array.isArray(value)) return [];
  return value.map((plan: Partial<AdminPlan> & { _id?: string }, index) => ({
    _id: String(plan?._id ?? index),
    name: String(plan?.name ?? "Untitled plan"),
    storageGb: Number(plan?.storageGb ?? 0),
    monthlyEmails: Number(plan?.monthlyEmails ?? 0),
    priceMonthly: Number(plan?.priceMonthly ?? 0),
    features: plan?.features ?? {},
    active: plan?.active ?? true,
    createdAt: plan?.createdAt,
  }));
}

async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (await cookies()).get("access_token")?.value;
  const response = await fetch(`${baseUrl}${path}`, {
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

export async function getBillingOverview() {
  const [plans, user] = await Promise.all([
    authedRequest<AdminPlan[]>("/billing/plans"),
    authedRequest<BillingUser>("/user/get-my-profile"),
  ]);
  return { plans, user };
}

export async function getPurchaseHistory() {
  return authedRequest<PlanPurchase[]>("/billing/purchases");
}

export async function getPublicPlans() {
  try {
    const response = await fetch(`${baseUrl}/billing/public/plans`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        plans: [],
        error: payload?.message ?? `Plan route failed (${response.status})`,
      };
    }
    return { plans: normalizePlans(payload?.data), error: "" };
  } catch (error) {
    return {
      plans: [],
      error: error instanceof Error ? error.message : "Plan route unreachable",
    };
  }
}

export async function checkoutPlan(planId: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const data = await authedRequest<{ checkoutUrl?: string | null; activated?: boolean; plan?: AdminPlan }>(`/billing/plans/${planId}/checkout`, {
    method: "POST",
    body: JSON.stringify({
      successUrl: `${origin}/dashboard/client-gallery/storage?plan=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/dashboard/client-gallery/storage?plan=cancel`,
    }),
  });
  return data;
}

export async function confirmPlanCheckout(sessionId: string) {
  return authedRequest<AdminPlan>(`/billing/checkout-session/${encodeURIComponent(sessionId)}`);
}

export async function recordEmailUsage(count: number) {
  return authedRequest<{ monthlyEmailsUsed: number; monthlyEmailLimit: number }>("/billing/email-usage", {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}

"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminPlan } from "./admin";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

async function requestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim();
  if (host) {
    const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || (/^(localhost|127\.0\.0\.1)(:|$)/i.test(host) ? "http" : "https");
    return `${protocol}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
export type BillingUser = {
  _id: string;
  name?: string;
  avatar?: string;
  planId?: string;
  planName?: string;
  storageLimitGb?: number;
  monthlyEmailLimit?: number;
  storageUsedBytes?: number;
  monthlyEmailsUsed?: number;
  planFeatures?: Record<string, boolean>;
  planBillingInterval?: "month" | "year";
  planExpiresAt?: string;
};

export type PlanPurchase = { _id: string; planName: string; amount: number; billingInterval?: "month" | "year"; source: "admin" | "checkout" | "free"; status: "active" | "paid"; paymentProvider?: "stripe" | "paypal" | "admin" | "free"; createdAt: string };
export type BillingPaymentMethods = { stripe: boolean; paypal: boolean };

function normalizePlans(value: unknown): AdminPlan[] {
  if (!Array.isArray(value)) return [];
  return value.map((plan: Partial<AdminPlan> & { _id?: string }, index) => ({
    _id: String(plan?._id ?? index),
    name: String(plan?.name ?? "Untitled plan"),
    storageGb: Number(plan?.storageGb ?? 0),
    galleryLimit: Number(plan?.galleryLimit ?? 0),
    monthlyEmails: Number(plan?.monthlyEmails ?? 0),
    priceMonthly: Number(plan?.priceMonthly ?? 0),
    yearlyEnabled: Boolean(plan?.yearlyEnabled),
    priceYearly: Number(plan?.priceYearly ?? 0),
    features: plan?.features ?? {},
    recommended: Boolean(plan?.recommended),
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
  const [plans, user, paymentMethods] = await Promise.all([
    authedRequest<AdminPlan[]>("/billing/plans"),
    authedRequest<BillingUser>("/user/get-my-profile"),
    getPublicPaymentMethods(),
  ]);
  return { plans, user, paymentMethods };
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

export async function getPublicPaymentMethods(): Promise<BillingPaymentMethods> {
  try {
    const response = await fetch(`${baseUrl}/billing/public/payment-methods`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { stripe: false, paypal: false };
    return { stripe: Boolean(payload?.data?.stripe), paypal: Boolean(payload?.data?.paypal) };
  } catch {
    return { stripe: false, paypal: false };
  }
}

export async function checkoutPlan(planId: string, billingInterval: "month" | "year" = "month", paymentProvider?: "stripe" | "paypal") {
  const origin = await requestOrigin();
  const successUrl = paymentProvider === "paypal"
    ? `${origin}/dashboard/client-gallery/storage?plan=success&provider=paypal`
    : `${origin}/dashboard/client-gallery/storage?plan=success&session_id={CHECKOUT_SESSION_ID}`;
  const data = await authedRequest<{ checkoutUrl?: string | null; activated?: boolean; plan?: AdminPlan; paymentProvider?: "stripe" | "paypal"; paypalOrderId?: string }>(`/billing/plans/${planId}/checkout`, {
    method: "POST",
    body: JSON.stringify({
      successUrl,
      cancelUrl: `${origin}/dashboard/client-gallery/storage?plan=cancel`,
      billingInterval,
      paymentProvider,
    }),
  });
  return data;
}

export async function confirmPlanCheckout(sessionId: string) {
  return authedRequest<AdminPlan>(`/billing/checkout-session/${encodeURIComponent(sessionId)}`);
}

export async function confirmPayPalPlanCheckout(orderId: string) {
  return authedRequest<AdminPlan>(`/billing/paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST" });
}

export async function recordEmailUsage(count: number) {
  return authedRequest<{ monthlyEmailsUsed: number; monthlyEmailLimit: number }>("/billing/email-usage", {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}

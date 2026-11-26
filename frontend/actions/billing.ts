"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/api-base-url";
import { BackendRequestError, fetchBackendJson } from "@/lib/backend-request";
import type { AdminPlan, AdminFreePlanSetting } from "./admin";

const baseUrl = apiBaseUrl();

async function requestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim();
  if (host) {
    const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || (/^(localhost|127\.0\.0\.1)(:|$)/i.test(host) ? "http" : "https");
    return `${protocol}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://gallerista.app";
}
export type BillingUser = {
  studioPlanId?: string;
  studioPlanName?: string;
  studioPlanExpiresAt?: string;
  studioPlanBillingInterval?: "month"|"year";
  _id: string;
  name?: string;
  avatar?: string;
  planId?: string;
  planName?: string;
  storageLimitGb?: number;
  aiImageMetadataLimit?: number;
  aiImageMetadataUsed?: number;
  monthlyEmailLimit?: number;
  storageUsedBytes?: number;
  monthlyEmailsUsed?: number;
  planFeatures?: Record<string, boolean>;
  planBillingInterval?: "month" | "year";
  planExpiresAt?: string;
};

export type PlanPurchase = { productType?: "client-gallery"|"studio-manager"; expiresAt?: string; _id: string; planName: string; amount: number; billingInterval?: "month" | "year"; source: "admin" | "checkout" | "free"; status: "active" | "paid"; paymentProvider?: "stripe" | "paypal" | "admin" | "free"; createdAt: string };
export type BillingPaymentMethods = { stripe: boolean; paypal: boolean };

function normalizePlans(value: unknown): AdminPlan[] {
  if (!Array.isArray(value)) return [];
  return value.map((plan: Partial<AdminPlan> & { _id?: string }, index) => ({
    _id: String(plan?._id ?? index),
    name: String(plan?.name ?? "Untitled plan"),
    productType: plan?.productType ?? "client-gallery",
    studioContactLimit: Number(plan?.studioContactLimit ?? 0),
    studioProjectLimit: Number(plan?.studioProjectLimit ?? 0),
    studioProductLimit: Number(plan?.studioProductLimit ?? 0),
    studioQuestionnaireLimit: Number(plan?.studioQuestionnaireLimit ?? 0),
    studioQuoteLimit: Number(plan?.studioQuoteLimit ?? 0),
    studioMonthlyEmails: Number(plan?.studioMonthlyEmails ?? 0),
    subdomainLimit: Number(plan?.subdomainLimit ?? 1),
    videoMinutes: Number(plan?.videoMinutes ?? 0),
    videoQuality: plan?.videoQuality ?? "hd",
    storageGb: Number(plan?.storageGb ?? 0),
    galleryLimit: Number(plan?.galleryLimit ?? 0),
    aiImageMetadataLimit: Number(plan?.aiImageMetadataLimit ?? 0),
    monthlyEmails: Number(plan?.monthlyEmails ?? 0),
    priceMonthly: Number(plan?.priceMonthly ?? 0),
    yearlyEnabled: Boolean(plan?.yearlyEnabled),
    priceYearly: Number(plan?.priceYearly ?? 0),
    features: plan?.features ?? {},
    recommended: Boolean(plan?.recommended),
    sortOrder: Number(plan?.sortOrder ?? index),
    active: plan?.active ?? true,
    createdAt: plan?.createdAt,
  }));
}

async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (await cookies()).get("access_token")?.value;
  try {
    const payload = await fetchBackendJson<{ data?: T }>(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", access_token: token || "" },
      cache: "no-store",
    });
    return payload?.data as T;
  } catch (error) {
    if (error instanceof BackendRequestError && (error.statusCode === 401 || error.statusCode === 403)) redirect("/login");
    throw error;
  }
}

export async function getBillingOverview() {
  const [plans, user, paymentMethods] = await Promise.all([
    authedRequest<AdminPlan[]>("/billing/plans"),
    authedRequest<BillingUser>("/user/get-my-profile"),
    getPublicPaymentMethods(),
  ]);
  return { plans: plans.filter(plan => plan.productType !== "studio-manager"), user, paymentMethods };
}

export type StudioQuota = "contacts" | "products" | "questionnaires" | "quotes" | "projects" | "emails";
export type StudioSubscriptionData = {planId: string | null; planName:string; expiresAt:string|null; previousExpiresAt:string|null; activatedAt:string|null; billingInterval:"month"|"year"|null; status:"active"|"free"|"expired"; limits:Record<StudioQuota,number>; usage:Record<StudioQuota,number>; gallery:{planName:string; expiresAt:string|null; planId:string|null}};

export async function getStudioSubscription() {
  return authedRequest<StudioSubscriptionData>("/billing/studio-subscription");
}

export async function getPublicFreePlan(): Promise<AdminFreePlanSetting | null> {
  try {
    const response = await fetch(`${baseUrl}/billing/public/free-plan`, {cache:"no-store"});
    if (!response.ok) return null;
    return (await response.json()).data ?? null;
  } catch { return null; }
}

export async function getPurchaseHistory(productType?: "client-gallery"|"studio-manager") {
  const purchases=await authedRequest<PlanPurchase[]>("/billing/purchases");
  return productType?purchases.filter(p=>(p.productType??"client-gallery")===productType):purchases;
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

export async function checkoutPlan(planId: string, billingInterval: "month" | "year" = "month", paymentProvider?: "stripe" | "paypal", productType: "client-gallery" | "studio-manager" = "client-gallery") {
  const origin = await requestOrigin();
  const destination = productType === "studio-manager" ? "/dashboard/studio-management/subscription" : "/dashboard/client-gallery/storage";
  const successUrl = paymentProvider === "paypal"
    ? `${origin}${destination}?plan=success&provider=paypal`
    : `${origin}${destination}?plan=success&session_id={CHECKOUT_SESSION_ID}`;
  const data = await authedRequest<{ checkoutUrl?: string | null; activated?: boolean; plan?: AdminPlan; paymentProvider?: "stripe" | "paypal"; paypalOrderId?: string }>(`/billing/plans/${planId}/checkout`, {
    method: "POST",
    body: JSON.stringify({
      successUrl,
      cancelUrl: `${origin}${destination}?plan=cancel`,
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

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CreditCard, Loader2, Search } from "lucide-react";
import { checkoutPlan } from "@/actions/billing";
import type { AdminPlan } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const featureLabels: Record<string, string> = {
  pinSet: "PIN set",
  downloadLimit: "Download limit",
  coverImage: "Cover image",
  layouts: "Layouts",
  advancedDesign: "Advanced design",
  store: "Store",
  marketingEmails: "Marketing email",
};

export function PlansPage({ plans }: { plans: AdminPlan[] }) {
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) =>
      [plan.name, String(plan.storageGb), String(plan.monthlyEmails)].some((item) => item.toLowerCase().includes(term)),
    );
  }, [plans, query]);

  const buy = (planId: string) => {
    setPendingId(planId);
    setError("");
    startTransition(async () => {
      try {
        const result = await checkoutPlan(planId);
        if (result.checkoutUrl) window.location.href = result.checkoutUrl;
        else setError("Stripe checkout URL missing");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout failed");
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#f6f6f3] px-5 py-7 text-[#151515] md:px-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#555]">
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <header className="mt-10 flex flex-wrap items-end justify-between gap-5 border-b pb-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#777]">Monthly Plans</p>
          <h1 className="mt-3 text-4xl font-medium">Choose plan</h1>
        </div>
        <div className="flex h-11 w-full max-w-[360px] items-center border bg-white px-3">
          <Search className="mr-2 size-4 text-[#777]" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plans" className="h-10 rounded-none border-0 px-0 shadow-none focus-visible:ring-0" />
        </div>
      </header>
      {error && <p className="mt-5 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">{error}</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((plan) => (
          <article key={plan._id} className="border bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{plan.name}</h2>
                <p className="mt-2 text-sm text-[#666]">${Number(plan.priceMonthly ?? 0)}/month</p>
              </div>
              <CreditCard className="size-5 text-[#00a997]" />
            </div>
            <div className="mt-8 grid gap-3 text-sm">
              <div className="flex justify-between"><span>Storage</span><b>{plan.storageGb} GB</b></div>
              <div className="flex justify-between"><span>Emails</span><b>{plan.monthlyEmails}/month</b></div>
            </div>
            <div className="mt-6 grid gap-2">
              {Object.entries(featureLabels).filter(([key]) => plan.features?.[key]).map(([key, label]) => (
                <p key={key} className="flex items-center gap-2 text-sm text-[#333]">
                  <Check className="size-4 text-[#00a997]" />
                  {label}
                </p>
              ))}
            </div>
            <Button className="mt-6 h-11 w-full rounded-none bg-[#111] text-white" disabled={pending} onClick={() => buy(plan._id)}>
              {pending && pendingId === plan._id ? <Loader2 className="size-4 animate-spin" /> : "Buy Plan"}
            </Button>
          </article>
        ))}
      </div>
    </main>
  );
}

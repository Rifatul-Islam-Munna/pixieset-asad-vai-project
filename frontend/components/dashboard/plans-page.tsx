"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Search } from "lucide-react";
import { checkoutPlan } from "@/actions/billing";
import type { AdminPlan } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
      [plan.name, String(plan.storageGb), String(plan.monthlyEmails), String(plan.priceMonthly)]
        .some((item) => item.toLowerCase().includes(term)),
    );
  }, [plans, query]);

  const recommendedId = useMemo(() => {
    const pro = filtered.find((plan) => plan.name.toLowerCase().includes("pro"));
    return pro?._id ?? filtered[Math.min(3, Math.max(filtered.length - 1, 0))]?._id ?? "";
  }, [filtered]);

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
    <main className="min-h-screen bg-white px-5 py-7 text-[#1d1d1d] md:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#555]">
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <header className="mt-10 flex flex-wrap items-end justify-between gap-5 border-b pb-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#0a9c8b]">Pricing</p>
            <h1 className="mt-3 text-4xl font-medium">Choose your plan</h1>
          </div>
          <div className="flex h-11 w-full max-w-[360px] items-center border bg-white px-3">
            <Search className="mr-2 size-4 text-[#777]" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plans" className="h-10 rounded-none border-0 px-0 shadow-none focus-visible:ring-0" />
          </div>
        </header>

        {error && <p className="mt-5 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">{error}</p>}

        {!filtered.length ? (
          <div className="mt-8 border bg-white p-8 text-sm font-semibold text-[#777]">No plans found.</div>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <div
              className="grid min-w-[1100px] border-l border-t"
              style={{ gridTemplateColumns: `210px repeat(${filtered.length}, minmax(170px, 1fr))` }}
            >
              <div className="border-b border-r bg-white" />
              {filtered.map((plan) => {
                const recommended = plan._id === recommendedId;
                const price = Number(plan.priceMonthly ?? 0);
                return (
                  <div key={plan._id} className={cn("border-b border-r p-5", recommended ? "bg-[#f1faf8]" : "bg-white")}>
                    <div className="h-6 text-xs font-bold uppercase tracking-[0.18em] text-[#0a9c8b]">
                      {recommended ? "Recommended" : ""}
                    </div>
                    <h2 className="mt-3 text-xl font-medium">{plan.name}</h2>
                    <p className="mt-5 flex items-end gap-1">
                      <span className="text-5xl font-medium tracking-normal">${price.toLocaleString()}</span>
                      <span className="pb-2 text-sm">/mo</span>
                    </p>
                    <p className="mt-6 min-h-5 text-xs font-semibold text-[#aaa]">
                      {price > 0 ? "Billed monthly" : "Billed Never"}
                    </p>
                    <Button className="mt-9 h-11 w-full rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]" disabled={pending} onClick={() => buy(plan._id)}>
                      {pending && pendingId === plan._id ? <Loader2 className="size-4 animate-spin" /> : price > 0 ? "Start Plan" : "Start Free"}
                    </Button>
                  </div>
                );
              })}

              <SectionCell title="Client Gallery" />
              {filtered.map((plan) => <BlankCell key={`${plan._id}-section`} recommended={plan._id === recommendedId} />)}

              <LabelCell label="Photo storage" />
              {filtered.map((plan) => (
                <ValueCell key={`${plan._id}-storage`} recommended={plan._id === recommendedId} primary={`${Number(plan.storageGb ?? 0).toLocaleString()} GB`} secondary={`${Math.max(1, Number(plan.storageGb ?? 0) * 1000).toLocaleString()}+ photos`} />
              ))}

              <LabelCell label="Monthly emails" />
              {filtered.map((plan) => (
                <ValueCell key={`${plan._id}-emails`} recommended={plan._id === recommendedId} primary={`${Number(plan.monthlyEmails ?? 0).toLocaleString()}`} secondary="emails / month" />
              ))}

              {Object.entries(featureLabels).map(([key, label]) => (
                <Row key={key} plans={filtered} recommendedId={recommendedId} label={label} featureKey={key} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ plans, recommendedId, label, featureKey }: {
  plans: AdminPlan[];
  recommendedId: string;
  label: string;
  featureKey: string;
}) {
  return (
    <>
      <LabelCell label={label} />
      {plans.map((plan) => (
        <CheckCell key={`${plan._id}-${featureKey}`} active={Boolean(plan.features?.[featureKey])} recommended={plan._id === recommendedId} />
      ))}
    </>
  );
}

function SectionCell({ title }: { title: string }) {
  return (
    <div className="flex h-20 items-center gap-3 border-b border-r bg-white px-5 text-lg font-semibold">
      <span className="size-8 rounded-full bg-[#22bda7]" />
      {title}
    </div>
  );
}

function LabelCell({ label }: { label: string }) {
  return <div className="flex min-h-20 items-center border-b border-r bg-white px-5 text-sm font-medium">{label}</div>;
}

function BlankCell({ recommended }: { recommended: boolean }) {
  return <div className={cn("border-b border-r", recommended ? "bg-[#f1faf8]" : "bg-white")} />;
}

function ValueCell({ primary, secondary, recommended }: {
  primary: string;
  secondary: string;
  recommended: boolean;
}) {
  return (
    <div className={cn("flex min-h-20 flex-col items-center justify-center border-b border-r px-4 text-center", recommended ? "bg-[#f1faf8]" : "bg-white")}>
      <b className="text-sm">{primary}</b>
      <span className="mt-1 text-sm text-[#555]">{secondary}</span>
    </div>
  );
}

function CheckCell({ active, recommended }: { active: boolean; recommended: boolean }) {
  return (
    <div className={cn("flex min-h-20 items-center justify-center border-b border-r px-4", recommended ? "bg-[#f1faf8]" : "bg-white")}>
      {active ? <Check className="size-5 text-[#20a786]" /> : <span className="text-lg text-[#c9c9c9]">-</span>}
    </div>
  );
}

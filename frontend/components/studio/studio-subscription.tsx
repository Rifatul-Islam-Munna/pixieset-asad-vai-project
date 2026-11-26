"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowUpRight, CalendarDays, CreditCard, Loader2 } from "lucide-react";
import { confirmPayPalPlanCheckout, confirmPlanCheckout, getPurchaseHistory, getPublicPlans, getStudioSubscription, type StudioSubscriptionData, type StudioQuota, type PlanPurchase } from "@/actions/billing";

import type { AdminPlan } from "@/actions/admin";

const quotaLabels: Record<StudioQuota,string> = {
  contacts:"Contacts", projects:"Projects", products:"Products / session types",
  questionnaires:"Questionnaires", quotes:"Quotes", emails:"Emails this month",
};

function date(value?:string|null) {
  return value ? new Date(value).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}) : "No expiry";
}

export function StudioSubscription() {
  const [data,setData]=useState<StudioSubscriptionData|null>(null);
  const [history,setHistory]=useState<PlanPurchase[]>([]);
  const [available,setAvailable]=useState<AdminPlan[]>([]);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [pending,startTransition]=useTransition();

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      const params=new URLSearchParams(window.location.search);
      if(params.get("plan")==="success"){
        try {
          if(params.get("provider")==="paypal"&&params.get("token")) await confirmPayPalPlanCheckout(params.get("token")!);
          else if(params.get("session_id")) await confirmPlanCheckout(params.get("session_id")!);
          else throw new Error("Payment reference missing. Please contact support if you were charged.");
          if(!cancelled) setMessage("Your payment has been confirmed.");
          window.history.replaceState(null,"",window.location.pathname);
        }catch(err){if(!cancelled)setError(err instanceof Error?err.message:"Payment could not be confirmed.");}
      } else if(params.get("plan")==="cancel") {
        if(!cancelled)setMessage("Checkout cancelled. Your current plan is unchanged.");
        window.history.replaceState(null,"",window.location.pathname);
      }
      try{
        const [current,purchases,publicPlans]=await Promise.all([getStudioSubscription(),getPurchaseHistory('studio-manager'),getPublicPlans()]);
        if(!cancelled){setData(current);setHistory(purchases);setAvailable(publicPlans.plans.filter(p=>p.productType==='studio-manager'&&p.active));}
      }catch(err){if(!cancelled)setError(err instanceof Error?err.message:"Could not load subscription.");}
    }
    void load();
    return()=>{cancelled=true;};
  },[]);

  const refresh=()=>startTransition(async()=>{
    try {setError(""); const [current,purchases,publicPlans]=await Promise.all([getStudioSubscription(),getPurchaseHistory('studio-manager'),getPublicPlans()]);setData(current);setHistory(purchases);setAvailable(publicPlans.plans.filter(p=>p.productType==='studio-manager'&&p.active));}
    catch(err){setError(err instanceof Error?err.message:"Could not load subscription.");}
  });

  return <section className="mx-auto max-w-5xl space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#827b90]">Billing</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">My subscription</h1><p className="mt-2 text-sm text-[#817b89]">Manage your Studio Manager plan independently from Client Gallery.</p></div>
      <Link href="/pricing?product=studio-manager" className="inline-flex h-10 items-center gap-2 bg-[#6337d8] px-5 text-sm font-semibold text-white hover:bg-[#532ac2]">Compare plans <ArrowUpRight className="size-4"/></Link>
    </header>
    {message&&<div role="status" className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
    {error&&<div role="alert" className="flex items-center justify-between gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={()=>new URLSearchParams(window.location.search).get('plan')==='success'?window.location.reload():refresh()} disabled={pending} className="font-semibold underline">Retry</button></div>}
    {!data?(!error&&<div className="flex items-center gap-2 py-12 text-sm text-[#817b89]"><Loader2 className="size-4 animate-spin"/> Loading subscription…</div>):<>
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="border border-[#ded5f5] bg-[#faf8ff] p-6">
          <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-semibold text-[#6337d8]"><CalendarDays className="size-4"/> Studio Manager</p><span className="border border-[#ded5f5] bg-white px-2 py-1 text-xs font-semibold capitalize">{data.status==="expired"?"Free · expired":data.status}</span></div>
          <h2 className="mt-6 text-3xl font-semibold">{data.planName}</h2>
          <p className="mt-3 text-sm text-[#817b89]">{data.billingInterval?data.billingInterval==="year"?"Yearly access":"Monthly access":"Free access"}</p>
          {data.activatedAt&&<p className="mt-2 text-sm">Activated: {date(data.activatedAt)}</p>}
          <p className="mt-2 text-sm">{data.expiresAt?"Expires: "+date(data.expiresAt):data.previousExpiresAt?"Previous plan expired: "+date(data.previousExpiresAt):"No expiration date"}</p>
          <Link href="/pricing?product=studio-manager" className="mt-5 inline-flex text-sm font-semibold text-[#6337d8] hover:underline">{data.planId?"Change or renew plan":"Upgrade plan"}</Link>
        </article>
        <article className="border border-[#e8e5ee] p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#817b89]"><CreditCard className="size-4"/> Client Gallery</p>
          <h2 className="mt-6 text-3xl font-semibold">{data.gallery.planName}</h2>
          <p className="mt-3 text-sm text-[#817b89]">Separate subscription</p>
          <p className="mt-2 text-sm">{data.gallery.expiresAt?"Expires: "+date(data.gallery.expiresAt):"No expiration date"}</p>
          <Link href="/dashboard/client-gallery/storage" className="mt-5 inline-flex text-sm font-semibold text-[#6337d8] hover:underline">Manage Client Gallery</Link>
        </article>
      </div>
      <section className="border border-[#e8e5ee] p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Plan usage</h2><p className="mt-1 text-xs text-[#817b89]">Record limits are totals. Email allowance resets monthly in UTC.</p></div><button className="text-sm font-semibold text-[#6337d8]" onClick={refresh} disabled={pending}>{pending?"Refreshing…":"Refresh"}</button></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(quotaLabels) as StudioQuota[]).map(key=>{
            const used=data.usage[key]??0,limit=data.limits[key]??0,unlimited=key!=="emails"&&limit===0;
            const percent=unlimited?0:limit>0?Math.min(100,used/limit*100):100;
            return <div key={key} className="border border-[#eeeaf3] p-4"><p className="text-sm text-[#817b89]">{quotaLabels[key]}</p><p className="mt-2 text-lg font-semibold">{used.toLocaleString()} <span className="text-sm font-normal text-[#817b89]">/ {unlimited?"Unlimited":limit.toLocaleString()}</span></p>{!unlimited&&<div className="mt-3 h-1.5 overflow-hidden bg-[#f1eef6]"><div className={percent>=100?"h-full bg-amber-500":"h-full bg-[#6337d8]"} style={{width:percent+"%"}}/></div>}</div>;
          })}
        </div>
      </section>
      <section className="border border-[#e8e5ee] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Available Studio Manager plans</h2><p className="mt-1 text-xs text-[#817b89]">Choose or renew a plan. Payments cover a fixed access period; no automatic charge.</p></div><Link href="/pricing?product=studio-manager" className="text-sm font-semibold text-[#6337d8]">View comparison</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{available.map(plan=><div key={plan._id} className="border border-[#e8e5ee] p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold">{plan.name}</h3>{plan._id===data.planId&&<span className="text-xs text-[#6337d8]">Current</span>}</div><p className="mt-3 text-2xl font-semibold">€{Number(plan.priceMonthly??0).toLocaleString()}<span className="text-xs font-normal text-[#817b89]"> / month</span></p>{plan.yearlyEnabled&&<p className="mt-1 text-xs text-[#817b89]">€{Number(plan.priceYearly??0).toLocaleString()} / year</p>}<Link href="/pricing?product=studio-manager" className="mt-4 inline-flex text-sm font-semibold text-[#6337d8]">{plan._id===data.planId?'Renew':'Compare & choose'}</Link></div>)}</div>{available.length===0&&<p className="mt-3 text-sm text-[#817b89]">No paid Studio Manager plans are currently available.</p>}</section>
      <section className="border border-[#e8e5ee] p-6"><h2 className="text-lg font-semibold">Purchase history</h2>{history.length===0?<p className="mt-4 text-sm text-[#817b89]">No Studio Manager purchases yet.</p>:<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><thead className="border-b text-xs text-[#817b89]"><tr><th className="py-3">Plan</th><th>Purchased</th><th>Amount</th><th>Expiry</th></tr></thead><tbody>{history.map(p=><tr key={p._id} className="border-b last:border-0"><td className="py-3 font-medium">{p.planName}</td><td>{date(p.createdAt)}</td><td>€{Number(p.amount).toFixed(2)}</td><td>{date(p.expiresAt)}</td></tr>)}</tbody></table></div>}</section>
    </>}
  </section>;
}

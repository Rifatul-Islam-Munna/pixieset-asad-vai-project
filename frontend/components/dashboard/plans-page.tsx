"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Check, Images, Loader2, Search } from "lucide-react";
import { checkoutPlan, getPublicPaymentMethods, type BillingPaymentMethods } from "@/actions/billing";
import type { AdminPlan, AdminFreePlanSetting } from "@/actions/admin";
import { cn } from "@/lib/utils";

type Product = "client-gallery" | "studio-manager";
type ComparisonRow = {label:string;value:(plan:AdminPlan)=>string|boolean};
const formatMoney=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2});
const limit=(n?:number)=>Number(n??0)===0?"Unlimited":Number(n).toLocaleString();
const studioRows:ComparisonRow[]=[
  {label:"Contacts",value:p=>limit(p.studioContactLimit)},
  {label:"Projects",value:p=>limit(p.studioProjectLimit)},
  {label:"Products / session types",value:p=>limit(p.studioProductLimit)},
  {label:"Questionnaires",value:p=>limit(p.studioQuestionnaireLimit)},
  {label:"Quotes",value:p=>limit(p.studioQuoteLimit)},
  {label:"Emails per month",value:p=>Number(p.studioMonthlyEmails??0).toLocaleString()},
];
const galleryRows:ComparisonRow[]=[
  {label:"Photo storage",value:p=>formatMoney(p.storageGb)+" GB"},
  {label:"Galleries",value:p=>limit(p.galleryLimit)},
  {label:"Monthly emails",value:p=>Number(p.monthlyEmails??0).toLocaleString()},
  {label:"AI metadata images",value:p=>p.features?.aiImageMetadata?limit(p.aiImageMetadataLimit)+" / month":"Not included"},
  {label:"Video uploads",value:p=>Number(p.videoMinutes??0)>0?formatMoney(p.videoMinutes??0)+" min · "+(p.videoQuality==="4k"?"4K":"HD"):"Not included"},
  {label:"PIN set",value:p=>Boolean(p.features?.pinSet)},
  {label:"Download limit",value:p=>Boolean(p.features?.downloadLimit)},
  {label:"Store",value:p=>Boolean(p.features?.store)},
  {label:"Marketing email",value:p=>Boolean(p.features?.marketingEmails)},
];
const products=[{key:"client-gallery",label:"Client Gallery",icon:Images},{key:"studio-manager",label:"Studio Manager",icon:BriefcaseBusiness}] as const;
function freeStudio(free:AdminFreePlanSetting):AdminPlan{
  return {_id:"studio-free",name:"Free",productType:"studio-manager",storageGb:0,monthlyEmails:0,priceMonthly:0,active:true,sortOrder:-1,studioContactLimit:free.studioContactLimit,studioProjectLimit:free.studioProjectLimit,studioProductLimit:free.studioProductLimit,studioQuestionnaireLimit:free.studioQuestionnaireLimit,studioQuoteLimit:free.studioQuoteLimit,studioMonthlyEmails:free.studioMonthlyEmails};
}

export function PlansPage({plans,freePlan,loadError=""}:{plans:AdminPlan[];freePlan?:AdminFreePlanSetting|null;loadError?:string}){
  const [product,setProduct]=useState<Product>("client-gallery");
  const [interval,setInterval]=useState<"month"|"year">("month");
  const [query,setQuery]=useState("");
  const [provider,setProvider]=useState<"stripe"|"paypal">("stripe");
  const [methods,setMethods]=useState<BillingPaymentMethods>({stripe:false,paypal:false});
  const [pending,startTransition]=useTransition();
  const [pendingId,setPendingId]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get("product")==="studio-manager"){
      // Read the initial tab from the URL without requiring a server-side searchParams boundary.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProduct("studio-manager");
    }
    void getPublicPaymentMethods().then(m=>{setMethods(m);if(m.paypal&&!m.stripe)setProvider("paypal");});
  },[]);
  const filtered=useMemo(()=>{
    const selected=plans.filter(p=>p.active&&(p.productType??"client-gallery")===product);
    if(product==="studio-manager"&&freePlan)selected.push(freeStudio(freePlan));
    if(product==="client-gallery"&&freePlan&&!selected.some(p=>Number(p.priceMonthly??0)===0))selected.push({_id:'gallery-free',name:'Free',productType:'client-gallery',storageGb:freePlan.storageGb,galleryLimit:10,subdomainLimit:freePlan.subdomainLimit,monthlyEmails:freePlan.monthlyEmails,priceMonthly:0,active:true,sortOrder:-1,features:{marketingEmails:freePlan.monthlyEmails>0}});
    return selected.filter(p=>p.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0));
  },[plans,freePlan,product,query]);
  const rows=product==="studio-manager"?studioRows:galleryRows;
  const isFree=(p:AdminPlan)=>Number(p.priceMonthly??0)===0&&!p.yearlyEnabled;
  const available=(p:AdminPlan)=>isFree(p)||interval==="month"||Boolean(p.yearlyEnabled&&Number(p.priceYearly??0)>0);
  const price=(p:AdminPlan)=>isFree(p)?0:interval==="year"?Number(p.priceYearly??0)/12:Number(p.priceMonthly??0);
  const buy=(plan:AdminPlan)=>{
    setPendingId(plan._id);setError("");
    if(plan._id==="studio-free"||plan._id==="gallery-free"){window.location.href=plan._id==='studio-free'?'/dashboard/studio-management/subscription':'/dashboard/client-gallery/storage';return;}
    startTransition(async()=>{
      try{
        const result=await checkoutPlan(plan._id,isFree(plan)?"month":interval,provider,product);
        if(result.checkoutUrl)window.location.href=result.checkoutUrl;
        else if(result.activated)window.location.href=product==="studio-manager"?"/dashboard/studio-management/subscription":"/dashboard/client-gallery/storage";
        else setError("Checkout URL missing.");
      }catch(err){setError(err instanceof Error?err.message:"Checkout failed.");}
    });
  };
  const renderValue=(value:string|boolean)=>typeof value==="boolean"?(value?<Check className="mx-auto size-4 text-[#6337d8]" aria-label="Included"/>:<span className="text-[#aaa]">—</span>):value;
  const planHeader=(p:AdminPlan)=><>
    <div className="h-5 text-xs font-semibold uppercase tracking-[.12em] text-[#6337d8]">{p.recommended?"Recommended":""}</div>
    <h2 className="mt-3 text-xl font-medium">{p.name}</h2>
    <p className="mt-5 flex items-baseline gap-1">{available(p)?<><span className="text-4xl font-semibold tracking-tight">€{formatMoney(price(p))}</span><span className="text-sm text-[#777]">/mo</span></>:<span className="text-sm font-medium">Not available yearly</span>}</p>
    <p className="mt-3 min-h-8 text-xs text-[#777]">{isFree(p)?"No payment required":interval==="year"&&available(p)?"€"+formatMoney(p.priceYearly??0)+" for 365 days":interval==="month"?"30-day access":"Choose monthly billing"}</p>
    <button type="button" disabled={pending||!available(p)||(!isFree(p)&&!methods.stripe&&!methods.paypal)} onClick={()=>buy(p)} className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-[#6337d8] px-3 text-sm font-semibold text-white transition hover:bg-[#532ac2] disabled:cursor-not-allowed disabled:opacity-50">{pending&&pendingId===p._id?<Loader2 className="size-4 animate-spin"/>:isFree(p)?"Start Free":"Choose Plan"}</button>
  </>;
  return <main className="min-h-screen bg-white px-4 py-8 text-[#222] sm:px-8">
    <div className="mx-auto max-w-[1500px]">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#666] hover:text-black"><ArrowLeft className="size-4"/> Back</Link>
      <header className="py-8 text-center"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose your plan</h1><p className="mt-3 text-sm text-[#777]">Choose Client Gallery, Studio Manager, or both. Each product has its own plan.</p></header>
      <div role="tablist" aria-label="Products" className="mx-auto flex w-fit max-w-full border-b border-[#e9e6ed]">
        {products.map(({key,label,icon:Icon})=><button role="tab" aria-selected={product===key} key={key} onClick={()=>{setProduct(key);setQuery("");setError("");}} className={cn("flex items-center gap-2 border-b-2 px-5 py-4 text-sm font-semibold transition sm:px-10 sm:text-base",product===key?"border-[#6337d8] text-[#222]":"border-transparent text-[#85818b] hover:text-[#6337d8]")}><span className={cn("grid size-8 shrink-0 place-items-center rounded-full",key==="client-gallery"?"bg-[#e2f5f4] text-[#008b88]":"bg-[#e3f6e8] text-[#159547]")}><Icon className="size-4"/></span>{label}</button>)}
      </div>
      <div className="my-7 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex border border-[#e5e0ed] p-1">{(["month","year"] as const).map(value=><button key={value} onClick={()=>setInterval(value)} className={cn("px-5 py-2 text-sm font-medium",interval===value?"bg-[#6337d8] text-white":"text-[#666] hover:bg-[#f7f5fa]")}>{value==="month"?"Monthly":"Yearly"}</button>)}</div>
        <div className="flex flex-wrap items-center gap-3">
          {(methods.stripe||methods.paypal)&&<select aria-label="Payment method" value={provider} onChange={e=>setProvider(e.target.value as "stripe"|"paypal")} className="h-10 border border-[#e5e0ed] px-3 text-sm">{methods.stripe&&<option value="stripe">Stripe</option>}{methods.paypal&&<option value="paypal">PayPal</option>}</select>}
          <label className="flex h-10 items-center gap-2 border border-[#e5e0ed] px-3"><Search className="size-4 text-[#888]"/><input aria-label="Search plans" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search plans" className="w-32 bg-transparent text-sm outline-none"/></label>
        </div>
      </div>
      {(loadError||error)&&<p role="alert" className="mb-5 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error||loadError}</p>}
      {filtered.length===0?<div className="border p-8 text-center text-sm text-[#777]">No plans are currently available for this product.</div>:<>
        <div className="grid gap-4 md:hidden">{filtered.map(p=><article key={p._id} className={cn("border p-5",p.recommended?"border-[#d9cffa] bg-[#faf8ff]":"border-[#e9e6ed]")}>{planHeader(p)}<dl className="mt-5 divide-y border-t">{rows.map(row=><div key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm"><dt className="text-[#666]">{row.label}</dt><dd className="font-medium">{renderValue(row.value(p))}</dd></div>)}</dl></article>)}</div>
        <div className="hidden overflow-x-auto md:block"><div className="grid border-l border-t border-[#e9e6ed]" style={{gridTemplateColumns:"200px repeat("+filtered.length+",minmax(185px,1fr))",minWidth:200+filtered.length*185}}>
          <div className="border-b border-r border-[#e9e6ed]"/>
          {filtered.map(p=><article key={p._id} className={cn("border-b border-r border-[#e9e6ed] p-5",p.recommended&&"bg-[#f7f3ff]")}>{planHeader(p)}</article>)}
          <div className="flex min-h-16 items-center border-b border-r border-[#e9e6ed] p-4 font-semibold">{product==="studio-manager"?"Studio Manager":"Client Gallery"}</div>
          {filtered.map(p=><div key={p._id} className={cn("border-b border-r border-[#e9e6ed]",p.recommended&&"bg-[#f7f3ff]")}/>)}
          {rows.flatMap(row=>[<div key={row.label} className="flex min-h-16 items-center border-b border-r border-[#e9e6ed] px-4 text-sm">{row.label}</div>,...filtered.map(p=><div key={row.label+p._id} className={cn("flex min-h-16 items-center justify-center border-b border-r border-[#e9e6ed] px-3 text-center text-sm font-medium",p.recommended&&"bg-[#f7f3ff]")}>{renderValue(row.value(p))}</div>)])}
        </div></div>
      </>}
    </div>
  </main>;
}

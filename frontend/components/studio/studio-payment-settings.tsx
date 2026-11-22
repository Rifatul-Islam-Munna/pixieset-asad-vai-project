"use client";

import Link from "next/link";
import {useEffect,useState,type FormEvent} from "react";
import {CheckCircle2,CreditCard,ExternalLink,Loader2,ShieldCheck,Wallet,XCircle} from "lucide-react";
import {toast} from "sonner";
import {
  studioPaymentSettings,studioSavePaymentSettings,studioTestPayPal,
  type StudioPaymentSettings,type StudioPaymentUpdate,
} from "@/actions/studio-payments";

const INPUT="mt-2 h-11 w-full border border-[#e8e3ed] bg-white px-3 text-xs outline-none focus:border-[#6337d8]";
const BUTTON="inline-flex h-10 items-center justify-center gap-2 bg-[#6337d8] px-5 text-xs font-semibold text-white disabled:opacity-45";

export function StudioPaymentSettings(){
  const [settings,setSettings]=useState<StudioPaymentSettings|null>(null);
  const [stripeEnabled,setStripeEnabled]=useState(false);
  const [publishable,setPublishable]=useState("");
  const [stripeSecret,setStripeSecret]=useState("");
  const [paypalEnabled,setPaypalEnabled]=useState(false);
  const [paypalEnv,setPaypalEnv]=useState<"sandbox"|"live">("sandbox");
  const [paypalClientId,setPaypalClientId]=useState("");
  const [paypalSecret,setPaypalSecret]=useState("");
  const [webhookId,setWebhookId]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [testing,setTesting]=useState(false);
  const [error,setError]=useState("");
  const apply=(data:StudioPaymentSettings)=>{
    setSettings(data);
    setStripeEnabled(data.stripe.enabled);
    setPublishable(data.stripe.publishableKey||"");
    setStripeSecret("");
    setPaypalEnabled(data.paypal.enabled);
    setPaypalEnv(data.paypal.environment);
    setPaypalClientId(data.paypal.clientId||"");
    setPaypalSecret("");
    setWebhookId("");
  };
  useEffect(()=>{
    let alive=true;
    void studioPaymentSettings().then(data=>{if(alive)apply(data)})
      .catch(err=>{if(alive)setError(err instanceof Error?err.message:"Unable to load payment settings")})
      .finally(()=>{if(alive)setLoading(false)});
    return ()=>{alive=false;};
  },[]);
  const save=async(event:FormEvent)=>{
    event.preventDefault();setSaving(true);setError("");
    const data:StudioPaymentUpdate={
      stripe:{enabled:stripeEnabled,publishableKey:publishable.trim(),
        ...(stripeSecret.trim()?{secretKey:stripeSecret.trim()}:{})},
      paypal:{enabled:paypalEnabled,environment:paypalEnv,clientId:paypalClientId.trim(),
        ...(paypalSecret.trim()?{clientSecret:paypalSecret.trim()}:{}),
        ...(webhookId.trim()?{webhookId:webhookId.trim()}:{})},
    };
    try{const updated=await studioSavePaymentSettings(data);apply(updated);toast.success("Shared Store and Studio payment settings saved")}
    catch(err){setError(err instanceof Error?err.message:"Could not save payment settings")}
    finally{setSaving(false);}
  };
  const testPayPal=async()=>{
    setTesting(true);setError("");
    try{
      const result=await studioTestPayPal();
      toast.success("PayPal "+result.environment+" credentials accepted");
    }catch(err){setError(err instanceof Error?err.message:"PayPal connection failed")}
    finally{setTesting(false);}
  };
  return <section className="mt-9 border border-[#eae5ee] bg-white p-6 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#958a9e]">Studio Manager · Payments</p>
        <h2 className="mt-2 text-[19px] font-medium">Stripe & PayPal</h2>
        <p className="mt-2 max-w-xl text-xs leading-6 text-[#89818d]">
          Studio Manager uses the exact same merchant credentials as your Store Gallery.
          Connect them here or in Store settings. Changes here also affect Store checkout.
          Your private keys are never displayed after saving.
        </p>
      </div>
      <Link href="/dashboard/store-gallery" className="inline-flex items-center gap-2 text-xs font-semibold text-[#6337d8] hover:underline">
        Open Store Gallery <ExternalLink className="size-3.5"/>
      </Link>
    </div>
    {loading?<p className="mt-7 flex items-center gap-2 text-xs text-[#999]"><Loader2 className="size-4 animate-spin"/> Loading shared payment accounts…</p>:
    <form onSubmit={e=>void save(e)} className="mt-7 space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border border-[#ede9f1] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2"><CreditCard className="size-5 text-[#6353be]"/><h3 className="text-sm font-semibold">Stripe</h3></div>
            <span className={"flex items-center gap-1 text-[11px] "+(settings?.stripe.ready?"text-green-700":"text-[#968b9b]")}>
              {settings?.stripe.ready?<CheckCircle2 className="size-3.5"/>:<XCircle className="size-3.5"/>}
              {settings?.stripe.ready?"Configured in Store":"Not configured"}
            </span>
          </div>
          <label className="mt-5 flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={stripeEnabled} onChange={e=>setStripeEnabled(e.target.checked)}/>
            Enable Stripe for Store and Studio
          </label>
          <label className="mt-5 block text-xs font-semibold">Publishable key
            <input className={INPUT} autoComplete="off" spellCheck={false} value={publishable}
              onChange={e=>setPublishable(e.target.value)} placeholder="pk_test_... or pk_live_..."/>
          </label>
          <label className="mt-4 block text-xs font-semibold">Secret key
            <input className={INPUT} type="password" autoComplete="new-password" spellCheck={false}
              value={stripeSecret} onChange={e=>setStripeSecret(e.target.value)}
              placeholder={settings?.stripe.hasSecret?"Key saved • leave blank to keep":"sk_test_... or sk_live_..."}/>
          </label>
          <p className="mt-4 text-[11px] text-[#948b99]">Test and live keys must belong to the same Stripe mode.</p>
        </div>
        <div className="border border-[#ede9f1] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2"><Wallet className="size-5 text-[#6353be]"/><h3 className="text-sm font-semibold">PayPal</h3></div>
            <span className={"flex items-center gap-1 text-[11px] "+(settings?.paypal.ready?"text-green-700":"text-[#968b9b]")}>
              {settings?.paypal.ready?<CheckCircle2 className="size-3.5"/>:<XCircle className="size-3.5"/>}
              {settings?.paypal.ready?"Configured in Store":"Not configured"}
            </span>
          </div>
          <label className="mt-5 flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={paypalEnabled} onChange={e=>setPaypalEnabled(e.target.checked)}/>
            Enable PayPal for Store and Studio
          </label>
          <label className="mt-5 block text-xs font-semibold">Environment
            <select className={INPUT} value={paypalEnv} onChange={e=>setPaypalEnv(e.target.value as "sandbox"|"live")}>
              <option value="sandbox">Sandbox (test)</option><option value="live">Live payments</option>
            </select>
          </label>
          <label className="mt-4 block text-xs font-semibold">Client ID
            <input className={INPUT} autoComplete="off" spellCheck={false} value={paypalClientId}
              onChange={e=>setPaypalClientId(e.target.value)} placeholder="PayPal REST Client ID"/>
          </label>
          <label className="mt-4 block text-xs font-semibold">Client secret
            <input className={INPUT} type="password" autoComplete="new-password" spellCheck={false}
              value={paypalSecret} onChange={e=>setPaypalSecret(e.target.value)}
              placeholder={settings?.paypal.hasSecret?"Secret saved • leave blank to keep":"PayPal REST client secret"}/>
          </label>
          <label className="mt-4 block text-xs font-semibold">Webhook ID (optional)
            <input className={INPUT} value={webhookId} onChange={e=>setWebhookId(e.target.value)}
              placeholder={settings?.paypal.hasWebhookId?"Saved • leave blank to keep":"PayPal webhook ID"}/>
          </label>
          <button type="button" disabled={testing||saving||!settings?.paypal.ready} onClick={()=>void testPayPal()}
            className="mt-4 text-xs font-semibold text-[#6337d8] disabled:text-[#a99faf]">
            {testing?"Testing…":"Test saved PayPal connection"}
          </button>
        </div>
      </div>
      {error&&<p role="alert" className="bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#eeeaf1] pt-5">
        <p className="flex max-w-[680px] items-center gap-2 text-[11px] leading-5 text-[#8b8291]">
          <ShieldCheck className="size-4 shrink-0 text-[#6337d8]"/> Studio and Store use one account-owned configuration. Online invoice payments are available only after the selected gateway is configured and enabled.
        </p>
        <button type="submit" disabled={saving} className={BUTTON}>{saving?<Loader2 className="size-4 animate-spin"/>:null}{saving?"Saving…":"Save Payment Settings"}</button>
      </div>
    </form>}
  </section>;
}

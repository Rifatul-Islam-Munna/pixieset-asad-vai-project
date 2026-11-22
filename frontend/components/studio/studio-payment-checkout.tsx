"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";
import {CheckCircle2,CreditCard,Loader2,ShieldCheck,Wallet} from "lucide-react";
import {
  studioStartLinkCheckout,studioVerifyLinkCheckout,type PublicPaymentLink,
} from "@/actions/studio-payment-links";

const INPUT="mt-2 h-12 w-full border border-[#e7e4e9] bg-white px-4 text-sm outline-none focus:border-[#6337d8]";
const money=(v:number,currency:string)=>currency+" "+Number(v||0).toLocaleString(undefined,{
  minimumFractionDigits:2,maximumFractionDigits:2,
});
export function StudioPaymentCheckout({data}: {data:PublicPaymentLink}){
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [email,setEmail]=useState("");
  const [message,setMessage]=useState("");
  const [amount,setAmount]=useState<number>(data.fixedAmount?data.amount:data.presetAmounts?.[0]||25);
  const [tip,setTip]=useState<number>(0);
  const [customTip,setCustomTip]=useState(false);
  const [chooseMethod,setChooseMethod]=useState(false);
  const [busy,setBusy]=useState(false);
  const [verifying,setVerifying]=useState(false);
  const [error,setError]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const verified=useRef("");
  const methods=data.methods||{stripe:false,paypal:false};
  const total=Math.round((Number(amount||0)+Number(tip||0))*100)/100;
  const canPay=Boolean(data.onlinePaymentEnabled&&(methods.stripe||methods.paypal));

  useEffect(()=>{
    let active=true;
    const params=new URLSearchParams(window.location.search);
    const status=params.get("studio_payment");
    const reference=status==="stripe"?params.get("session_id"):status==="paypal"?params.get("token"):null;
    if((status==="stripe"||status==="paypal")&&reference&&verified.current!==status+":"+reference){
      verified.current=status+":"+reference;
      void Promise.resolve().then(()=>{if(active){setVerifying(true);setError("");}});
      void studioVerifyLinkCheckout({token:data.token,provider:status,referenceId:reference}).then(result=>{
        if(active&&result.paid){
          setConfirmation(result.confirmationMessage||data.confirmationMessage||"Thank you for your payment!");
          window.history.replaceState(null,"",window.location.pathname);
        }
      }).catch(err=>{
        if(active)setError(err instanceof Error?err.message:"Could not verify payment. Please contact the studio and do not pay again until it has been checked.");
      }).finally(()=>{if(active)setVerifying(false)});
    }else if(status==="cancelled"){
      void Promise.resolve().then(()=>{if(active)setError("Checkout was cancelled. No payment has been confirmed.");});
      window.history.replaceState(null,"",window.location.pathname);
    }
    return ()=>{active=false;};
  },[data.token,data.confirmationMessage]);

  const submit=(event:FormEvent)=>{
    event.preventDefault();setError("");
    if(!canPay){setError("Online checkout is not configured for this studio.");return;}
    if(!firstName.trim()||!lastName.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){
      setError("Please fill in your name and valid email.");return;
    }
    if(amount<=0||!Number.isFinite(amount)||!Number.isFinite(tip)||tip<0){
      setError("Choose a valid payment and tip amount.");return;
    }
    setChooseMethod(true);
  };
  const checkout=async(provider:"stripe"|"paypal")=>{
    setBusy(true);setError("");
    try{
      const response=await studioStartLinkCheckout({
        token:data.token,provider,amount,tip,firstName:firstName.trim(),
        lastName:lastName.trim(),email:email.trim(),message:message.trim(),
      });
      const url=new URL(response.url);
      if(url.protocol!=="https:"||!["checkout.stripe.com","www.paypal.com","www.sandbox.paypal.com"].includes(url.hostname)||url.username||url.password)
        throw Error("The checkout provider returned an invalid payment URL");
      window.location.assign(url.toString());
    }catch(err){
      setError(err instanceof Error?err.message:"Could not start payment");setBusy(false);
    }
  };
  return <main className="min-h-screen bg-[#f2f2f3] text-[#222]">
    <header className="flex h-13 items-center justify-center border-b border-[#e6e4e7] bg-white">
      <span className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="size-4 text-[#6337d8]"/>Secure Studio Manager payment</span>
    </header>
    <div className="mx-auto grid max-w-[1190px] gap-6 px-4 py-8 sm:px-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,.85fr)] lg:items-start lg:gap-6 lg:py-12">
      <div>
        <form id="studio-link-public-form" onSubmit={submit} className="space-y-8 bg-white p-6 shadow-sm sm:p-11">
          {confirmation?<div className="py-16 text-center">
            <CheckCircle2 className="mx-auto size-12 text-green-600"/>
            <h1 className="mt-5 text-2xl font-semibold">Payment confirmed</h1>
            <p className="mx-auto mt-4 max-w-sm whitespace-pre-line text-sm leading-7 text-[#777]">{confirmation}</p>
            <p className="mt-5 text-xs text-[#888]">Your studio has recorded this transaction. A receipt or project update may arrive separately.</p>
          </div>:<>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Total</p>
              <p className="text-[26px] font-medium">{money(total,data.currency)}</p>
              {data.description&&<p className="max-w-[480px] pt-2 text-xs leading-6 text-[#817d82]">{data.description}</p>}
            </div>
            {!data.fixedAmount&&<fieldset>
              <legend className="text-[13px] font-semibold">Choose an amount</legend>
              {!!data.presetAmounts?.length&&<div className="mt-3 flex flex-wrap gap-2">
                {data.presetAmounts.map(value=><button type="button" key={value} onClick={()=>{setAmount(value);setChooseMethod(false);}}
                  aria-pressed={amount===value} className={"border px-4 py-2 text-xs font-semibold "+(amount===value?"border-[#6337d8] bg-[#f4efff] text-[#6337d8]":"border-[#e2dee6] text-[#59535f]")}>
                  {money(value,data.currency)}</button>)}
              </div>}
              {data.allowCustomAmount&&<label className="mt-4 block text-[13px] font-semibold">Custom amount
                <input type="number" min="0.01" max="1000000" step="0.01" className={INPUT} value={amount}
                  onChange={e=>{setAmount(Number(e.target.value));setChooseMethod(false);}}/></label>}
            </fieldset>}
            {data.allowTips&&<fieldset className="border-t border-[#eee] pt-6">
              <legend className="text-[13px] font-semibold">Add an optional tip</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" aria-pressed={!tip} onClick={()=>{setTip(0);setCustomTip(false);setChooseMethod(false)}}
                  className={"border px-4 py-2 text-xs "+(!tip?"border-[#6337d8] bg-[#f4efff] text-[#6337d8]":"border-[#e2dee6]")}>No tip</button>
                {data.tipPresets?.map(value=><button type="button" key={value} aria-pressed={tip===value&&!customTip}
                  onClick={()=>{setTip(value);setCustomTip(false);setChooseMethod(false);}}
                  className={"border px-4 py-2 text-xs "+(tip===value&&!customTip?"border-[#6337d8] bg-[#f4efff] text-[#6337d8]":"border-[#e2dee6]")}>
                  {money(value,data.currency)}</button>)}
                <button type="button" onClick={()=>{setCustomTip(true);setChooseMethod(false)}} aria-pressed={customTip}
                  className={"border px-4 py-2 text-xs "+(customTip?"border-[#6337d8] bg-[#f4efff] text-[#6337d8]":"border-[#e2dee6]")}>Custom tip</button>
              </div>
              {customTip&&<label className="mt-3 block text-xs font-semibold">Your tip ({data.currency})
                <input className={INPUT} type="number" min="0" max="100000" step="0.01" value={tip} onChange={e=>setTip(Number(e.target.value))}/>
              </label>}
            </fieldset>}
            <div className="grid gap-7 border-t border-[#eee] pt-7">
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block text-[13px] font-semibold">First Name *
                  <input className={INPUT} required autoComplete="given-name" maxLength={100} value={firstName}
                    placeholder="Enter first name" onChange={e=>{setFirstName(e.target.value);setChooseMethod(false);}}/></label>
                <label className="block text-[13px] font-semibold">Last Name *
                  <input className={INPUT} required autoComplete="family-name" maxLength={100} value={lastName}
                    placeholder="Enter last name" onChange={e=>{setLastName(e.target.value);setChooseMethod(false);}}/></label>
              </div>
              <label className="block text-[13px] font-semibold">Email *
                <input className={INPUT} required type="email" maxLength={200} autoComplete="email" value={email}
                  placeholder="example@domain.com" onChange={e=>{setEmail(e.target.value);setChooseMethod(false);}}/></label>
              <label className="block text-[13px] font-semibold">Write a message
                <textarea className={INPUT+" min-h-[95px] resize-y py-3"} maxLength={1000}
                  placeholder="Optional" value={message} onChange={e=>setMessage(e.target.value)}/></label>
            </div>
            {error&&<p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
            {verifying&&<p role="status" className="flex items-center gap-2 text-xs text-[#6337d8]"><Loader2 className="size-4 animate-spin"/>Verifying payment with the provider…</p>}
          </>}
        </form>
        {!confirmation&&<div className="mt-5">
          {!chooseMethod?<button type="submit" form="studio-link-public-form" disabled={!canPay||busy||verifying}
            className="min-h-[55px] w-full max-w-[340px] bg-[#6337d8] px-7 text-xs font-bold uppercase tracking-[.1em] text-white disabled:cursor-not-allowed disabled:bg-[#aaa]">
            Continue to payment</button>:
            <div className="flex flex-wrap items-center gap-3">
              {methods.stripe&&<button type="button" disabled={busy||verifying} onClick={()=>void checkout("stripe")}
                className="inline-flex h-[52px] items-center gap-2 bg-[#6337d8] px-7 text-xs font-bold text-white disabled:opacity-50">
                {busy?<Loader2 className="size-4 animate-spin"/>:<CreditCard className="size-4"/>}Pay with Stripe</button>}
              {methods.paypal&&<button type="button" disabled={busy||verifying} onClick={()=>void checkout("paypal")}
                className="inline-flex h-[52px] items-center gap-2 border border-[#d8d0e4] bg-white px-7 text-xs font-bold text-[#6337d8] disabled:opacity-50">
                <Wallet className="size-4"/>Pay with PayPal</button>}
              <button type="button" onClick={()=>setChooseMethod(false)} className="px-3 text-xs text-[#777]">Edit details</button>
            </div>}
          {!canPay&&<p className="mt-3 text-xs text-[#886c46]">Online payment is not available for this link. Contact the studio to arrange payment.</p>}
        </div>}
      </div>
      <aside className="space-y-0 bg-white shadow-sm">
        {data.coverImageUrl?<div className="h-[190px] overflow-hidden bg-[#e7e6ea]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.coverImageUrl} alt={data.title+" cover"} className="size-full object-cover"/>
        </div>:<div className="h-[155px] bg-gradient-to-br from-[#5b9ba3] via-[#a9dad8] to-[#eee2da]"/>}
        <div className="p-8 sm:p-10">
          <h2 className="text-lg font-semibold">{data.title}</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#555]">{data.description||"Complete your payment securely."}</p>
          <h3 className="mt-9 text-[15px] font-semibold">Payments</h3>
          <div className="mt-4 flex justify-between text-[13px]"><span>Amount</span><span>{money(amount,data.currency)}</span></div>
          {data.allowTips&&<div className="mt-4 flex justify-between text-[13px]"><span>Tip</span><span>{money(tip,data.currency)}</span></div>}
          <div className="mt-5 flex justify-between border-t border-[#eee] pt-5 text-[13px] font-semibold"><span>Total</span><span>{money(total,data.currency)}</span></div>
          {data.notes&&<p className="mt-8 border-t pt-5 text-xs leading-6 text-[#777]">{data.notes}</p>}
          <p className="mt-8 flex items-center gap-2 text-[11px] text-[#888]"><ShieldCheck className="size-4 text-[#6337d8]"/>Secure checkout powered by your studio</p>
        </div>
      </aside>
    </div>
  </main>;
}

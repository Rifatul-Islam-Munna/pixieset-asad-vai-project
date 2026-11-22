"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Printer, ShieldCheck } from "lucide-react";
import { acceptPublicStudioQuote, signPublicStudioContract, submitPublicStudioForm, submitPublicStudioQuestionnaire } from "@/actions/studio-public";
import type {JSONContent} from "@tiptap/core";
import {StudioContractReader} from "./studio-contract-reader";
import {SignatureDisplay,StudioSignaturePad,signatureComplete,type StudioSignature} from "./studio-signature";
import {quoteTotals,displayQuoteMoney,type QuoteItem,type QuoteSelections} from "./studio-quote-model";
import {
  publicStudioInvoicePaymentMethods,startStudioInvoiceCheckout,verifyStudioInvoiceCheckout,
} from "@/actions/studio-payments";

const INPUT = "w-full border-0 border-b border-[#e6e1ed] bg-transparent px-0 py-3 text-sm outline-none transition focus:border-[#6337d8]";
const CTA = "inline-flex h-12 items-center justify-center gap-2 bg-[#6337d8] px-8 text-xs font-bold uppercase tracking-[.12em] text-white hover:bg-[#5129bf] disabled:opacity-50";
type FormField = { name: string; label: string; type: string; required?: boolean; options?: string; allowOther?:boolean };
type PublicForm = { title:string; description:string; fields:FormField[]; buttonLabel:string; successMessage:string; showMessage?:boolean; accentColor?:string; backgroundColor?:string };
type PublicInvoice = {
  title:string;number:string;status:string;clientName:string;amount:number;currency:string;
  dueDate?:string;description?:string;lines:{name:string;description?:string;quantity:number;unitPrice:number}[];
  subtotal:number;discount:number;tax:number;notes?:string;businessName?:string;brandColor?:string;footerText?:string;
};
type PublicContract = {
  title:string;description:string;content:string;status:string;signedAt?:string;signerName?:string;
  contentDoc?:JSONContent|null;variables?:Record<string,string>;photographerName?:string;accentColor?:string;
  studioSignature?:StudioSignature|null;studioSignatureDraft?:StudioSignature|null;studioSignerName?:string;studioSignedAt?:string;
  clientSignature?:StudioSignature|null;
};
type PublicPayment = { title:string; amount:number; currency:string; description:string; instructions:string; expiresAt?:string; onlinePaymentEnabled:false };
type PublicOtherDocument = {
  title:string;type:"questionnaire"|"quote";status:string;description:string;content:string;
  fields:FormField[];responses:Record<string,string>;signerName?:string;acceptedAt?:string;submittedAt?:string;
  amount:number;currency:string;
  quoteItems?:QuoteItem[];discountPercent?:number;taxPercent?:number;
  notes?:string;acceptedSelections?:QuoteSelections;acceptedTotal?:number|null;
  accentColor?:string;
};
export type StudioPublicPreviewKind="form"|"invoice"|"contract"|"questionnaire"|"quote";
export type StudioPublicPreviewData=PublicForm|PublicInvoice|PublicContract|PublicOtherDocument;
function price(value:number,currency:string) {return currency+" "+Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
const date = (raw?:string) => raw?new Date(raw).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}):"Upon receipt";

export function StudioPublic({ kind, token, data, ownerPreview=false,publicDraftPreview=false,showOwnerPreviewNotice=true,
  onSaveStudioSignature,onRemoveStudioSignature,onStudioSignerNameChange,studioName="",
}: {
  kind:"form"|"invoice"|"contract"|"payment"|"questionnaire"|"quote";
  token:string;data:PublicForm|PublicInvoice|PublicContract|PublicPayment|PublicOtherDocument;
  ownerPreview?:boolean;
  publicDraftPreview?:boolean;
  showOwnerPreviewNotice?:boolean;
  studioName?:string;
  onSaveStudioSignature?:(signature:StudioSignature)=>Promise<void>;
  onRemoveStudioSignature?:()=>Promise<void>;
  onStudioSignerNameChange?:(name:string)=>void;
}) {
  const [sender,setSender]=useState({name:"",email:"",message:"",website:""});
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [responses,setResponses]=useState<Record<string,string>>({});
  const [quoteSelections,setQuoteSelections]=useState<QuoteSelections>({});
  const [signerName,setSignerName]=useState("");
  const [signerSignature,setSignerSignature]=useState<StudioSignature|null>(null);
  const [ownerSignature,setOwnerSignature]=useState<StudioSignature|null>(()=>kind==="contract"?(data as PublicContract).studioSignatureDraft||null:null);
  const [ownerSignatureConsent,setOwnerSignatureConsent]=useState(false);
  const [ownerSignatureBusy,setOwnerSignatureBusy]=useState(false);
  const [accepted,setAccepted]=useState(false);
  const [sending,setSending]=useState(false);
  const [success,setSuccess]=useState(false);
  const [error,setError]=useState("");
  const [paymentMethods,setPaymentMethods]=useState<{stripe:boolean;paypal:boolean}|null>(null);
  const [paymentBusy,setPaymentBusy]=useState(false);
  const [paymentChecking,setPaymentChecking]=useState(false);
  const [paymentSucceeded,setPaymentSucceeded]=useState(false);
  const [paymentError,setPaymentError]=useState("");
  const verifiedRef=useRef("");
  const toggleMultiple=(name:string,choice:string)=>{
    setResponses(old=>{
      const selected=(old[name]||"").split(" | ").filter(Boolean);
      const next=selected.includes(choice)?selected.filter(x=>x!==choice):[...selected,choice];
      return {...old,[name]:next.join(" | ")};
    });
  };
  useEffect(()=>{
    if(kind!=="invoice"||ownerPreview)return;
    let active=true;
    void publicStudioInvoicePaymentMethods(token).then(methods=>{
      if(active)setPaymentMethods(methods);
    }).catch(()=>{if(active)setPaymentMethods({stripe:false,paypal:false})});
    const params=new URLSearchParams(window.location.search);
    const provider=params.get("studio_checkout");
    const id=provider==="stripe"?params.get("session_id"):provider==="paypal"?params.get("token"):null;
    if((provider==="stripe"||provider==="paypal")&&id&&verifiedRef.current!==provider+":"+id){
      verifiedRef.current=provider+":"+id;
      void Promise.resolve().then(()=>{if(active){setPaymentChecking(true);setPaymentError("");}});
      void verifyStudioInvoiceCheckout(token,provider,id).then(result=>{
        if(active&&result.paid){
          setPaymentSucceeded(true);
          window.history.replaceState(null,"",window.location.pathname);
        }
      }).catch(err=>{
        if(active)setPaymentError(err instanceof Error?err.message:"Payment could not be verified. Contact the studio before trying again.");
      }).finally(()=>{if(active)setPaymentChecking(false)});
    }else if(provider==="cancelled"){
      void Promise.resolve().then(()=>{if(active)setPaymentError("Checkout was cancelled. You can try again.");});
      window.history.replaceState(null,"",window.location.pathname);
    }
    return ()=>{active=false};
  },[kind,token,ownerPreview]);
  const payInvoice=async(provider:"stripe"|"paypal")=>{
    setPaymentBusy(true);setPaymentError("");
    try{
      const result=await startStudioInvoiceCheckout(token,provider);
      const url=new URL(result.url);
      const allowed=["checkout.stripe.com","www.paypal.com","www.sandbox.paypal.com"];
      if(url.protocol!=="https:"||!allowed.includes(url.hostname)||url.username||url.password)
        throw Error("The checkout provider returned an invalid destination");
      window.location.assign(url.toString());
    }catch(err){
      setPaymentError(err instanceof Error?err.message:"Could not open checkout");
      setPaymentBusy(false);
    }
  };

  const submit=async(event:FormEvent)=>{
    event.preventDefault();setSending(true);setError("");
    try {
      if(kind==="contract"&&!signatureComplete(signerSignature))
        throw new Error("Draw, type or upload your signature before signing the contract.");
      if(ownerPreview){
        // Demonstrate the entire client experience without making any public API call.
        setSuccess(true);
        return;
      }
      const result=kind==="form"
        ? await submitPublicStudioForm(token,{...sender,name:[firstName,lastName].filter(Boolean).join(" ").trim(),responses})
        : kind==="questionnaire" ? await submitPublicStudioQuestionnaire(token,responses)
        : kind==="quote" ? await acceptPublicStudioQuote(token,signerName,accepted,quoteSelections)
        : await signPublicStudioContract(token,signerName,accepted,signerSignature||undefined);
      if(!result.ok)throw new Error(result.message);
      setSuccess(true);
    }catch(e){setError(e instanceof Error?e.message:"Could not submit");}
    finally{setSending(false);}
  };

  return <main className={"bg-[#f7f6f9] px-4 text-[#25212d] antialiased "+
    (ownerPreview?"py-5 sm:py-8":"min-h-screen py-12 sm:py-20")}>
    {ownerPreview&&showOwnerPreviewNotice&&<div role="status" className="mx-auto mb-4 flex w-full max-w-[850px] items-center gap-2 border border-[#ddcfff] bg-[#f3efff] px-4 py-3 text-xs font-semibold leading-5 text-[#6337d8] print:hidden">
      <ShieldCheck className="size-4 shrink-0"/>
      {publicDraftPreview?
        "Draft preview · Anyone with this link can review this draft. You cannot submit, sign or pay until the studio sends or publishes it.":
        "Owner preview · This is the client-facing page. Test submissions do not send, charge or sign for the client."}
    </div>}
    <div className="mx-auto w-full max-w-[850px] bg-white px-6 py-10 shadow-[0_10px_55px_rgba(34,20,68,.04)] sm:px-16 sm:py-14">
      <header className="flex items-center justify-between border-b border-[#eeeaf1] pb-8">
        {ownerPreview?<span className="flex items-center gap-3 text-[15px] font-bold">
          <span className="grid size-9 place-items-center rounded-full bg-[#6337d8] text-white"><ShieldCheck className="size-5"/></span>{studioName||(kind==="invoice"?(data as PublicInvoice).businessName:"")||"Gallerista Studio"}</span>:
        <Link href="/" className="flex items-center gap-3 text-[15px] font-bold"><span className="grid size-9 place-items-center rounded-full bg-[#6337d8] text-white"><ShieldCheck className="size-5"/></span>{studioName||(kind==="invoice"?(data as PublicInvoice).businessName:"")||"Gallerista Studio"}</Link>}
        {kind==="invoice"&&<button className="inline-flex items-center gap-2 text-xs text-[#888] print:hidden" onClick={()=>window.print()}><Printer className="size-4"/> Print invoice</button>}
      </header>
      {kind==="form"&&(()=>{
        const form=data as PublicForm;
        return <div style={{backgroundColor:form.backgroundColor||"#ffffff"}}>
          <div className="mx-auto max-w-[600px] py-9">
            <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#6337d8]">Contact Form</p>
            <h1 className="mt-4 text-3xl font-medium" style={{color:form.accentColor||"#6337d8"}}>{form.title}</h1>
            {form.description&&<p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#85808b]">{form.description}</p>}
            {success?<div className="mt-12 text-center"><CheckCircle2 className="mx-auto size-12 text-[#6337d8]"/><h2 className="mt-5 text-xl font-semibold">Thank you!</h2><p className="mt-3 text-sm text-[#777]">{form.successMessage}</p></div>:
            <form onSubmit={(e)=>void submit(e)} className="mt-10 space-y-8">
              <div className="grid gap-8 sm:grid-cols-2">
                <label className="block text-sm font-medium">First Name *<input className={INPUT} autoComplete="given-name" required value={firstName} placeholder="John" onChange={(e)=>setFirstName(e.target.value)}/></label>
                <label className="block text-sm font-medium">Last Name<input className={INPUT} autoComplete="family-name" value={lastName} placeholder="Smith" onChange={(e)=>setLastName(e.target.value)}/></label>
              </div>
              <label className="block text-sm font-medium">Email *<input className={INPUT} type="email" autoComplete="email" required value={sender.email} placeholder="you@example.com" onChange={(e)=>setSender({...sender,email:e.target.value})}/></label>
              {form.fields?.map((f)=><label key={f.name} className="block text-sm font-medium">{f.label}{f.required?" *":""}
                {f.type==="textarea"?<textarea className={INPUT+" min-h-24 resize-y"} required={f.required} value={responses[f.name]||""} onChange={(e)=>setResponses({...responses,[f.name]:e.target.value})}/> :
                  f.type==="select"?<select className={INPUT} required={f.required} value={responses[f.name]||""} onChange={(e)=>setResponses({...responses,[f.name]:e.target.value})}><option value="">Select an option</option>{String(f.options||"").split(",").map((o)=><option key={o.trim()} value={o.trim()}>{o.trim()}</option>)}</select> :
                    <input className={INPUT} type={f.type==="date"?"date":"text"} required={f.required} value={responses[f.name]||""} onChange={(e)=>setResponses({...responses,[f.name]:e.target.value})}/>}
              </label>)}
              {form.showMessage!==false&&<label className="block text-sm font-medium">Message<textarea className={INPUT+" min-h-24 resize-y"} value={sender.message} placeholder="Tell us a little about your project…" onChange={(e)=>setSender({...sender,message:e.target.value})}/></label>}
              <label className="sr-only" aria-hidden="true">Website<input tabIndex={-1} value={sender.website} onChange={(e)=>setSender({...sender,website:e.target.value})}/></label>
              {error&&<p role="alert" className="bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <button disabled={sending||publicDraftPreview} className={CTA} style={{backgroundColor:form.accentColor||"#6337d8"}}>
                {publicDraftPreview?"Publish form to enable submission":sending?"Sending…":form.buttonLabel||"Submit"}</button>
            </form>}</div>
        </div>;
      })()}
      {kind==="invoice"&&(()=>{
        const invoice=data as PublicInvoice;
        const paid=invoice.status==="paid"||paymentSucceeded;
        return <article className="py-9">
          <p className="text-xs font-bold uppercase tracking-[.2em]" style={{color:invoice.brandColor||"#6337d8"}}>{invoice.businessName||"Gallerista Studio"}</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div><h1 className="text-3xl font-medium">{invoice.title}</h1><p className="mt-2 text-sm text-[#8b8693]">#{invoice.number||"—"}</p></div>
            <span className={"px-3 py-2 text-xs font-bold uppercase "+(paid?"bg-green-50 text-green-700":"bg-[#f4efff] text-[#6337d8]")}>{paid?"paid":invoice.status}</span>
          </div>
          <div className="mt-12 grid gap-6 border-y border-[#eeebf0] py-6 text-sm sm:grid-cols-2">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#96919c]">Billed to</p><p className="mt-3 font-semibold">{invoice.clientName||"Client"}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#96919c]">Due on</p><p className="mt-3 font-semibold">{date(invoice.dueDate)}</p></div>
          </div>
          {invoice.description&&<p className="mt-6 text-sm leading-7 text-[#77717e]">{invoice.description}</p>}
          <h2 className="mt-10 text-lg font-medium">Items</h2>
          <div className="mt-4 border-t border-[#e9e4ef]">
            {(invoice.lines||[]).map((row,i)=><div key={i} className="flex justify-between gap-5 border-b border-[#f0edf2] py-5 text-sm"><div><p className="font-semibold">{row.name}</p>{row.description&&<p className="mt-1 text-xs text-[#777]">{row.description}</p>}<p className="mt-1 text-xs text-[#a7a1ac]">Quantity: {row.quantity}</p></div><span>{price(row.quantity*row.unitPrice,invoice.currency)}</span></div>)}
          </div>
          <div className="ml-auto mt-7 max-w-[310px] space-y-4 text-sm">
            <div className="flex justify-between"><span className="text-[#888]">Subtotal</span><span>{price(invoice.subtotal,invoice.currency)}</span></div>
            {invoice.discount>0&&<div className="flex justify-between"><span className="text-[#888]">Discount</span><span>-{price(invoice.discount,invoice.currency)}</span></div>}
            {invoice.tax>0&&<div className="flex justify-between"><span className="text-[#888]">Tax</span><span>{price(invoice.tax,invoice.currency)}</span></div>}
            <div className="flex justify-between border-t pt-5 text-lg font-bold"><span>Total</span><span>{price(invoice.amount,invoice.currency)}</span></div>
          </div>
          {!paid&&(invoice.status==="sent"||ownerPreview)&&<div className="mt-10 border border-[#e9e5ef] bg-[#fcfbff] p-6">
            <h2 className="text-lg font-semibold">Pay this invoice online</h2>
            <p className="mt-2 text-xs leading-6 text-[#89818f]">{"Use the studio's existing Store payment account. You'll be taken to the payment provider's secure checkout."}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {ownerPreview&&<p className="w-full text-xs text-[#806e96]">Payment buttons are disabled in owner preview. The actual customer will see whichever payment provider is connected and supports this invoice.</p>}
              {ownerPreview&&<button type="button" disabled className={CTA}>Pay with Stripe (preview)</button>}
              {ownerPreview&&<button type="button" disabled className="inline-flex h-12 items-center justify-center border border-[#d8d0e6] bg-white px-6 text-xs font-bold text-[#6337d8] opacity-50">Pay with PayPal (preview)</button>}
              {!ownerPreview&&paymentMethods?.stripe&&<button type="button" disabled={paymentBusy||paymentChecking}
                onClick={()=>void payInvoice("stripe")} className={CTA}>{paymentBusy?"Opening checkout…":"Pay with Stripe"}</button>}
              {!ownerPreview&&paymentMethods?.paypal&&<button type="button" disabled={paymentBusy||paymentChecking}
                onClick={()=>void payInvoice("paypal")} className="inline-flex h-12 items-center justify-center border border-[#d8d0e6] bg-white px-6 text-xs font-bold text-[#6337d8] disabled:opacity-50">{paymentBusy?"Opening checkout…":"Pay with PayPal"}</button>}
              {!ownerPreview&&paymentMethods&&!paymentMethods.stripe&&!paymentMethods.paypal&&<p className="text-xs text-[#908794]">Online payment is not available for this invoice. Please contact the studio for payment instructions.</p>}
            </div>
            {paymentChecking&&<p role="status" className="mt-4 text-xs text-[#6a5b88]">Verifying your payment with the provider…</p>}
            {paymentError&&<p role="alert" className="mt-4 bg-red-50 px-3 py-2 text-xs text-red-700">{paymentError}</p>}
          </div>}
          {paid&&<p role="status" className="mt-8 border border-green-100 bg-green-50 p-4 text-sm text-green-800">This invoice has been paid. Thank you!</p>}
          {invoice.notes&&<div className="mt-14 border-t pt-6"><h3 className="text-xs font-bold">Notes</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#888]">{invoice.notes}</p></div>}
          {invoice.footerText&&<p className="mt-12 text-center text-sm text-[#999]">{invoice.footerText}</p>}
          <p className="mt-14 border-t pt-6 text-xs leading-6 text-[#a09aa5]">{paid?"This invoice is marked as paid.":"You can pay through a connected provider above, if available, or contact the studio to arrange payment."}</p>
        </article>;
      })()}
      {kind==="payment"&&(()=>{
        const request=data as PublicPayment;
        return <article className="py-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#6337d8]">Payment request</p>
          <h1 className="mt-4 text-3xl font-medium">{request.title}</h1>
          {request.description&&<p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#888]">{request.description}</p>}
          <div className="mt-10 border-y border-[#eeeaf0] py-8">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#a39caa]">Requested amount</p>
            <p className="mt-3 text-3xl font-semibold">{price(request.amount,request.currency)}</p>
            {request.expiresAt&&<p className="mt-4 text-xs text-[#888]">Payment request expires {date(request.expiresAt)}.</p>}
          </div>
          <h2 className="mt-10 text-lg font-semibold">Payment instructions</h2>
          <p className="mt-4 whitespace-pre-wrap bg-[#f7f4fb] p-6 text-sm leading-7 text-[#736c7b]">{request.instructions || "Please contact your studio directly for payment details."}</p>
          <p className="mt-8 text-xs leading-6 text-[#9f8d66]">
            This is a manual payment request, not an online checkout. No payment is processed on this page.
            Contact the studio to arrange payment and request a receipt.
          </p>
        </article>;
      })()}
      {kind==="questionnaire"&&(()=>{
        const questionnaire=data as PublicOtherDocument;
        return <article className="py-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#6337d8]">Client Questionnaire</p>
          <h1 className="mt-4 text-3xl font-medium" style={{color:questionnaire.accentColor||"#19bca5"}}>{questionnaire.title}</h1>
          {questionnaire.description&&<p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#888]">{questionnaire.description}</p>}
          {questionnaire.content&&<p className="mt-10 whitespace-pre-wrap border-y py-7 text-sm leading-7">{questionnaire.content}</p>}
          {success||questionnaire.status==="completed"?<div className="mt-10 bg-[#f7f3ff] p-7 text-sm"><CheckCircle2 className="size-8 text-[#6337d8]"/><p className="mt-3 font-semibold">Questionnaire submitted. Thank you!</p></div>:
            <form className="mt-10 space-y-7" onSubmit={(e)=>void submit(e)}>
              {questionnaire.fields?.map((f)=>{
                const answer=responses[f.name]||"";
                const options=String(f.options||"").split(",").map(v=>v.trim()).filter(Boolean);
                const multi=answer.split(" | ").filter(Boolean);
                const other=multi.find(v=>v.startsWith("Other: "))||"";
                return <fieldset key={f.name} className="border border-[#e7e3e9] p-5 sm:p-7">
                  <legend className="px-1 text-sm font-semibold">{f.label}{f.required?" *":""}</legend>
                  {["radio","checkbox"].includes(f.type)?<div className="mt-3 space-y-4">
                    {options.map(value=><label key={value} className="flex items-center gap-3 text-sm font-normal text-[#59535f]">
                      <input className="size-4 accent-[#6337d8]" type={f.type==="radio"?"radio":"checkbox"}
                        name={f.type==="radio"?f.name:undefined} value={value}
                        checked={f.type==="radio"?answer===value:multi.includes(value)}
                        onChange={()=>f.type==="radio"
                          ?setResponses(old=>({...old,[f.name]:value}))
                          :toggleMultiple(f.name,value)}/>
                      {value}</label>)}
                    {f.allowOther&&<div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-3 text-sm font-normal text-[#59535f]">
                        <input type={f.type==="radio"?"radio":"checkbox"} className="size-4 accent-[#6337d8]"
                          name={f.type==="radio"?f.name:undefined}
                          checked={Boolean(other)}
                          onChange={()=>{
                            if(f.type==="radio")setResponses(old=>({...old,[f.name]:"Other: Please specify"}));
                            else if(other)setResponses(old=>({...old,[f.name]:multi.filter(v=>!v.startsWith("Other: ")).join(" | ")}));
                            else toggleMultiple(f.name,"Other: Please specify");
                          }}/>Other</label>
                      {other&&<input type="text" className={INPUT+" min-w-[190px] flex-1"} placeholder="Please specify"
                        maxLength={130} value={other.slice("Other: ".length)}
                        onChange={e=>setResponses(old=>({...old,[f.name]:f.type==="radio"?
                          "Other: "+e.target.value:
                          [...multi.filter(v=>!v.startsWith("Other: ")),"Other: "+e.target.value].join(" | ")}))}/>}
                    </div>}
                  </div>:
                  f.type==="textarea"?<textarea className={INPUT+" min-h-24 resize-y"} required={f.required}
                    value={answer} onChange={e=>setResponses(old=>({...old,[f.name]:e.target.value}))}/>:
                  f.type==="select"?<select className={INPUT} required={f.required} value={answer}
                    onChange={e=>setResponses(old=>({...old,[f.name]:e.target.value}))}>
                      <option value="">Choose an option</option>{options.map(v=><option key={v}>{v}</option>)}</select>:
                  <input className={INPUT} type={f.type==="date"?"date":"text"} required={f.required}
                    value={answer} onChange={e=>setResponses(old=>({...old,[f.name]:e.target.value}))}/>}
                </fieldset>;
              })}
              {!questionnaire.fields?.length&&<p className="text-sm text-[#888]">There are no custom questions in this document. Submit to acknowledge receipt.</p>}
              {error&&<p role="alert" className="bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <button className={CTA} style={{backgroundColor:questionnaire.accentColor||"#19bca5"}}
                disabled={sending||publicDraftPreview}>
                {publicDraftPreview?"Draft — submission unavailable":sending?"Sending…":"Submit questionnaire"}</button>
            </form>}
        </article>;
      })()}
      {(kind==="contract"||kind==="quote")&&(()=>{
        const contract=data as PublicContract & Partial<PublicOtherDocument>;
        const isQuote=kind==="quote";
        const items=isQuote&&Array.isArray(contract.quoteItems)?contract.quoteItems:[];
        const activeSelections=contract.status==="completed"?
          (contract.acceptedSelections||{}):quoteSelections;
        const hasChoices=items.some(item=>item.type!=="standard");
        const allRequiredSelected=items.every(item=>item.type!=="selection"||
          (typeof activeSelections[item.id]==="string"&&Boolean(activeSelections[item.id])));
        const quoteSummary=items.length?quoteTotals(items,activeSelections,
          contract.discountPercent||0,contract.taxPercent||0):null;
        const quoteMinimum=items.length?quoteTotals(items,{},contract.discountPercent||0,
          contract.taxPercent||0,true):null;
        const displayTotal=contract.status==="completed"?
          Number(contract.acceptedTotal??contract.amount??0):allRequiredSelected?
            (quoteSummary?.total??contract.amount??0):(quoteMinimum?.total??contract.amount??0);
        const chooseQuote=(groupId:string,optionId:string,multi:boolean)=>{
          setQuoteSelections(current=>{
            if(!multi)return {...current,[groupId]:optionId};
            const selected=Array.isArray(current[groupId])?current[groupId] as string[]:[];
            return {...current,[groupId]:selected.includes(optionId)?
              selected.filter(x=>x!==optionId):[...selected,optionId]};
          });
        };
        return <article className="py-9">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#6337d8]">{isQuote?"Quote":"Contract"}</p>
          <h1 className="mt-4 text-3xl font-medium" style={isQuote?{color:contract.accentColor||"#19bca5"}:undefined}>{contract.title}</h1>
          {contract.description&&<p className="mt-4 text-sm text-[#888]">{contract.description}</p>}
          {(!isQuote||!items.length)&&<div className="mt-10 border-y border-[#ece8ef] py-9">
            {kind==="contract"&&contract.contentDoc?
              <StudioContractReader contentDoc={contract.contentDoc} content={contract.content||""} variables={contract.variables||{}}/>:
              <p className="whitespace-pre-wrap text-sm leading-8">{contract.content||"No contract text has been added."}</p>}
          </div>}
          {isQuote&&items.length>0&&<section className="mt-9">
            <div className="grid grid-cols-[1fr_65px_110px] gap-3 border-b pb-3 text-[11px] font-bold uppercase tracking-wider text-[#9b94a0]">
              <span>Items</span><span>Qty</span><span>Amount</span>
            </div>
            {items.map(item=><div key={item.id} className="border-b border-[#eee9f0] py-5">
              {item.type==="standard"?<div className="grid grid-cols-[1fr_65px_110px] gap-3 text-sm">
                <div><h3 className="font-semibold">{item.title}</h3>
                  {item.description&&<p className="mt-1 text-xs leading-6 text-[#888]">{item.description}</p>}</div>
                <span>{item.quantity}</span>
                <span className="text-right">{displayQuoteMoney(item.quantity*item.unitPrice,contract.currency||"EUR")}</span>
              </div>:<>
                <h3 className="mb-3 text-sm font-semibold">{item.title||"Select an item"}</h3>
                <p className="mb-5 text-xs text-[#8d8490]">{item.type==="selection"?"Select one option to continue":"Select any optional services you would like"}</p>
                <div className="space-y-4">
                  {item.options.map(option=><label key={option.id} className="flex cursor-pointer items-start justify-between gap-4 border border-[#e9e5ed] p-4 hover:border-[#c9bde3]">
                    <span className="flex min-w-0 items-start gap-3">
                      <input className="mt-1 size-4 accent-[#6337d8]" type={item.type==="selection"?"radio":"checkbox"}
                        name={item.type==="selection"?item.id:undefined} disabled={contract.status==="completed"}
                        checked={item.type==="selection"?activeSelections[item.id]===option.id:
                          Array.isArray(activeSelections[item.id])&&(activeSelections[item.id] as string[]).includes(option.id)}
                        onChange={()=>chooseQuote(item.id,option.id,item.type==="optional")}/>
                      <span className="min-w-0 text-sm"><span className="block font-semibold">{option.name}</span>
                        {option.description&&<span className="mt-2 block text-xs leading-6 text-[#888]">{option.description}</span>}
                        <span className="mt-1 block text-[11px] text-[#aaa]">Quantity: {option.quantity}</span>
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs font-semibold">{displayQuoteMoney(option.quantity*option.unitPrice,contract.currency||"EUR")}</span>
                  </label>)}
                </div>
              </>}
            </div>)}
            <div className="ml-auto mt-8 max-w-[340px] space-y-4 text-sm">
              <div className="flex justify-between gap-4"><span>Subtotal</span>
                <span>{!allRequiredSelected&&hasChoices?"From ":""}{displayQuoteMoney(allRequiredSelected?(quoteSummary?.subtotal||0):(quoteMinimum?.subtotal||0),contract.currency||"EUR")}</span></div>
              {Boolean(contract.discountPercent)&&<div className="flex justify-between gap-4"><span>Discount ({contract.discountPercent}%)</span>
                <span>-{displayQuoteMoney(allRequiredSelected?(quoteSummary?.discount||0):(quoteMinimum?.discount||0),contract.currency||"EUR")}</span></div>}
              {Boolean(contract.taxPercent)&&<div className="flex justify-between gap-4"><span>Tax ({contract.taxPercent}%)</span>
                <span>{displayQuoteMoney(allRequiredSelected?(quoteSummary?.tax||0):(quoteMinimum?.tax||0),contract.currency||"EUR")}</span></div>}
              <div className="flex justify-between gap-4 border-t pt-5 text-lg font-semibold">
                <span>Total</span><span>{!allRequiredSelected&&hasChoices?"From ":""}{displayQuoteMoney(displayTotal,contract.currency||"EUR")}</span>
              </div>
            </div>
            {contract.notes&&<div className="mt-10 border-t pt-7"><h3 className="text-sm font-semibold">Notes</h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#888]">{contract.notes}</p></div>}
          </section>}
          {isQuote&&!items.length&&Number(contract.amount)>0&&<p className="mt-5 text-right text-xl font-semibold">Quoted amount: {price(contract.amount||0,contract.currency||"EUR")}</p>}
          {!isQuote&&<section className="mt-10 space-y-6 border-t border-[#eee9f1] pt-8">
            <h2 className="text-lg font-semibold">Agreement signatures</h2>
            {contract.studioSignature?
              <SignatureDisplay label="Studio / photographer signature"
                signature={contract.studioSignature} name={contract.studioSignerName||contract.photographerName||"Studio owner"}
                signedAt={contract.studioSignedAt}/>:
              <p className="text-xs text-[#918995]">The studio has not signed this agreement yet.</p>}
            {ownerPreview&&onSaveStudioSignature&&!contract.studioSignature&&
              <div className="border border-[#e9e2f2] bg-[#fcfaff] p-5">
                <h3 className="text-sm font-semibold">Sign as studio owner</h3>
                <p className="mt-2 text-xs leading-6 text-[#81778e]">
                  Unlike the client-signing test below, saving this studio signature is a real draft change.
                  It will appear on the agreement your client receives.
                </p>
                {onStudioSignerNameChange&&<label className="mt-5 block text-xs font-semibold">
                  Studio signer name
                  <input type="text" value={contract.studioSignerName||""} maxLength={180}
                    onChange={e=>onStudioSignerNameChange(e.target.value)}
                    placeholder="Your name or photography studio"
                    className={INPUT+" mt-2"}/>
                </label>}
                <div className="mt-5"><StudioSignaturePad value={ownerSignature} onChange={setOwnerSignature}/></div>
                <label className="mt-4 flex items-start gap-2 text-xs leading-6 text-[#756a81]">
                  <input type="checkbox" className="mt-1" checked={ownerSignatureConsent}
                    onChange={e=>setOwnerSignatureConsent(e.target.checked)}/>
                  I approve attaching this studio signature to the current contract draft.
                </label>
                <button type="button" disabled={ownerSignatureBusy||!signatureComplete(ownerSignature)||!ownerSignatureConsent}
                  className={CTA+" mt-5"}
                  onClick={async()=>{
                    if(!ownerSignature||!signatureComplete(ownerSignature))return;
                    setOwnerSignatureBusy(true);setError("");
                    try{await onSaveStudioSignature(ownerSignature);setOwnerSignature(null);setOwnerSignatureConsent(false);}
                    catch(e){setError(e instanceof Error?e.message:"Could not save the studio signature");}
                    finally{setOwnerSignatureBusy(false);}
                  }}>{ownerSignatureBusy?"Saving signature…":"Save studio signature"}</button>
              </div>}
            {ownerPreview&&contract.studioSignature&&onRemoveStudioSignature&&
              <button type="button" disabled={ownerSignatureBusy} className="text-xs font-semibold text-[#6337d8] underline"
                onClick={async()=>{
                  setOwnerSignatureBusy(true);setError("");
                  try{await onRemoveStudioSignature();}
                  catch(e){setError(e instanceof Error?e.message:"Could not remove the studio signature");}
                  finally{setOwnerSignatureBusy(false);}
                }}>Remove studio signature to edit draft</button>}
            {(contract.status==="completed"||success)&&
              <SignatureDisplay
                label={ownerPreview?"Client signature (preview only)":"Client signature"}
                signature={contract.clientSignature||
                  (success?signerSignature:
                    contract.signerName?{kind:"typed",name:contract.signerName}:null)}
                name={success?signerName:contract.signerName||"Client"}
                signedAt={success?undefined:contract.signedAt}/>}
          </section>}
          {success||contract.status==="completed"?<div className="mt-10 bg-[#f7f3ff] p-7"><CheckCircle2 className="size-7 text-[#6337d8]"/><h2 className="mt-3 text-lg font-semibold">
            {ownerPreview&&success?"Preview completed — nothing submitted":isQuote?"Quote accepted":"Contract acknowledged"}</h2>
            <p className="mt-2 text-sm text-[#888]">{success?
              (ownerPreview?"This demonstrated the client's submission. No real client response was recorded.":"Your acknowledgement has been recorded."):
              "Signed by "+(contract.signerName||"recipient")+" on "+date(isQuote?contract.acceptedAt:contract.signedAt)}</p></div>:
          <form onSubmit={(e)=>void submit(e)} className="mt-10 space-y-7">
            <h2 className="text-lg font-semibold">Review & acknowledge</h2>
            <label className="block text-sm font-medium">Your full legal name<input className={INPUT} required value={signerName} onChange={(e)=>setSignerName(e.target.value)} placeholder="Type your full name"/></label>
            {!isQuote&&<StudioSignaturePad label="Your signature" value={signerSignature} onChange={setSignerSignature}/>}
            <label className="flex items-start gap-3 text-sm leading-6 text-[#777]"><input className="mt-1" type="checkbox" checked={accepted} required onChange={(e)=>setAccepted(e.target.checked)}/>I have read and agree to the contents of this document and consent to record my signature and acknowledgement.</label>
            {isQuote&&!allRequiredSelected&&<p className="text-xs text-[#966d28]">Select one option from each required item group before accepting this quote.</p>}
            {error&&<p role="alert" className="bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button className={CTA} style={isQuote?{backgroundColor:contract.accentColor||"#19bca5"}:undefined}
              disabled={sending||publicDraftPreview||!accepted||(isQuote&&!allRequiredSelected)||(!isQuote&&!signatureComplete(signerSignature))}>
              {publicDraftPreview?"Draft — signing unavailable":sending?"Submitting…":isQuote?"Accept quote":"Sign Contract"}</button>
            <p className="text-[11px] text-[#a6a1aa]">The signature is stored with your agreement and timestamp. This is not a certified digital-signature service.</p>
          </form>}
        </article>;
      })()}
      <footer className="mt-10 flex items-center gap-2 border-t border-[#eee] pt-8 text-[11px] text-[#aba6b0]"><ShieldCheck className="size-4"/> Secure studio portal · Powered by Gallerista</footer>
    </div>
  </main>;
}

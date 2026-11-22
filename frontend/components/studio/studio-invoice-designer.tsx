"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Eye, Mail, Plus, Printer, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { studioCreate,studioRecordPayment,studioSendInvoice,studioUpdate,type StudioRecord } from "@/actions/studio";
import {StudioPublic} from "./studio-public";
import {copyStudioPublicLink,previewStudioPublicDraft} from "./studio-public-links";

type Line = { name:string;description:string;quantity:number;unitPrice:number };
const INPUT="h-11 w-full border border-[#e4e1e9] bg-white px-3 text-sm outline-none focus:border-[#6337d8]";
const CTA="inline-flex min-h-10 items-center justify-center gap-2 bg-[#6337d8] px-5 text-xs font-bold text-white hover:bg-[#5427be] disabled:opacity-50";
const OUT="inline-flex min-h-10 items-center justify-center gap-2 border border-[#e6e3e9] bg-white px-4 text-xs font-semibold hover:bg-[#f7f4fa] disabled:opacity-50";
function money(v:number,currency:string){return currency+" "+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
function safeDate(input?:string){return input?new Date(input).toISOString().slice(0,10):"";}
function inColor(value:string){return /^#[a-f0-9]{6}$/i.test(value)?value:"#6337d8";}
export function StudioInvoiceDesigner({
  initial,contacts,projects,onClose,onSaved,defaultContactId="",defaultProjectId="",
}:{
  initial?:StudioRecord|null;contacts:StudioRecord[];projects:StudioRecord[];
  onClose:()=>void;onSaved:()=>Promise<void>;defaultContactId?:string;defaultProjectId?:string;
}) {
  const details=initial?.details||{};
  const [title,setTitle]=useState(initial?.title||"Photography Invoice");
  const [contactId,setContactId]=useState(initial?.contactId||defaultContactId);
  const [projectId,setProjectId]=useState(initial?.projectId||defaultProjectId);
  const [email,setEmail]=useState(initial?.email||"");
  const [description,setDescription]=useState(initial?.description||"");
  const [currency,setCurrency]=useState(initial?.currency||"EUR");
  const [lines,setLines]=useState<Line[]>(details.lines?.length?details.lines.map((x:Line)=>({...x})):[{name:"",description:"",quantity:1,unitPrice:0}]);
  const [discount,setDiscount]=useState(Number(details.discountPercent)||0);
  const [tax,setTax]=useState(Number(details.taxPercent)||0);
  const [dueDate,setDueDate]=useState(safeDate(initial?.dueDate));
  const [notes,setNotes]=useState(details.notes||"Thank you for your business.");
  const [businessName,setBusinessName]=useState(details.businessName||"Gallerista Studio");
  const [brandColor,setBrandColor]=useState(inColor(details.brandColor||"#6337d8"));
  const [footerText,setFooterText]=useState(details.footerText||"Thank you for choosing our studio.");
  const [design,setDesign]=useState(false);
  const [preview,setPreview]=useState(Boolean(initial&&["paid","cancelled"].includes(initial.status)));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState<StudioRecord|null>(initial||null);
  const locked=saved?.status==="paid"||saved?.status==="cancelled";
  const total=useMemo(()=>{
    const subtotal=Math.round(lines.reduce((sum,row)=>sum+Math.max(0,row.quantity||0)*Math.max(0,row.unitPrice||0),0)*100)/100;
    const discountAmount=Math.round(subtotal*Math.min(100,Math.max(0,discount))/100*100)/100;
    const taxAmount=Math.round((subtotal-discountAmount)*Math.min(100,Math.max(0,tax))/100*100)/100;
    return {subtotal,discountAmount,taxAmount,total:Math.round((subtotal-discountAmount+taxAmount)*100)/100};
  },[lines,discount,tax]);
  const client=contacts.find(x=>x._id===contactId);
  const project=projects.find(x=>x._id===projectId);
  const setLine=(index:number,field:keyof Line,value:string|number)=>setLines(prev=>prev.map((line,i)=>i===index?{...line,[field]:value}:line));
  const data=()=>({
    title:title.trim(),type:"invoice",description,contactId,projectId,email,currency,
    ...(dueDate?{dueDate}:{}),
    details:{lines:lines.map(l=>({name:l.name.trim()||"Service",description:l.description,quantity:Number(l.quantity),unitPrice:Number(l.unitPrice)})),
      discountPercent:Number(discount),taxPercent:Number(tax),notes,businessName,brandColor,footerText},
  });
  async function save(send=false):Promise<StudioRecord|null>{
    if(!title.trim()){setError("Please name this invoice.");return null;}
    if(!contactId&&!email.trim()){setError("Choose a client or provide an email address.");return null;}
    if(lines.some(x=>!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isFinite(x.unitPrice)||x.unitPrice<0)){setError("All invoice items need valid quantities and prices.");return null;}
    if(locked){setError("Paid or cancelled invoices cannot be modified.");return null;}
    setBusy(true);setError("");
    try{
      let record=saved?await studioUpdate("invoices",saved._id,data()):await studioCreate("invoices",data());
      setSaved(record);
      if(send){
        try{const result=await studioSendInvoice(record._id);record=result.record;setSaved(record);
          toast.success("SMTP accepted the invoice email. Check Inbox for its send log.");}
        catch(e){toast.error("Invoice saved, but email could not be sent");throw e;}
      }else toast.success(record.status==="draft"?"Invoice saved as a draft":"Invoice changes saved");
      await onSaved();
      return record;
    }catch(e){setError(e instanceof Error?e.message:"Unable to save invoice");return null;}
    finally{setBusy(false);}
  }
  const handleCopy=async()=>{
    if(!saved?._id){setError("Save this invoice first.");return;}
    try{await copyStudioPublicLink("invoices",saved._id);
      toast.success(saved.status==="draft"?"Shareable draft preview link copied":"Client invoice link copied");}
    catch(e){setError(e instanceof Error?e.message:"Could not copy the invoice link");}
  };
  const clientPreviewData={
    title,description,status:saved?.status||"draft",
    number:String(saved?.details?.number||"Draft"),clientName:client?.title||"Client",clientEmail:email||client?.email||"",
    amount:total.total,currency,dueDate:dueDate||undefined,notes,businessName,
    brandColor,footerText,lines,
    subtotal:total.subtotal,discount:total.discountAmount,tax:total.taxAmount,
  };
  const openClientPreview=()=>{
    if(busy)return;
    void previewStudioPublicDraft("invoices",async()=>{
      if(locked)return saved;
      return save();
    }).catch(e=>toast.error(e instanceof Error?e.message:"Could not open invoice preview."));
  };
  const recordManualPayment=async()=>{
    if(!saved||saved.status==="paid"||saved.status==="cancelled")return;
    const method=window.prompt("How did the client pay? (Cash, bank transfer, etc.)","Bank transfer");
    if(!method||!window.confirm("Confirm that "+money(saved.amount,saved.currency)+" has actually been received?"))return;
    setBusy(true);setError("");
    try{const result=await studioRecordPayment(saved._id,method);
      setSaved(result.invoice);toast.success("Invoice marked paid and transaction recorded");
      await onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Could not record payment");}
    finally{setBusy(false);}
  };
  return <main className="fixed inset-0 z-[100] overflow-y-auto bg-[#faf9fb] text-[#28232e] print:static print:bg-white">
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#edeaf0] bg-white px-6 py-3 print:hidden sm:px-10">
      <div className="flex items-center gap-4"><button onClick={onClose} aria-label="Back to invoices"><ArrowLeft className="size-5"/></button>
        <div><h1 className="text-sm font-semibold">{saved?.details?.number?"Invoice #"+saved.details.number:title}</h1>
          <p className="mt-1 text-xs text-[#6337d8]">{project?.title||"Studio invoice"} <span className="ml-2 bg-[#f0eef2] px-2 py-1 text-[10px] font-semibold uppercase text-[#8a8491]">{saved?.status==="sent"?"In Progress · Sent":saved?.status||"draft"}</span></p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={OUT} onClick={()=>setDesign(v=>!v)}><SlidersHorizontal className="size-4"/>{design?"Edit Items":"Edit Design"}</button>
        {preview&&!locked&&<button type="button" className={OUT} onClick={()=>setPreview(false)}>Edit Invoice</button>}
        <button type="button" className={OUT} onClick={openClientPreview}>
          <Eye className="size-4"/>Preview</button>
        {saved&&<button type="button" className={OUT} onClick={()=>void handleCopy()}><Copy className="size-4"/>Copy link</button>}
        <button type="button" className={OUT} onClick={()=>window.print()}><Printer className="size-4"/> Print</button>
        {saved&&!locked&&<select aria-label="Invoice status actions" className={OUT} disabled={busy} value=""
          onChange={e=>{
            const action=e.target.value;
            e.target.value="";
            if(action==="paid"){void recordManualPayment();return;}
            if(action==="cancel"&&!window.confirm("Cancel this invoice? The client will no longer be able to pay online."))return;
            if(action==="draft"&&!window.confirm("Revert to draft? The payment button will stop working until you send it again."))return;
            if(!["cancel","draft"].includes(action))return;
            setBusy(true);
            void studioUpdate("invoices",saved._id,{status:action==="cancel"?"cancelled":"draft"})
              .then(next=>{setSaved(next);toast.success("Invoice status updated");return onSaved();})
              .catch(err=>setError(err instanceof Error?err.message:"Cannot change invoice status"))
              .finally(()=>setBusy(false));
          }}>
          <option value="">Status Actions</option>
          <option value="paid">Record Manual Payment</option>
          {saved.status==="sent"&&<option value="draft">Move Back to Draft</option>}
          <option value="cancel">Cancel Invoice</option>
        </select>}
        {!locked&&<><button type="button" className={OUT} disabled={busy} onClick={()=>void save()}><Save className="size-4"/>Save {saved?.status==="sent"?"Changes":"Draft"}</button>
        <button type="button" className={CTA} disabled={busy} onClick={()=>void save(true)}><Mail className="size-4"/>{busy?"Saving…":"Send Invoice"}</button></>}
      </div>
    </header>
    {error&&<div role="alert" className="mx-auto mt-5 max-w-3xl bg-red-50 px-5 py-4 text-sm text-red-700 print:hidden">{error}</div>}
    {preview||locked?<div className="mx-auto max-w-[1000px] print:max-w-none">
      <StudioPublic kind="invoice" token="" ownerPreview data={clientPreviewData}/>
      {locked&&<p className="my-7 text-center text-xs text-[#777] print:hidden">This invoice is closed. Paid invoice amounts are read-only.</p>}
    </div>:<div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10">
      <section className="mx-auto w-full max-w-[800px] space-y-10">
        {design?<div className="space-y-8">
          <h2 className="text-xl font-semibold">Invoice Design</h2>
          <p className="text-xs leading-6 text-[#888]">These details appear on the printable invoice and shared invoice page.</p>
          <label className="block space-y-2 text-xs font-semibold">Business name <input className={INPUT} value={businessName} onChange={e=>setBusinessName(e.target.value)}/></label>
          <label className="flex items-center justify-between text-sm font-semibold">Accent color <input type="color" value={brandColor} onChange={e=>setBrandColor(e.target.value)} className="h-12 w-20"/></label>
          <label className="block space-y-2 text-xs font-semibold">Footer message<textarea className="min-h-24 w-full border border-[#e4e1e9] p-3 text-sm" value={footerText} onChange={e=>setFooterText(e.target.value)}/></label>
          <p className="border-l-2 border-[#6337d8] bg-[#f1edfc] p-4 text-xs leading-6 text-[#72628a]">Sent invoices offer Stripe and/or PayPal checkout using the same payment accounts connected in Store Settings. Payment is marked Paid after provider verification. Automated reminders are not enabled.</p>
        </div>:<>
          <div className="space-y-5">
            <h2 className="text-2xl font-medium">Invoice details</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-xs font-semibold">Invoice title <input className={INPUT} value={title} onChange={e=>setTitle(e.target.value)}/></label>
              <label className="space-y-2 text-xs font-semibold">Client <select className={INPUT} value={contactId} onChange={e=>{setContactId(e.target.value);if(e.target.value)setEmail("");}}><option value="">Choose a client</option>{contacts.map(x=><option key={x._id} value={x._id}>{x.title}</option>)}</select></label>
              <label className="space-y-2 text-xs font-semibold">Email (if no client selected)<input type="email" className={INPUT} value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@example.com"/></label>
              <label className="space-y-2 text-xs font-semibold">Project <select className={INPUT} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">No linked project</option>{projects.map(x=><option key={x._id} value={x._id}>{x.title}</option>)}</select></label>
            </div>
            <label className="block space-y-2 text-xs font-semibold">Description <textarea className="min-h-20 w-full border p-3 text-sm" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description of work"/></label>
          </div>
          <div>
            <h2 className="mb-5 text-xl font-medium">Items</h2>
            <div className="grid grid-cols-[minmax(0,2fr)_65px_115px_100px_30px] gap-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#a29da6]"><span>Items</span><span>Qty</span><span>Price</span><span>Amount</span><span/></div>
            <div className="mt-3 space-y-3">{lines.map((line,i)=><div key={i} className="grid grid-cols-[minmax(0,2fr)_65px_115px_100px_30px] items-start gap-2 bg-[#f4f3f6] p-3">
              <div className="space-y-2"><input className={INPUT} placeholder="Item name" value={line.name} onChange={e=>setLine(i,"name",e.target.value)}/>
                <input className={INPUT} placeholder="Item description" value={line.description} onChange={e=>setLine(i,"description",e.target.value)}/></div>
              <input type="number" aria-label="Quantity" min=".01" step=".01" className={INPUT} value={line.quantity} onChange={e=>setLine(i,"quantity",Number(e.target.value))}/>
              <input type="number" aria-label="Price" min="0" step=".01" className={INPUT} value={line.unitPrice} onChange={e=>setLine(i,"unitPrice",Number(e.target.value))}/>
              <p className="py-3 text-right text-[11px]">{money(line.quantity*line.unitPrice,currency)}</p>
              <button type="button" className="mt-2 text-[#a19aa8] hover:text-red-600" aria-label="Remove item" onClick={()=>setLines(rows=>rows.length>1?rows.filter((_,j)=>i!==j):rows)}><Trash2 className="size-4"/></button>
            </div>)}</div>
            <button type="button" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#6337d8]" onClick={()=>setLines(rows=>[...rows,{name:"",description:"",quantity:1,unitPrice:0}])}><Plus className="size-4"/> Add Item</button>
            <div className="mt-8 ml-auto max-w-[360px] space-y-4 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><strong>{money(total.subtotal,currency)}</strong></div>
              <label className="flex items-center justify-between gap-3 text-xs">Discount %<input className={INPUT+" !w-24"} type="number" min="0" max="100" step=".1" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label>
              <label className="flex items-center justify-between gap-3 text-xs">Tax %<input className={INPUT+" !w-24"} type="number" min="0" max="100" step=".1" value={tax} onChange={e=>setTax(Number(e.target.value))}/></label>
              <div className="flex justify-between border-t pt-4 text-lg font-semibold"><span>Total</span><strong>{money(total.total,currency)}</strong></div>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block space-y-2 text-xs font-semibold">Payment due on<input type="date" className={INPUT} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
            <label className="block space-y-2 text-xs font-semibold">Currency<select className={INPUT} value={currency} onChange={e=>setCurrency(e.target.value)}>{["BDT","USD","EUR","GBP","SGD","INR"].map(x=><option key={x}>{x}</option>)}</select></label>
          </div>
          <label className="block space-y-2 text-xs font-semibold">Notes and payment instructions<textarea className="min-h-[130px] w-full border border-[#e4e1e9] p-4 text-sm" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
          <div className="border border-[#eeeaf1] bg-white p-5 text-xs leading-6 text-[#8f8795]"><strong>Manual payment workflow</strong><p>When the studio receives payment, use “Record payment” from the Invoices list. Sending an invoice does not charge a card.</p></div>
        </>}
      </section>
      <aside className="self-start lg:sticky lg:top-28">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.15em] text-[#928b99]">Live preview</h3>
        <div className="pointer-events-none origin-top scale-[.93] border border-[#e4e0ea] bg-white shadow-sm">
          <InvoicePreview title={title} clientName={client?.title||"Client"} clientEmail={email||client?.email||""} number={saved?.details?.number||"Draft"} businessName={businessName}
            currency={currency} color={brandColor} notes={notes} footerText={footerText} dueDate={dueDate}
            lines={lines} subtotal={total.subtotal} discount={total.discountAmount} tax={total.taxAmount} total={total.total} compact/>
        </div>
      </aside>
    </div>}
  </main>;
}
function InvoicePreview({
  title,clientName,clientEmail,number,businessName,currency,color,notes,footerText,dueDate,lines,subtotal,discount,tax,total,compact,
}:{
  title:string;clientName:string;clientEmail?:string;number:string;businessName:string;currency:string;color:string;notes:string;footerText:string;dueDate:string;
  lines:Line[];subtotal:number;discount:number;tax:number;total:number;compact?:boolean;
}) {
  return <article className={"bg-white shadow-sm "+(compact?"p-5 text-[10px]":"p-9 text-sm sm:p-14")} aria-label="Invoice preview">
    <div className="flex items-start justify-between border-b pb-8" style={{borderColor:color}}>
      <div><p className="font-bold" style={{color}}>{businessName}</p><h1 className={"mt-4 font-semibold "+(compact?"text-lg":"text-3xl")}>{title}</h1></div>
      <div className="text-right text-[#888]"><p className="font-bold uppercase">Invoice</p><p className="mt-2">#{number}</p></div>
    </div>
    <div className="mt-9 flex justify-between gap-5"><div><p className="text-[#999]">Bill to</p><p className="mt-2 font-bold">{clientName}</p>{clientEmail&&<p className="mt-1 break-all text-[10px] text-[#888]">{clientEmail}</p>}</div><div className="text-right"><p className="text-[#999]">Due date</p><p className="mt-2 font-semibold">{dueDate||"Upon receipt"}</p></div></div>
    <div className="mt-12 border-t text-left"><div className="grid grid-cols-[1fr_45px_90px] border-b py-4 font-semibold"><span>Item</span><span>Qty</span><span className="text-right">Total</span></div>
      {lines.map((line,i)=><div key={i} className="grid grid-cols-[1fr_45px_90px] gap-2 border-b py-4"><span>{line.name||"Service"}</span><span>{line.quantity}</span><span className="text-right">{money(line.quantity*line.unitPrice,currency)}</span></div>)}
    </div>
    <div className="ml-auto mt-6 max-w-xs space-y-3"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal,currency)}</span></div>{discount>0&&<div className="flex justify-between"><span>Discount</span><span>-{money(discount,currency)}</span></div>}
      {tax>0&&<div className="flex justify-between"><span>Tax</span><span>{money(tax,currency)}</span></div>}
      <div className="flex justify-between border-t pt-4 font-bold"><span>Total</span><span>{money(total,currency)}</span></div></div>
    <div className="mt-12 border-t pt-6"><h3 className="font-semibold">Notes & payment information</h3><p className="mt-3 whitespace-pre-wrap leading-6 text-[#888]">{notes}</p></div>
    <footer className="mt-12 border-t pt-5 text-center text-[#aaa]">{footerText}</footer>
  </article>;
}

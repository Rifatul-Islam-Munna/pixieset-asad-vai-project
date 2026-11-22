"use client";

import {useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Check,Copy,ExternalLink,ImagePlus,Loader2,Plus,Trash2,UploadCloud} from "lucide-react";
import {toast} from "sonner";
import {studioCreate,studioUpdate,type StudioRecord} from "@/actions/studio";
import {studioPaymentLinkSites,type PaymentLinkConfig,type StudioSites} from "@/actions/studio-payment-links";

const INPUT="mt-2 min-h-11 w-full border border-[#e6e4e8] bg-white px-4 text-[13px] outline-none focus:border-[#6337d8]";
const PURPLE="inline-flex min-h-11 items-center justify-center gap-2 bg-[#6337d8] px-5 text-xs font-bold text-white disabled:opacity-40";
const CURRENCIES=["EUR","USD","GBP","SGD"];
const START={
  slug:"",siteSlug:"",coverImageUrl:"",fixedAmount:true,allowCustomAmount:false,
  presetAmounts:[25,50,100],allowTips:true,tipPresets:[5,10,20],
  confirmationMessage:"Thank you for your payment! We really appreciate your support.",
  createProject:true,projectType:"other",projectStage:"booked",notes:"",
} satisfies PaymentLinkConfig;
const numberValue=(v:string)=>Math.round((Number(v)||0)*100)/100;
const slugify=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50);
const domainName=(domain:string,site:string)=>site+"."+domain;

export function StudioPaymentLinkEditor({
  initial,onClose,onSaved,
}:{
  initial:StudioRecord|null;
  onClose:()=>void;
  onSaved:()=>Promise<void>;
}){
  const [title,setTitle]=useState(initial?.title||"");
  const [description,setDescription]=useState(initial?.description||"");
  const [currency,setCurrency]=useState(initial?.currency||"EUR");
  const [amount,setAmount]=useState(Number(initial?.amount||100));
  const [settings,setSettings]=useState<PaymentLinkConfig>(()=>({
    ...START,...(initial?.details||{}),
    presetAmounts:Array.isArray(initial?.details?.presetAmounts)?initial.details.presetAmounts:START.presetAmounts,
    tipPresets:Array.isArray(initial?.details?.tipPresets)?initial.details.tipPresets:START.tipPresets,
    slug:initial?.details?.slug||slugify(initial?.title||""),
  }));
  const [sites,setSites]=useState<StudioSites|null>(null);
  const [busy,setBusy]=useState(false);
  const [loadingSites,setLoadingSites]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");
  const [status,setStatus]=useState(initial?.status||"active");
  const [manualSlug,setManualSlug]=useState(Boolean(initial?.details?.slug));
  const set=<K extends keyof PaymentLinkConfig>(key:K,value:PaymentLinkConfig[K])=>{
    setSettings(old=>({...old,[key]:value}));
  };
  useEffect(()=>{
    let active=true;
    void studioPaymentLinkSites().then(result=>{
      if(!active)return;
      setSites(result);
      setSettings(old=>({...old,siteSlug:old.siteSlug||result.sites[0]?.slug||""}));
    }).catch(err=>{if(active)setError(err instanceof Error?err.message:"Could not load your subdomains")})
      .finally(()=>{if(active)setLoadingSites(false)});
    return ()=>{active=false;};
  },[]);
  const publicUrl=(recordToken?:string)=>{
    const site=settings.siteSlug;
    const root=sites?.rootDomain||"localhost";
    const slug=settings.slug;
    if(site&&slug&&root!=="localhost"&&/^[a-z0-9.-]+$/i.test(root))
      return "https://"+domainName(root,site)+"/payment/"+slug;
    return recordToken?window.location.origin+"/studio/payment/"+encodeURIComponent(recordToken):"";
  };
  const upload=async(file:File|null)=>{
    if(!file)return;
    if(file.size>5*1024*1024||!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){
      toast.error("Use a JPG, PNG, WebP or AVIF under 5 MB");return;
    }
    setUploading(true);setError("");
    try{
      const form=new FormData();form.append("file",file);
      const response=await fetch("/api/studio/payment-link-cover",{method:"POST",body:form});
      const result=await response.json();
      if(!response.ok||!result.url)throw Error(result.message||"Image upload failed");
      set("coverImageUrl",String(result.url));
      toast.success("Payment link image uploaded");
    }catch(err){setError(err instanceof Error?err.message:"Could not upload cover image")}
    finally{setUploading(false);}
  };
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError("");
    if(!title.trim()){setError("Add a payment link title");return;}
    if(!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(settings.slug)){
      setError("Use a short URL containing lowercase letters, numbers and hyphens.");return;
    }
    if(settings.fixedAmount&&amount<=0){setError("Enter a fixed amount greater than zero");return;}
    if(!settings.fixedAmount&&!settings.allowCustomAmount&&!settings.presetAmounts.length){
      setError("Add preset amounts or enable custom amounts");return;
    }
    setBusy(true);
    try{
      const payload={
        title:title.trim(),description:description.trim(),type:"reusable",
        currency,status,amount:settings.fixedAmount?amount:0,
        details:{...settings,slug:settings.slug.trim()},
      };
      if(initial)await studioUpdate("payment-links",initial._id,payload);
      else await studioCreate("payment-links",payload);
      toast.success("Reusable payment link saved");
      await onSaved();
    }catch(err){setError(err instanceof Error?err.message:"Unable to save payment link")}
    finally{setBusy(false);}
  };
  const copy=async()=>{
    const url=publicUrl(initial?.token);
    if(!url){toast.error("Save the link before copying its URL");return;}
    try{await navigator.clipboard.writeText(url);toast.success("Payment link copied")}
    catch{toast.error("Cannot access clipboard")}
  };
  return <div className="fixed inset-0 z-[140] flex flex-col bg-white text-[#292530]" role="dialog" aria-modal="true" aria-label="Reusable payment link editor">
    <header className="flex h-[68px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#eeeaf0] px-5 sm:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label="Close payment link editor" onClick={onClose} className="rounded p-1.5 hover:bg-[#f5f2fc]"><ArrowLeft className="size-5"/></button>
        <div><h1 className="text-lg font-semibold">{initial?"Edit payment link":"Create a reusable payment link"}</h1>
          <p className="mt-0.5 text-[11px] text-[#99909d]">Studio Manager · Payments</p></div>
      </div>
      <div className="flex items-center gap-3">
        {initial&&<button type="button" onClick={()=>void copy()} className="inline-flex items-center gap-2 text-xs text-[#6337d8]"><Copy className="size-4"/>Copy Link</button>}
        {initial&&publicUrl(initial.token)&&<a href={publicUrl(initial.token)} target="_blank" rel="noreferrer"
          className="hidden items-center gap-1 text-xs text-[#6337d8] sm:inline-flex">Preview <ExternalLink className="size-3.5"/></a>}
        <button type="submit" form="studio-payment-link-form" disabled={busy||uploading||loadingSites} className={PURPLE}>
          {busy?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}{busy?"Saving…":"Save Payment Link"}
        </button>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfafc] px-5 py-8 sm:px-9">
      <div className="mx-auto grid w-full max-w-[1280px] gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
        <form id="studio-payment-link-form" onSubmit={e=>void submit(e)} className="space-y-8 bg-white px-6 py-7 shadow-sm sm:px-9">
          <div className="space-y-5">
            <h2 className="border-b border-[#eee] pb-4 text-[16px] font-semibold">Payment link details</h2>
            <label className="block text-xs font-semibold">Title *
              <input autoFocus maxLength={220} required className={INPUT} value={title} placeholder="Deposits, Tips, Wedding booking…"
                onChange={e=>{
                  const value=e.target.value;setTitle(value);
                  if(!manualSlug)set("slug",slugify(value));
                }}/>
            </label>
            <label className="block text-xs font-semibold">Description
              <textarea maxLength={2000} rows={3} className={INPUT+" resize-y py-3"} value={description}
                onChange={e=>setDescription(e.target.value)} placeholder="Secure your booking by paying the deposit here."/>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold">Currency
                <select className={INPUT} value={currency} onChange={e=>setCurrency(e.target.value)}>
                  {CURRENCIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">Status
                <select className={INPUT} value={status} onChange={e=>setStatus(e.target.value)}>
                  <option value="active">Active · Accept payments</option><option value="draft">Draft · Private</option>
                  <option value="cancelled">Disabled</option>
                </select>
              </label>
            </div>
          </div>
          <div className="space-y-4 border-t border-[#eee] pt-7">
            <h3 className="text-[15px] font-semibold">Public URL</h3>
            <label className="block text-xs font-semibold">Your website
              <select className={INPUT} value={settings.siteSlug} onChange={e=>set("siteSlug",e.target.value)}>
                <option value="">Use a temporary token-based link</option>
                {sites?.sites.map(site=><option value={site.slug} key={site.slug}>{site.name} · {domainName(sites.rootDomain,site.slug)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">URL path *
              <div className="mt-2 flex items-center border border-[#e6e4e8] bg-white">
                <span className="px-4 text-xs text-[#999]">/payment/</span>
                <input value={settings.slug} maxLength={50} onChange={e=>{setManualSlug(true);set("slug",slugify(e.target.value));}}
                  className="h-11 min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none" placeholder="tips"/>
              </div>
              <span className="mt-2 block break-all text-[11px] font-normal text-[#8b8391]">
                {settings.siteSlug&&sites&&sites.rootDomain!=="localhost"
                  ?domainName(sites.rootDomain,settings.siteSlug)+"/payment/"+(settings.slug||"…")
                  :"Local preview uses the token URL until your website subdomain is configured"}
              </span>
            </label>
          </div>
          <div className="space-y-5 border-t border-[#eee] pt-7">
            <h3 className="text-[15px] font-semibold">Payment amounts</h3>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={settings.fixedAmount} onChange={e=>set("fixedAmount",e.target.checked)}/>
              Require a fixed payment amount
            </label>
            {settings.fixedAmount?
              <label className="block text-xs font-semibold">Amount ({currency})
                <input className={INPUT} type="number" min="0.01" max="1000000" step="0.01" value={amount}
                  onChange={e=>setAmount(numberValue(e.target.value))}/>
              </label>:
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={settings.allowCustomAmount}
                  onChange={e=>set("allowCustomAmount",e.target.checked)}/>Allow customer to enter a custom amount</label>
                <p className="text-xs text-[#938b99]">Suggested preset amounts</p>
                {settings.presetAmounts.map((value,i)=><div key={i} className="flex gap-3">
                  <div className="flex min-w-0 flex-1 items-center border border-[#e6e4e8] px-3">
                    <span className="mr-2 text-xs text-[#968c9a]">{currency}</span>
                    <input type="number" min="0.01" max="1000000" step="0.01" aria-label={"Preset amount "+(i+1)}
                      value={value} onChange={e=>set("presetAmounts",settings.presetAmounts.map((a,j)=>j===i?numberValue(e.target.value):a))}
                      className="h-11 w-full text-sm outline-none"/>
                  </div>
                  <button type="button" aria-label={"Remove preset "+(i+1)} onClick={()=>set("presetAmounts",settings.presetAmounts.filter((_,j)=>j!==i))}
                    className="p-3 text-[#a299aa] hover:text-red-600"><Trash2 className="size-4"/></button>
                </div>)}
                {settings.presetAmounts.length<8&&<button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6337d8]" onClick={()=>set("presetAmounts",[...settings.presetAmounts,Math.max(1,(settings.presetAmounts.at(-1)||25)*2)])}>
                  <Plus className="size-4"/>Add preset amount</button>}
              </div>}
            <div className="border-t border-[#eee] pt-5">
              <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={settings.allowTips}
                onChange={e=>set("allowTips",e.target.checked)}/>Allow clients to add an optional tip</label>
              {settings.allowTips&&<div className="mt-4">
                <p className="mb-3 text-xs text-[#938b99]">Suggested tip amounts (client can also enter a custom tip)</p>
                <div className="flex flex-wrap gap-3">
                  {settings.tipPresets.map((value,i)=><div className="flex items-center gap-1 border border-[#e6e4e8] pl-3" key={i}>
                    <span className="text-[11px] text-[#968b9b]">{currency}</span>
                    <input className="h-9 w-14 bg-transparent text-xs outline-none" type="number" min="0.01" max="100000" step="0.01"
                      value={value} aria-label={"Tip preset "+(i+1)}
                      onChange={e=>set("tipPresets",settings.tipPresets.map((v,j)=>j===i?numberValue(e.target.value):v))}/>
                    <button type="button" className="p-2" aria-label={"Remove tip "+(i+1)} onClick={()=>set("tipPresets",settings.tipPresets.filter((_,j)=>j!==i))}><Trash2 className="size-3 text-[#aaa]"/></button>
                  </div>)}
                  {settings.tipPresets.length<8&&<button type="button" onClick={()=>set("tipPresets",[...settings.tipPresets,5])}
                    className="flex items-center gap-1 px-2 text-xs font-semibold text-[#6337d8]"><Plus className="size-3"/>Add tip</button>}
                </div>
              </div>}
            </div>
          </div>
          <div className="space-y-4 border-t border-[#eee] pt-7">
            <h3 className="text-[15px] font-semibold">Cover image</h3>
            <label className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center border border-dashed border-[#cfc2e3] bg-[#fbf9ff] p-5 text-center text-xs text-[#746584] hover:bg-[#f3eefc]">
              {uploading?<Loader2 className="mb-3 size-7 animate-spin"/>:<UploadCloud className="mb-3 size-7"/>}
              <span className="font-semibold">{uploading?"Uploading image…":"Upload cover image"}</span>
              <span className="mt-1 text-[11px] text-[#9e94a8]">JPG, PNG, WebP or AVIF · Max 5 MB</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploading||busy}
                onChange={e=>void upload(e.target.files?.[0]||null)}/>
            </label>
            {settings.coverImageUrl&&<div className="flex items-center gap-3"><span className="truncate text-[11px] text-[#888]">Image uploaded · Ready for public checkout</span>
              <button type="button" className="text-xs font-semibold text-red-600" onClick={()=>set("coverImageUrl","")}>Remove</button></div>}
          </div>
          <div className="space-y-5 border-t border-[#eee] pt-7">
            <h3 className="text-[15px] font-semibold">After payment</h3>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={settings.createProject}
              onChange={e=>set("createProject",e.target.checked)}/>Create a project and contact after a verified payment</label>
            {settings.createProject&&<div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold">Project type
                <select className={INPUT} value={settings.projectType} onChange={e=>set("projectType",e.target.value)}>
                  {["other","portrait","wedding","event","commercial"].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">Initial project stage
                <select className={INPUT} value={settings.projectStage} onChange={e=>set("projectStage",e.target.value)}>
                  {["booked","inquiry","post-production"].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}
                </select>
              </label>
            </div>}
            <label className="block text-xs font-semibold">Confirmation message
              <textarea maxLength={1000} rows={4} className={INPUT+" resize-y py-3"} value={settings.confirmationMessage}
                onChange={e=>set("confirmationMessage",e.target.value)} placeholder="Thank you for your support!"/>
            </label>
            <label className="block text-xs font-semibold">Additional payment instructions (optional)
              <textarea maxLength={2000} rows={2} className={INPUT+" resize-y py-3"} value={settings.notes}
                onChange={e=>set("notes",e.target.value)}/>
            </label>
          </div>
          {error&&<p role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 border-t pt-6">
            <button type="button" className="h-11 border border-[#e3dfe9] px-5 text-xs font-semibold" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={busy||uploading||loadingSites} className={PURPLE}>
              {busy?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}Save Payment Link
            </button>
          </div>
        </form>
        <aside className="h-fit space-y-4 lg:sticky lg:top-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#938a9c]">Client page preview</p>
          {settings.coverImageUrl?<div className="h-[150px] overflow-hidden bg-[#e9e9ed]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.coverImageUrl} alt="Payment link cover" className="size-full object-cover"/>
          </div>:<div className="grid h-[150px] place-items-center bg-gradient-to-br from-[#d9d1ed] to-[#f7f4fc] text-[#8779a9]"><ImagePlus className="size-12 stroke-[1.2]"/></div>}
          <div className="bg-white p-7 shadow-[0_5px_20px_rgba(30,20,40,.07)]">
            <h2 className="text-lg font-semibold">{title||"Payment link"}</h2>
            <p className="mt-3 text-xs leading-6 text-[#777]">{description||"Your payment link description will appear here."}</p>
            <h3 className="mt-8 text-sm font-semibold">Payments</h3>
            <div className="mt-4 flex justify-between border-b pb-3 text-xs"><span>Amount</span>
              <strong>{settings.fixedAmount?currency+" "+amount.toFixed(2):"Client chooses amount"}</strong></div>
            {settings.allowTips&&<div className="flex justify-between border-b py-3 text-xs"><span>Tips</span><span>Optional</span></div>}
            <p className="mt-7 text-xs text-[#918899]">Client enters name, email and an optional message before going to secure checkout.</p>
            <div className="mt-5 bg-[#6337d8] py-3 text-center text-[11px] font-bold text-white">CONTINUE TO PAYMENT</div>
          </div>
          <p className="text-[11px] leading-5 text-[#938a9b]">Preview only. No payment is processed here. Save and open your link to test its public checkout.</p>
        </aside>
      </div>
    </div>
  </div>;
}

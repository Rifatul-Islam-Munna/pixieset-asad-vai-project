"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Eye, LayoutTemplate, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { studioCreate, studioUpdate, type StudioRecord } from "@/actions/studio";
import {StudioPublic} from "./studio-public";
import {copyStudioPublicLink,previewStudioPublicDraft} from "./studio-public-links";

type Question = { name:string; label:string; type:string; required:boolean; options?:string };
const INPUT = "w-full border border-[#e4e1e8] bg-white px-3 py-3 text-sm outline-none focus:border-[#6337d8]";
const BTN = "inline-flex min-h-10 items-center justify-center gap-2 px-5 text-xs font-bold transition";
const PURPLE = BTN + " bg-[#6337d8] text-white hover:bg-[#5225c5]";
const LIGHT = BTN + " border border-[#ded9e7] bg-white text-[#554d61] hover:bg-[#f5f1fc]";

function keyFromLabel(label:string, index:number) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60) || "question-"+(index+1);
}
function goodColor(color:string) { return /^#[a-f0-9]{6}$/i.test(color) ? color : "#6337d8"; }
export function StudioFormDesigner({
  initial, onClose, onSaved,
}: { initial?:StudioRecord|null; onClose:()=>void; onSaved:()=>Promise<void> }) {
  const value = initial?.details || {};
  const [title,setTitle]=useState(initial?.title||"New Contact Form");
  const [description,setDescription]=useState(initial?.description||"");
  const [contactType,setContactType]=useState(value.contactType||"lead");
  const [buttonLabel,setButtonLabel]=useState(value.buttonLabel||"Submit");
  const [successMessage,setSuccessMessage]=useState(value.successMessage||"Thank you for contacting us!");
  const [questions,setQuestions]=useState<Question[]>((value.fields||[]).map((x:Question)=>({...x})));
  const [showMessage,setShowMessage]=useState(value.showMessage!==false);
  const [accent,setAccent]=useState(goodColor(value.accentColor||"#6337d8"));
  const [background,setBackground]=useState(goodColor(value.backgroundColor||"#ffffff"));
  const [view,setView]=useState<"settings"|"design">("settings");
  const [preview,setPreview]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [savedRecord,setSavedRecord]=useState<StudioRecord|null>(initial||null);
  const status=savedRecord?.status||"draft";
  const input = (label:string,value:string,fn:(v:string)=>void,placeholder="",limit=1000)=>(
    <label className="block space-y-2"><span className="text-xs font-semibold text-[#39343e]">{label}</span>
      <input className={INPUT} value={value} placeholder={placeholder} maxLength={limit} onChange={(e)=>fn(e.target.value)}/></label>
  );
  const updateField=(i:number,patch:Partial<Question>)=>setQuestions(rows=>rows.map((r,j)=>j===i?{...r,...patch}:r));
  const payload=useMemo(()=>({
    title:title.trim(),description,type:"lead",status:savedRecord?.status||"draft",
    details:{ contactType,buttonLabel:buttonLabel.trim()||"Submit",
      successMessage:successMessage.trim()||"Thank you for contacting us!",
      showMessage,accentColor:goodColor(accent),backgroundColor:goodColor(background),
      fields:questions.map((q,i)=>({...q,name:keyFromLabel(q.label,i),label:q.label.trim()})),
    },
  }),[title,description,contactType,buttonLabel,successMessage,questions,accent,background,showMessage,savedRecord?.status]);

  async function save(publish=false):Promise<StudioRecord|null> {
    if (!title.trim()){setError("Please give this contact form a name.");return null;}
    if (questions.some(q=>!q.label.trim())){setError("Please label every custom question.");return null;}
    const keys=questions.map((q,i)=>keyFromLabel(q.label,i));
    if(new Set(keys).size!==keys.length){setError("Each form question must have a unique label.");return null;}
    setSaving(true);setError("");
    try {
      let current:StudioRecord;
      if (savedRecord) {
        current=await studioUpdate("forms",savedRecord._id,payload);
      } else {
        current=await studioCreate("forms",{...payload,status:"draft"});
      }
      if (publish) current=await studioUpdate("forms",current._id,{status:"published"});
      setSavedRecord(current);
      toast.success(publish?"Contact form published":"Contact form saved");
      await onSaved();
      return current;
    } catch(e){setError(e instanceof Error?e.message:"Unable to save form");return null;}
    finally{setSaving(false);}
  }

  const share=async()=>{
    if(!savedRecord?._id){setError("Save this form as a draft before sharing.");return;}
    try{await copyStudioPublicLink("forms",savedRecord._id);
      toast.success(status==="draft"?"Read-only draft preview link copied":"Public contact form link copied");}
    catch(e){setError(e instanceof Error?e.message:"Could not copy the form link");}
  };

  const clientPreviewData={
    title,description,
    fields:questions.map((q,i)=>({...q,name:keyFromLabel(q.label,i)})),
    buttonLabel:buttonLabel||"Submit",successMessage,showMessage,
    accentColor:goodColor(accent),backgroundColor:goodColor(background),
  };
  const openClientPreview=()=>{
    if(saving)return;
    void previewStudioPublicDraft("forms",()=>save(false))
      .catch(e=>toast.error(e instanceof Error?e.message:"Could not open the public form preview."));
  };
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f8f8fa] text-[#25212b]">
    <header className="sticky top-0 z-20 flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-[#e9e8ed] bg-white px-5 py-3 sm:px-9">
      <div className="flex min-w-0 items-center gap-4">
        <button type="button" onClick={onClose} aria-label="Back to contact forms"><ArrowLeft className="size-5"/></button>
        <div className="min-w-0"><div className="flex items-center gap-3"><strong className="max-w-64 truncate text-sm">{title||"Contact Form"}</strong>
          <span className="bg-[#f5f2f7] px-2 py-1 text-[10px] font-semibold uppercase text-[#85818c]">{status}</span></div>
          <p className="text-[10px] text-[#9a96a0]">Contact form designer</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={LIGHT} onClick={()=>void share()} disabled={!savedRecord}><Copy className="size-3.5"/> Copy link</button>
        <button type="button" className={LIGHT} onClick={()=>setView(v=>v==="design"?"settings":"design")}><LayoutTemplate className="size-3.5"/>{view==="design"?"Settings":"Edit Design"}</button>
        {preview&&<button type="button" className={LIGHT} onClick={()=>setPreview(false)}>Edit Form</button>}
        <button type="button" className={LIGHT} onClick={openClientPreview}>
          <Eye className="size-3.5"/>Preview</button>
        <button type="button" className={LIGHT} disabled={saving} onClick={()=>void save(false)}>{status==="published"?"Save Changes":"Save Draft"}</button>
        <button type="button" className={PURPLE} disabled={saving} onClick={()=>void save(true)}><Check className="size-3.5"/>{saving?"Saving…":"Publish"}</button>
      </div>
    </header>
    <div className="grid min-h-[calc(100vh-58px)] md:grid-cols-[310px_minmax(0,1fr)]">
      {!preview&&<aside className="border-r border-[#e8e6ea] bg-white p-6 md:sticky md:top-[58px] md:h-[calc(100vh-58px)] md:overflow-y-auto">
        {view==="settings"?<div className="space-y-7">
          <h2 className="text-base font-semibold">Settings</h2>
          <label className="block space-y-2"><span className="text-xs font-semibold">New contact type</span>
            <select className={INPUT} value={contactType} onChange={(e)=>setContactType(e.target.value)}>
              <option value="lead">Lead</option><option value="client">Client</option><option value="other">Other</option>
            </select><span className="block text-[11px] leading-5 text-[#96919a]">New inquiries are added to Contacts with this classification.</span>
          </label>
          {input("Form title",title,setTitle,"New Contact Form",180)}
          {input("Button label",buttonLabel,setButtonLabel,"Submit",70)}
          <label className="block space-y-2"><span className="text-xs font-semibold">Form description</span>
            <textarea className={INPUT+" min-h-24 resize-y"} value={description} onChange={(e)=>setDescription(e.target.value)}/></label>
          <div className="border-t border-[#eeeaf1] pt-5">
            <h3 className="text-xs font-semibold">After form submission</h3>
            <p className="mt-3 text-xs text-[#86808c]">Show a success message</p>
            {input("Success message",successMessage,setSuccessMessage,"Thank you!",300)}
          </div>
          <div className="border-t border-[#eeeaf1] pt-5">
            <h3 className="text-sm font-semibold">Form fields</h3>
            <p className="mt-1 text-[11px] leading-5 text-[#9d97a3]">First name, last name and email are included automatically.</p>
            <label className="mt-4 flex items-center gap-2 text-xs"><input type="checkbox" checked={showMessage} onChange={(e)=>setShowMessage(e.target.checked)}/> Include message field</label>
            <div className="mt-5 space-y-4">{questions.map((q,i)=><div key={i} className="space-y-2 border border-[#edeaf1] p-3">
              <div className="flex gap-2"><input className={INPUT} placeholder={"Question "+(i+1)} value={q.label} onChange={(e)=>updateField(i,{label:e.target.value})}/>
                <button type="button" aria-label="Remove question" onClick={()=>setQuestions(prev=>prev.filter((_,j)=>j!==i))}><Trash2 className="size-4 text-[#999]"/></button></div>
              <select className={INPUT} value={q.type} onChange={(e)=>updateField(i,{type:e.target.value})}>
                <option value="text">Short text</option><option value="textarea">Long text</option><option value="select">Dropdown</option><option value="date">Date</option>
              </select>
              {q.type==="select"&&input("Options (comma separated)",q.options||"",(v)=>updateField(i,{options:v}))}
              <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={q.required} onChange={(e)=>updateField(i,{required:e.target.checked})}/> Required</label>
            </div>)}</div>
            <button type="button" className={LIGHT+" mt-4"} onClick={()=>setQuestions(prev=>[...prev,{name:"question-"+(prev.length+1),label:"",type:"text",required:false}])}>
              <Plus className="size-4"/> Add field
            </button>
          </div>
        </div>:<div className="space-y-8">
          <h2 className="text-base font-semibold">Form design</h2>
          <p className="text-xs leading-6 text-[#888]">Customize the client form preview. Your studio colors remain the default.</p>
          <label className="flex items-center justify-between text-sm">Accent color<input type="color" value={goodColor(accent)} onChange={(e)=>setAccent(e.target.value)} className="h-12 w-16 cursor-pointer"/></label>
          <label className="flex items-center justify-between text-sm">Paper color<input type="color" value={goodColor(background)} onChange={(e)=>setBackground(e.target.value)} className="h-12 w-16 cursor-pointer"/></label>
          <button className={LIGHT} onClick={()=>{setAccent("#6337d8");setBackground("#ffffff");}} type="button">Restore Gallerista theme</button>
        </div>}
      </aside>}
      <section className="min-w-0 bg-[#f7f7f8]">
        {preview?<StudioPublic kind="form" token="" ownerPreview data={clientPreviewData}/>:
          <div className="flex min-w-0 items-start justify-center px-5 py-10 sm:px-10 sm:py-14">
        <div className="w-full max-w-[690px] px-7 py-12 shadow-sm sm:px-14" style={{backgroundColor:goodColor(background)}}>
          <p className="mb-9 text-[10px] font-semibold uppercase tracking-[.18em] text-[#9b96a0]">Studio contact form</p>
          <h1 className="mb-4 text-2xl font-semibold" style={{color:goodColor(accent)}}>{title||"New Contact Form"}</h1>
          {description&&<p className="mb-8 whitespace-pre-wrap text-sm leading-6 text-[#8d8792]">{description}</p>}
          <div className="space-y-8">
            {[["First Name","John"],["Last Name","Smith"],["Email","name@example.com"]].map(([label,hint],i)=><label key={label} className="block space-y-3">
              <span className="flex justify-between text-[13px] font-semibold">{label}<span className="text-[11px] font-normal text-[#999]">{i===1?"Optional":"Required"}</span></span>
              <input readOnly aria-label={label} className="w-full border-0 border-b border-[#ddd7e4] bg-transparent py-3 text-xs outline-none" placeholder={hint}/>
            </label>)}
            {questions.map((field,i)=><label key={i} className="block space-y-3">
              <span className="flex justify-between text-[13px] font-semibold">{field.label||"New question"}<span className="text-[11px] font-normal text-[#999]">{field.required?"Required":"Optional"}</span></span>
              {field.type==="textarea"?<textarea readOnly className="min-h-[64px] w-full resize-none border-0 border-b bg-transparent py-2 text-sm outline-none" placeholder="Type your answer"/>:
               field.type==="select"?<select disabled className="w-full border-0 border-b bg-transparent py-3 text-sm"><option>Choose an option</option>{(field.options||"").split(",").map((v)=><option key={v}>{v}</option>)}</select>:
               <input readOnly type={field.type==="date"?"date":"text"} className="w-full border-0 border-b bg-transparent py-3 text-sm outline-none" placeholder="Type your answer"/>}
            </label>)}
            {showMessage&&<label className="block space-y-3"><span className="text-[13px] font-semibold">Message</span>
              <textarea readOnly className="min-h-[70px] w-full resize-none border-0 border-b bg-transparent py-2 text-xs outline-none" placeholder="Type your message"/></label>}
            <button disabled type="button" className="mt-3 min-w-40 px-6 py-4 text-xs font-bold uppercase tracking-[.08em] text-white opacity-90" style={{backgroundColor:goodColor(accent)}}>{buttonLabel||"Submit"}</button>
            <p className="text-[11px] text-[#999]">{preview?"Preview mode — no information will be submitted.":"Changes appear in this preview as you edit."}</p>
          </div>
        </div></div>}
      </section>
    </div>
    {error&&<div role="alert" className="fixed bottom-5 left-1/2 z-[110] max-w-xl -translate-x-1/2 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-lg">{error}<button type="button" className="ml-4" onClick={()=>setError("")}><X className="inline size-4"/></button></div>}
  </div>;
}

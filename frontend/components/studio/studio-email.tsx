"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Mail, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  studioList, studioSendEmail, studioUseTemplate,
  type StudioRecord,
} from "@/actions/studio";

const INPUT="h-11 w-full border border-[#e7e3ee] bg-white px-3 text-sm outline-none focus:border-[#6337d8]";
const CTA="inline-flex min-h-10 items-center justify-center gap-2 bg-[#6337d8] px-5 text-xs font-bold text-white hover:bg-[#5129be] disabled:opacity-50";
const OUT="inline-flex min-h-10 items-center justify-center gap-2 border border-[#e9e5ed] px-5 text-xs font-semibold hover:bg-[#f9f7fb]";
function getEmailTemplateContent(record:StudioRecord){return String(record.details?.content||"");}

export function StudioEmailComposer({
  contacts,projects,initialContactId="",initialEmail="",initialProjectId="",initialTemplate,onClose,onSent,
}:{
  contacts:StudioRecord[];projects:StudioRecord[];
  initialContactId?:string;initialProjectId?:string;initialEmail?:string;
  initialTemplate?:StudioRecord|null;onClose:()=>void;onSent:()=>Promise<void>;
}) {
  const [contactId,setContactId]=useState(initialContactId);
  const [projectId,setProjectId]=useState(initialProjectId);
  const [email,setEmail]=useState(initialEmail);
  const [subject,setSubject]=useState(initialTemplate?.title||"");
  const [message,setMessage]=useState(initialTemplate?getEmailTemplateContent(initialTemplate):"");
  const [templates,setTemplates]=useState<StudioRecord[]>([]);
  const [templateId,setTemplateId]=useState(initialTemplate?initialTemplate._id:"");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void studioList("templates",{limit:250}).then(data=>{
      if(active)setTemplates(data.items.filter(x=>x.type==="email"));
    }).catch(()=>undefined);
    return ()=>{active=false;};
  },[]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError("");setBusy(true);
    try{
      await studioSendEmail({contactId,projectId,email,subject,content:message});
      toast.success("Email sent");
      await onSent();
    }catch(e){setError(e instanceof Error?e.message:"Could not send email");}
    finally{setBusy(false);}
  };
  return <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-[#171321]/55 p-4 py-12" role="dialog" aria-modal="true" aria-label="Compose Studio Email">
    <form onSubmit={e=>void submit(e)} className="w-full max-w-[670px] bg-white px-7 py-8 shadow-2xl sm:px-10">
      <div className="mb-8 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#9992a2]">Studio Inbox</p><h2 className="mt-2 flex items-center gap-2 text-xl font-semibold"><Mail className="size-5 text-[#6337d8]"/> Compose Email</h2></div>
        <button type="button" aria-label="Close" onClick={onClose}><X className="size-5"/></button></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-2 text-xs font-semibold">Contact<select className={INPUT} value={contactId} onChange={e=>{setContactId(e.target.value);if(e.target.value)setEmail("");}}><option value="">Direct email address</option>{contacts.map(c=><option value={c._id} key={c._id}>{c.title} ({c.email})</option>)}</select></label>
        <label className="block space-y-2 text-xs font-semibold">Email (if no contact)<input className={INPUT} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@example.com"/></label>
        <label className="block space-y-2 text-xs font-semibold">Project (optional)<select className={INPUT} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">No linked project</option>{projects.map(p=><option value={p._id} key={p._id}>{p.title}</option>)}</select></label>
        <label className="block space-y-2 text-xs font-semibold">Email template<select className={INPUT} value={templateId} onChange={e=>{
          setTemplateId(e.target.value);const template=templates.find(x=>x._id===e.target.value);
          if(template){setSubject(template.title);setMessage(getEmailTemplateContent(template));}
        }}><option value="">Write without template</option>{templates.map(t=><option key={t._id} value={t._id}>{t.title}</option>)}</select></label>
      </div>
      <label className="mt-6 block space-y-2 text-xs font-semibold">Subject *<input className={INPUT} value={subject} required maxLength={180} onChange={e=>setSubject(e.target.value)}/></label>
      <label className="mt-6 block space-y-2 text-xs font-semibold">Message *<textarea className="min-h-[240px] w-full border border-[#e7e3ee] p-4 text-sm leading-7 outline-none focus:border-[#6337d8]" value={message} required maxLength={12000} onChange={e=>setMessage(e.target.value)}/></label>
      <p className="mt-4 text-xs leading-6 text-[#938b99]">Messages are sent using your configured studio SMTP service. A copy of each successful outgoing email is saved in your Inbox.</p>
      {error&&<p role="alert" className="mt-5 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-8 flex justify-end gap-3 border-t pt-6"><button type="button" className={OUT} onClick={onClose}>Cancel</button><button disabled={busy} className={CTA}><Send className="size-4"/>{busy?"Sending…":"Send Email"}</button></div>
    </form>
  </div>;
}

export function StudioTemplateUseDialog({
  template,contacts,projects,onClose,onCreated,
}:{
  template:StudioRecord;contacts:StudioRecord[];projects:StudioRecord[];
  onClose:()=>void;onCreated:(record:StudioRecord)=>Promise<void>;
}) {
  const [contactId,setContactId]=useState("");
  const [email,setEmail]=useState("");
  const [projectId,setProjectId]=useState("");
  const [currency,setCurrency]=useState(template.currency||"EUR");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError("");setBusy(true);
    try{
      const record=await studioUseTemplate(template._id,{contactId,email,projectId,currency});
      toast.success("Document created from template");
      await onCreated(record);
    }catch(e){setError(e instanceof Error?e.message:"Could not create from template");}
    finally{setBusy(false);}
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#171321]/55 p-4" role="dialog" aria-modal="true" aria-label="Use Template">
    <form onSubmit={e=>void submit(e)} className="w-full max-w-xl bg-white p-8 shadow-2xl sm:p-10">
      <div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-wider text-[#999]">Template</p><h2 className="mt-2 text-xl font-semibold">Use {template.title}</h2><p className="mt-2 text-sm text-[#777]">Create a {template.type} with the client and project details below.</p></div><button type="button" onClick={onClose} aria-label="Close"><X className="size-5"/></button></div>
      <div className="mt-8 space-y-5">
        <label className="block space-y-2 text-xs font-semibold">Client<select className={INPUT} value={contactId} onChange={e=>{setContactId(e.target.value);if(e.target.value)setEmail("");}}><option value="">Choose a client</option>{contacts.map(c=><option key={c._id} value={c._id}>{c.title}</option>)}</select></label>
        <label className="block space-y-2 text-xs font-semibold">Client email (if no saved client)<input className={INPUT} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="jane@example.com"/></label>
        <label className="block space-y-2 text-xs font-semibold">Project<select className={INPUT} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">No project</option>{projects.map(x=><option key={x._id} value={x._id}>{x.title}</option>)}</select></label>
        {["invoice","quote"].includes(template.type)&&<label className="block space-y-2 text-xs font-semibold">Document currency<select className={INPUT} value={currency} onChange={e=>setCurrency(e.target.value)}>{["BDT","USD","EUR","GBP","SGD","INR"].map(v=><option key={v}>{v}</option>)}</select></label>}
      </div>
      {error&&<p role="alert" className="mt-6 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-9 flex justify-end gap-3 border-t pt-6"><button className={OUT} type="button" onClick={onClose}>Cancel</button><button className={CTA} disabled={busy}><Check className="size-4"/>{busy?"Creating…":"Create "+template.type}</button></div>
    </form>
  </div>;
}

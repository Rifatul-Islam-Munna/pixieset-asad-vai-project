"use client";

import {useEffect, useMemo, useState, type FormEvent} from "react";
import {CalendarDays, Check, Folder, Loader2, Search, UserRound, X} from "lucide-react";
import {studioDetail, studioList, type StudioRecord} from "@/actions/studio";

const INPUT="h-11 w-full border border-[#e7e3ed] bg-white px-3 text-sm text-[#342f3c] outline-none focus:border-[#6337d8]";
const LABEL="mb-2 block text-xs font-semibold text-[#45404d]";
const TYPE_OPTIONS=["portrait","wedding","event","commercial","other"];

function dateInput(value?:string) {
  if(!value)return "";
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?"":parsed.toISOString().slice(0,10);
}

export function StudioProjectSheet({project,contacts,onClose,onSaved}:{
  project:StudioRecord;
  contacts:StudioRecord[];
  onClose:()=>void;
  onSaved:(data:Record<string,unknown>)=>Promise<void>;
}){
  const [title,setTitle]=useState(project.title);
  const [contactId,setContactId]=useState(project.contactId||"");
  const [kind,setKind]=useState(project.type||"portrait");
  const [date,setDate]=useState(dateInput(project.date));
  const [location,setLocation]=useState(String(project.details?.location||""));
  const [description,setDescription]=useState(project.description||"");
  const [additional,setAdditional]=useState<string[]>(Array.isArray(project.details?.additionalClientIds)?project.details.additionalClientIds:[]);
  const [clientSearch,setClientSearch]=useState("");
  const [found,setFound]=useState<StudioRecord[]>([]);
  const [clientOptions,setClientOptions]=useState<StudioRecord[]>(contacts);
  const [busy,setBusy]=useState(false);
  const [searching,setSearching]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let live=true;
    // Load the linked client even if it falls outside the first page of Contacts.
    if(contactId&&!contacts.some(c=>c._id===contactId)){
      void studioDetail("contacts",contactId).then(c=>{
        if(live)setClientOptions(old=>old.some(x=>x._id===c._id)?old:[c,...old]);
      }).catch(()=>undefined);
    }
    return ()=>{live=false;};
  },[contactId,contacts]);
  useEffect(()=>{
    let live=true;
    const timer=window.setTimeout(()=>{
      if(!clientSearch.trim()){setFound([]);return;}
      setSearching(true);
      void studioList("contacts",{search:clientSearch,limit:20}).then(r=>{
        if(live)setFound(r.items);
      }).catch(()=>{if(live)setError("Could not search contacts")})
        .finally(()=>{if(live)setSearching(false)});
    },260);
    return ()=>{live=false;window.clearTimeout(timer);};
  },[clientSearch]);

  const options=useMemo(()=>{
    const seen=new Set<string>();
    return [...clientOptions,...found].filter(c=>{
      if(seen.has(c._id))return false;
      seen.add(c._id);return true;
    });
  },[clientOptions,found]);
  const activeClient=options.find(c=>c._id===contactId);
  const changeClient=(value:string)=>{
    const selected=options.find(c=>c._id===value);
    if(selected)setClientOptions(old=>old.some(c=>c._id===value)?old:[selected,...old]);
    setContactId(value);
    setAdditional(old=>old.filter(id=>id!==value));
  };
  const close=()=>{
    if(busy)return;
    onClose();
  };
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!busy)onClose();};
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[onClose,busy]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(!title.trim()||!contactId){setError("Project name and a primary client are required");return;}
    setBusy(true);setError("");
    try{
      await onSaved({
        title:title.trim(),contactId,type:kind,
        description:description.trim(),
        date:date?date+"T12:00:00.000Z":null,
        details:{location:location.trim(),additionalClientIds:additional.filter(x=>x!==contactId)},
      });
    }catch(err){
      setError(err instanceof Error?err.message:"Could not update project");
      setBusy(false);
    }
  };
  return <div className="fixed inset-0 z-[120] flex justify-end bg-[#1c1528]/50" role="presentation">
    <button className="min-w-0 flex-1 cursor-default" type="button" aria-label="Close project editor" onClick={close}/>
    <section role="dialog" aria-modal="true" aria-label={"Edit "+project.title}
      className="flex h-full w-full max-w-[540px] flex-col bg-white shadow-[-20px_0_60px_rgba(25,16,38,.16)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#eeeaf1] px-6 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center bg-[#f2edff] text-[#6337d8]"><Folder className="size-5"/></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#9c95a5]">Studio Manager · Projects</p>
            <h2 className="mt-1 text-xl font-semibold">Edit project details</h2></div>
        </div>
        <button type="button" onClick={close} aria-label="Close editor" className="rounded p-2 text-[#777] hover:bg-[#f5f2fa]"><X className="size-5"/></button>
      </header>
      <form id="studio-project-edit" onSubmit={e=>void submit(e)}
        className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-7 sm:px-8">
          <div>
            <label className={LABEL} htmlFor="project-edit-name">Project name *</label>
            <input id="project-edit-name" autoFocus required maxLength={220} className={INPUT}
              value={title} onChange={e=>setTitle(e.target.value)}/>
          </div>
          <div>
            <label className={LABEL} htmlFor="project-edit-client">Primary client *</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#a39cad]"/>
              <input aria-label="Search existing contacts" className={INPUT+" mb-2 pl-10"}
                placeholder="Search client name or email" value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/>
            </div>
            <select id="project-edit-client" required className={INPUT} value={contactId} onChange={e=>changeClient(e.target.value)}>
              <option value="">Choose a saved contact</option>
              {options.filter(c=>!clientSearch||c._id===contactId||c.title.toLowerCase().includes(clientSearch.toLowerCase())||c.email?.toLowerCase().includes(clientSearch.toLowerCase())).map(c=>
                <option value={c._id} key={c._id}>{c.title} · {c.email}</option>)}
            </select>
            {activeClient&&<p className="mt-2 flex items-center gap-2 text-xs text-[#918c97]"><UserRound className="size-3.5"/> {activeClient.email}</p>}
            {searching&&<p className="mt-1 text-xs text-[#988fa2]">Searching contacts…</p>}
          </div>
          <div>
            <p className={LABEL}>Additional clients</p>
            <div className="max-h-40 space-y-3 overflow-y-auto border border-[#ede9f0] p-3">
              {options.filter(c=>c._id!==contactId).map(c=><label key={c._id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={additional.includes(c._id)}
                  onChange={e=>setAdditional(old=>e.target.checked?[...old,c._id]:old.filter(id=>id!==c._id))}/>
                <span>{c.title} <span className="text-[#a49dab]">({c.email})</span></span>
              </label>)}
              {!options.length&&<p className="text-xs text-[#999]">No contacts available.</p>}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="project-edit-type">Project type</label>
              <select id="project-edit-type" value={kind} className={INPUT} onChange={e=>setKind(e.target.value)}>
                {Array.from(new Set([kind,...TYPE_OPTIONS])).map(x=><option key={x} value={x}>{x.charAt(0).toUpperCase()+x.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="project-edit-date">Project date</label>
              <div className="relative">
                <input id="project-edit-date" type="date" className={INPUT+" pr-9"} value={date} onChange={e=>setDate(e.target.value)}/>
                <CalendarDays className="pointer-events-none absolute right-3 top-3.5 size-4 text-[#999]"/>
              </div>
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="project-edit-location">Location</label>
            <input id="project-edit-location" className={INPUT} maxLength={240} value={location} onChange={e=>setLocation(e.target.value)} placeholder="Studio, venue or address"/>
          </div>
          <div>
            <label className={LABEL} htmlFor="project-edit-description">Description</label>
            <textarea id="project-edit-description" className={INPUT+" min-h-[138px] resize-y p-3"} maxLength={12000}
              value={description} onChange={e=>setDescription(e.target.value)} placeholder="Notes about this project…"/>
          </div>
          {error&&<p role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        </div>
        <footer className="flex shrink-0 justify-end gap-3 border-t border-[#eeeaf1] px-6 py-5 sm:px-8">
          <button type="button" disabled={busy} onClick={close} className="h-11 border border-[#e7e3ed] px-5 text-xs font-semibold hover:bg-[#faf9fc]">Cancel</button>
          <button type="submit" disabled={busy} className="inline-flex h-11 min-w-[135px] items-center justify-center gap-2 bg-[#6337d8] px-5 text-xs font-semibold text-white hover:bg-[#542abc] disabled:opacity-50">
            {busy?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}{busy?"Saving…":"Save Changes"}
          </button>
        </footer>
      </form>
    </section>
  </div>;
}

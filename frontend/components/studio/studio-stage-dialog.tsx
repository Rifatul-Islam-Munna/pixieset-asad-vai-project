"use client";

import {useEffect, useState, type FormEvent} from "react";
import {Check, Loader2, Plus, X} from "lucide-react";

const SWATCHES=["#7C57CE","#1BAE9F","#277DD3","#DB9A21","#D45A73","#565C69","#A460E8","#52A35B"];

export function StudioStageDialog({existing,onClose,onCreate}:{
  existing:string[];
  onClose:()=>void;
  onCreate:(name:string,color:string)=>Promise<void>;
}){
  const [name,setName]=useState("");
  const [color,setColor]=useState("#7C57CE");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!saving)onClose();};
    window.addEventListener("keydown",key);
    return ()=>window.removeEventListener("keydown",key);
  },[onClose,saving]);
  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    const title=name.trim().replace(/\s+/g," ");
    if(title.length<2||title.length>65){setError("Enter a stage title between 2 and 65 characters.");return;}
    const slug=title.toLowerCase().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40);
    if(!slug){setError("Use a stage title containing letters or numbers.");return;}
    if(existing.includes(slug)){setError("This stage already exists.");return;}
    setSaving(true);setError("");
    try{await onCreate(title,color);}
    catch(err){setError(err instanceof Error?err.message:"Unable to create this stage");}
    finally{setSaving(false);}
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#171021]/50 p-4" role="presentation">
    <button type="button" aria-label="Close stage dialog" className="absolute inset-0 cursor-default" onClick={()=>!saving&&onClose()}/>
    <section role="dialog" aria-modal="true" aria-labelledby="studio-add-stage-title" className="relative w-full max-w-[460px] bg-white p-7 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#938b9e]">Studio Manager · Projects</p>
          <h2 id="studio-add-stage-title" className="mt-2 text-[23px] font-medium">Add project stage</h2>
          <p className="mt-2 text-xs leading-5 text-[#8b8692]">Choose a stage title and a colour for your project board.</p>
        </div>
        <button type="button" aria-label="Close dialog" disabled={saving} onClick={onClose} className="p-2 hover:bg-[#f7f4fb]"><X className="size-4"/></button>
      </div>
      <form onSubmit={e=>void submit(e)} className="mt-7 space-y-6">
        <label className="block text-[12px] font-semibold text-[#3d3745]">Stage title *
          <input autoFocus maxLength={65} required placeholder="e.g. Editing, Delivery, Follow-up" value={name}
            onChange={e=>{setName(e.target.value);setError("");}}
            className="mt-2 h-12 w-full border border-[#e6e2ec] bg-white px-4 text-sm outline-none focus:border-[#6337d8]"/>
        </label>
        <div>
          <p className="text-[12px] font-semibold text-[#3d3745]">Stage colour</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {SWATCHES.map(s=><button type="button" aria-label={"Choose "+s} aria-pressed={color===s} key={s}
              onClick={()=>setColor(s)} className="grid size-9 place-items-center rounded-full outline-offset-2 hover:scale-105"
              style={{backgroundColor:s,outline:color===s?"2px solid "+s:"none"}}>
              {color===s&&<Check className="size-4 text-white"/>}
            </button>)}
            <label className="ml-2 flex items-center gap-2 text-xs text-[#79727f]">Custom
              <input aria-label="Custom stage colour" type="color" value={color} onChange={e=>setColor(e.target.value)}
                className="size-9 cursor-pointer border-0 bg-transparent p-0"/>
            </label>
          </div>
        </div>
        <div className="border border-[#ece7f0] bg-[#fdfbff] p-4">
          <p className="mb-3 text-[11px] text-[#aaa0af]">Board preview</p>
          <span className="inline-flex items-center gap-2 rounded px-3 py-2 text-[11px] font-bold uppercase tracking-wide"
            style={{color,backgroundColor:color+"1A"}}><span className="size-1.5 rounded-full" style={{backgroundColor:color}}/>{name.trim()||"Your stage"}</span>
        </div>
        {error&&<p role="alert" className="bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-[#eeeaf1] pt-5">
          <button type="button" onClick={onClose} disabled={saving} className="h-11 border border-[#e5e1e9] px-5 text-xs font-semibold">Cancel</button>
          <button disabled={saving||!name.trim()} className="inline-flex h-11 items-center gap-2 bg-[#6337d8] px-5 text-xs font-semibold text-white disabled:opacity-50">
            {saving?<Loader2 className="size-4 animate-spin"/>:<Plus className="size-4"/>}{saving?"Creating…":"Add Stage"}
          </button>
        </div>
      </form>
    </section>
  </div>;
}

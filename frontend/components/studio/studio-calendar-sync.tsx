"use client";

import { useEffect, useState } from "react";
import { CalendarSync, CheckCircle2, Copy, Download, Link2, RotateCcw, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { studioCalendarSync, studioEnableCalendarSync, studioRevokeCalendarSync, studioRotateCalendarSync } from "@/actions/studio";

const BTN="inline-flex min-h-10 items-center justify-center gap-2 border border-[#e6e3ee] px-4 text-xs font-semibold text-[#42394e] hover:bg-[#f8f5ff]";
export function StudioCalendarSync({onClose}:{onClose:()=>void}){
  const [feed,setFeed]=useState<string>("");
  const [disabled,setDisabled]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    void studioCalendarSync().then(data=>{if(active){setFeed(data.url);setDisabled(!data.enabled);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Calendar link could not be generated");}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);
  const copy=async()=>{
    try{await navigator.clipboard.writeText(feed);toast.success("Calendar subscription link copied");}
    catch{setError("Clipboard access was unavailable. Select and copy the URL below.");}
  };
  const rotate=async()=>{
    if(!window.confirm("Regenerate the calendar subscription link? Existing subscribers will stop receiving updates."))return;
    setBusy(true);setError("");
    try{const next=await studioRotateCalendarSync();setFeed(next.url);setDisabled(false);toast.success("Calendar link regenerated");}
    catch(e){setError(e instanceof Error?e.message:"Could not regenerate link");}
    finally{setBusy(false);}
  };
  const revoke=async()=>{
    if(!window.confirm("Disable this calendar subscription? Current subscribers will lose access."))return;
    setBusy(true);setError("");
    try{await studioRevokeCalendarSync();setFeed("");setDisabled(true);toast.success("Calendar subscription revoked");}
    catch(e){setError(e instanceof Error?e.message:"Could not revoke link");}
    finally{setBusy(false);}
  };
  const enable=async()=>{
    setBusy(true);setError("");
    try{const next=await studioEnableCalendarSync();setFeed(next.url);setDisabled(false);toast.success("Calendar subscription enabled");}
    catch(e){setError(e instanceof Error?e.message:"Could not enable calendar sync");}
    finally{setBusy(false);}
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#17111e]/55 px-3 py-8" role="dialog" aria-modal="true" aria-label="Calendar Sync">
    <div className="w-full max-w-xl bg-white p-7 shadow-2xl sm:p-10">
      <div className="flex items-start justify-between"><div className="grid size-12 place-items-center bg-[#f2edff] text-[#6337d8]"><CalendarSync className="size-6"/></div><button type="button" onClick={onClose} aria-label="Close"><X className="size-5"/></button></div>
      <h2 className="mt-6 text-xl font-semibold">Calendar Sync</h2>
      <p className="mt-2 text-sm leading-6 text-[#777]">Subscribe from Google Calendar, Apple Calendar, or Outlook using a secure .ics URL. Your session updates will appear when your calendar application refreshes this read-only feed.</p>
      <div className="mt-6 border-l-2 border-[#b685df] bg-[#f8f4ff] p-4 text-xs leading-6 text-[#6e5b84]">
        <ShieldAlert className="mr-2 inline size-4"/> Keep this URL private: anyone with the link can view your studio’s session titles, dates and locations.
      </div>
      {loading?<p className="mt-6 text-sm text-[#888]">Generating your calendar subscription…</p>:
        feed?<><label className="mt-6 block text-xs font-semibold">Your calendar URL
          <textarea readOnly value={feed} className="mt-3 min-h-[92px] w-full resize-none border border-[#e6e2eb] bg-[#faf9fb] p-3 text-xs leading-6 outline-none" onClick={e=>e.currentTarget.select()}/></label>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className={BTN+" !bg-[#6337d8] !text-white"} onClick={()=>void copy()}><Copy className="size-4"/> Copy subscription URL</button>
            <a className={BTN} href={feed} target="_blank" rel="noopener noreferrer"><Download className="size-4"/> Download calendar</a>
          </div>
          <div className="mt-8 border-t border-[#eee] pt-5"><p className="text-sm font-semibold">Calendar access</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className={BTN} disabled={busy} onClick={()=>void rotate()}><RotateCcw className="size-4"/> Regenerate link</button>
              <button className={BTN+" !text-red-600"} disabled={busy} onClick={()=>void revoke()}><Trash2 className="size-4"/> Disable sync</button>
            </div>
          </div>
        </>:<div className="mt-6 space-y-4"><p className="text-sm text-[#777]">{disabled?"Calendar subscription is disabled. Previously issued links can no longer access your sessions.":"No active calendar subscription."}</p>
          {disabled&&<button className={BTN+" !bg-[#6337d8] !text-white"} disabled={busy} onClick={()=>void enable()}><CalendarSync className="size-4"/> Enable calendar sync</button>}</div>}
      {error&&<p role="alert" className="mt-5 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  </div>;
}

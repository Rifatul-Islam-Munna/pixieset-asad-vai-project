"use client";

import type { StudioPublicPreviewData, StudioPublicPreviewKind } from "./studio-public";

const PREFIX="gallerista:studio-document-preview:";
const UPDATED="gallerista:studio-document-preview-updated";
const LIFETIME_MS=5*60*1000;
const MAX_SERIALIZED_LENGTH=450_000;

export type StudioClientPreviewSnapshot={
  version:1;
  createdAt:number;
  kind:StudioPublicPreviewKind;
  data:StudioPublicPreviewData;
  contract?:{
    recordId?:string;
    baseUpdatedAt?:string;
    draft:Record<string,unknown>;
    canSign:boolean;
  };
};

/** Keep the unsent document out of URL parameters and the public API.
 * A random one-use key only resolves in the same authenticated browser origin. */
export function openStudioClientPreview(
  kind:StudioPublicPreviewKind,
  data:StudioPublicPreviewData,
  contract?:StudioClientPreviewSnapshot["contract"],
):string{
  const id=crypto.randomUUID().replace(/-/g,"");
  const snapshot:StudioClientPreviewSnapshot={
    version:1,createdAt:Date.now(),kind,data,...(contract?{contract}:{}),
  };
  const serialized=JSON.stringify(snapshot);
  if(serialized.length>MAX_SERIALIZED_LENGTH)
    throw new Error("The document is too large to preview in a separate tab.");
  const key=PREFIX+id;
  try{
    // Opportunistically delete snapshots left behind by closed/blocked tabs.
    for(let i=localStorage.length-1;i>=0;i--){
      const oldKey=localStorage.key(i);
      if(!oldKey?.startsWith(PREFIX))continue;
      const old=localStorage.getItem(oldKey);
      try{
        if(!old||Date.now()-Number(JSON.parse(old).createdAt)>LIFETIME_MS)
          localStorage.removeItem(oldKey);
      }catch{localStorage.removeItem(oldKey);}
    }
    localStorage.setItem(key,serialized);
  }catch{
    throw new Error("Your browser blocked temporary preview storage. Enable site storage to open a preview.");
  }
  const url="/dashboard/studio-management/preview#"+id;
  const tab=window.open(url,"_blank");
  if(!tab){
    localStorage.removeItem(key);
    throw new Error("Your browser blocked the preview tab. Allow pop-ups for this site.");
  }
  try{tab.opener=null;}catch{/* same-origin preview still works without an opener */}
  tab.focus();
  return id;
}

export function readStudioClientPreview(id:string):StudioClientPreviewSnapshot|null{
  if(!/^[0-9a-f]{32}$/.test(id))return null;
  const key=PREFIX+id;
  let raw=sessionStorage.getItem(key);
  if(!raw){
    raw=localStorage.getItem(key);
    if(raw){
      localStorage.removeItem(key);
      sessionStorage.setItem(key,raw);
    }
  }
  if(!raw)return null;
  try{
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=="object"||Array.isArray(value))return null;
    const snapshot=value as Partial<StudioClientPreviewSnapshot>;
    if(snapshot.version!==1||!snapshot.createdAt||
      Date.now()-snapshot.createdAt>LIFETIME_MS||
      !["contract","questionnaire","quote","invoice","form"].includes(String(snapshot.kind))||
      !snapshot.data||typeof snapshot.data!=="object"||Array.isArray(snapshot.data))
      return null;
    return snapshot as StudioClientPreviewSnapshot;
  }catch{return null;}
}

export function updateStudioClientPreview(id:string,snapshot:StudioClientPreviewSnapshot){
  sessionStorage.setItem(PREFIX+id,JSON.stringify(snapshot));
}

export function broadcastStudioPreviewSave(id:string,recordId:string){
  localStorage.setItem(UPDATED,JSON.stringify({id,recordId,at:Date.now()}));
  localStorage.removeItem(UPDATED);
}

export function listenForStudioPreviewSave(
  id:string,
  callback:(recordId:string)=>void,
):()=>void{
  const listener=(event:StorageEvent)=>{
    if(event.key!==UPDATED||!event.newValue)return;
    try{
      const update=JSON.parse(event.newValue);
      if(update.id===id&&typeof update.recordId==="string")callback(update.recordId);
    }catch{/* Ignore another site's malformed storage message. */}
  };
  window.addEventListener("storage",listener);
  return ()=>window.removeEventListener("storage",listener);
}

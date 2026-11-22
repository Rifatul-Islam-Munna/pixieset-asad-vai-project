"use client";

import {studioShareUrl,type StudioRecord} from "@/actions/studio";

type Kind="forms"|"invoices"|"documents";

/** Open the tab synchronously from a click so Safari/Chrome do not block it.
 * We then safely save the latest draft and navigate to its owner subdomain.
 * Never publish, send email or mark a document completed from Preview. */
export async function previewStudioPublicDraft(
  kind:Kind,ensureSaved:()=>Promise<StudioRecord|null>,
):Promise<string>{
  const tab=window.open("about:blank","_blank");
  if(!tab)throw new Error("Allow pop-ups for this site so Preview can open in a new tab.");
  try{tab.opener=null;}catch{/* Firefox may refuse to reassign opener */}
  try{
    const record=await ensureSaved();
    if(!record)throw new Error("Save this document as a draft before previewing.");
    const {url}=await studioShareUrl(kind,record._id);
    if(!/^https?:\/\//i.test(url))throw new Error("Public document URL is not configured.");
    tab.location.replace(url);
    tab.focus();
    return url;
  }catch(error){
    tab.close();
    throw error;
  }
}

export async function copyStudioPublicLink(kind:Kind,id:string):Promise<string>{
  const {url}=await studioShareUrl(kind,id);
  await navigator.clipboard.writeText(url);
  return url;
}

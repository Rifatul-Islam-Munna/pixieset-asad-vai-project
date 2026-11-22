import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {apiBaseUrl} from "@/lib/api-base-url";
import {StudioPublic,type StudioPublicPreviewKind} from "@/components/studio/studio-public";

export const metadata:Metadata={
  title:"Studio Client Document | Gallerista",
  robots:{index:false,follow:false},
};
export const dynamic="force-dynamic";

export default async function StudioTenantDocumentPage({
  params,
}:{
  params:Promise<{site:string;kind:string;token:string}>;
}){
  const {site,kind,token}=await params;
  if(!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(site)||
    !["form","invoice","contract","quote","questionnaire"].includes(kind)||
    !/^[a-f0-9]{64}$/i.test(token))notFound();

  // A site's enabled owner is verified by the API before any document is returned.
  // Drafts are public read-only previews; sent documents become actionable.
  const response=await fetch(apiBaseUrl()+"/public/studio/site-documents/"+
    encodeURIComponent(site)+"/"+encodeURIComponent(kind)+"/"+encodeURIComponent(token),
  {cache:"no-store"}).catch(()=>null);
  if(!response?.ok)notFound();
  const payload=await response.json().catch(()=>null);
  if(!payload?.data?.data)notFound();

  const preview=payload.data.preview===true;
  return <StudioPublic key={token} kind={kind as StudioPublicPreviewKind}
    token={token} data={payload.data.data} ownerPreview={preview}
    publicDraftPreview={preview}
    studioName={typeof payload.data.studioName==="string"?payload.data.studioName:""}/>;
}

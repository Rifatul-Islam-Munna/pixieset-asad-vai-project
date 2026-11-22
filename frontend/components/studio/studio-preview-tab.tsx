"use client";

import {useEffect,useState} from "react";
import {ArrowLeft,Loader2,ShieldAlert} from "lucide-react";
import {studioCreate,studioDetail,studioUpdate} from "@/actions/studio";
import {StudioPublic} from "./studio-public";
import {signatureComplete,type StudioSignature} from "./studio-signature";
import {
  broadcastStudioPreviewSave,readStudioClientPreview,updateStudioClientPreview,
  type StudioClientPreviewSnapshot,
} from "./studio-client-preview";

function previewId(){
  return typeof window==="undefined"?"":window.location.hash.slice(1);
}

export function StudioPreviewTab(){
  const [id,setId]=useState("");
  const [snapshot,setSnapshot]=useState<StudioClientPreviewSnapshot|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState("");
  const [showStudioSignatureTools,setShowStudioSignatureTools]=useState(false);

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if(!active)return;
      const nextId=previewId();
      setId(nextId);
      try{setSnapshot(readStudioClientPreview(nextId));}
      catch{setSnapshot(null);}
      setLoaded(true);
    });
    return ()=>{active=false;};
  },[]);

  const replace=(next:StudioClientPreviewSnapshot)=>{
    setSnapshot(next);
    updateStudioClientPreview(id,next);
  };

  const updateSigner=(name:string)=>{
    if(!snapshot||snapshot.kind!=="contract"||!snapshot.contract)return;
    const document=snapshot.data as Extract<StudioClientPreviewSnapshot["data"],{contentDoc?:unknown}>;
    const original=snapshot.contract.draft;
    const details=(original.details&&typeof original.details==="object"?
      original.details:{} ) as Record<string,unknown>;
    const variables=(details.variables&&typeof details.variables==="object"?
      details.variables:{} ) as Record<string,unknown>;
    replace({
      ...snapshot,
      data:{...document,studioSignerName:name,photographerName:name,
        variables:{...(document.variables||{}),photographer_name:name}},
      contract:{...snapshot.contract,draft:{...original,details:{
        ...details,photographerName:name,studioSignerName:name,
        variables:{...variables,photographer_name:name},
      }}},
    });
  };

  const persistStudioSignature=async(signature:StudioSignature|null)=>{
    if(!snapshot?.contract?.canSign||snapshot.kind!=="contract")
      throw new Error("This contract cannot be signed from preview.");
    if(signature!==null&&!signatureComplete(signature))
      throw new Error("Draw, type or upload your studio signature first.");

    const agreement=snapshot.data;
    if(!("studioSignerName" in agreement)||
      typeof agreement.studioSignerName!=="string"||
      agreement.studioSignerName.trim().length<2)
      throw new Error("Enter a studio signer name before saving your signature.");

    const contract=snapshot.contract;
    const original=contract.draft;
    const originalDetails=(original.details&&typeof original.details==="object"?
      original.details:{} ) as Record<string,unknown>;
    let currentUpdatedAt="";
    if(contract.recordId){
      const current=await studioDetail("documents",contract.recordId);
      if(current.status!=="draft")throw new Error("The contract has been sent or completed and cannot be edited.");
      currentUpdatedAt=String(current.updatedAt||"");
      if(contract.baseUpdatedAt&&currentUpdatedAt&&currentUpdatedAt!==contract.baseUpdatedAt)
        throw new Error("The contract changed since you opened Preview. Close this tab and open a fresh preview before signing.");
    }
    const signerName=agreement.studioSignerName.trim();
    const payload={
      ...original,
      details:{
        ...originalDetails,studioSignature:signature,
        studioSignerName:signature===null?"":signerName,
        photographerName:signerName,
      },
    };
    const result=contract.recordId?
      await studioUpdate("documents",contract.recordId,payload):
      await studioCreate("documents",payload);
    const details=result.details||{};
    const next:StudioClientPreviewSnapshot={
      ...snapshot,
      data:{...agreement,
        studioSignature:(details.studioSignature||null) as StudioSignature|null,
        studioSignedAt:String(details.studioSignedAt||""),
        studioSignerName:String(details.studioSignerName||signerName),
      },
      contract:{
        ...contract,recordId:result._id,baseUpdatedAt:String(result.updatedAt||""),
        draft:{...payload,details},
      },
    };
    replace(next);
    broadcastStudioPreviewSave(id,result._id);
  };

  if(!loaded)return <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-[#888]">
    <Loader2 className="size-5 animate-spin"/>Opening client preview…</div>;
  if(!snapshot)return <main className="grid min-h-screen place-items-center bg-[#f8f7fa] p-6">
    <div className="max-w-lg border bg-white p-10 text-center">
      <ShieldAlert className="mx-auto size-9 text-[#6337d8]"/>
      <h1 className="mt-5 text-xl font-semibold">This preview is no longer available</h1>
      <p className="mt-4 text-sm leading-7 text-[#777]">
        Return to the document editor and click Preview again. Draft previews are private,
        temporary and can only be opened in the same signed-in browser.
      </p>
      <button type="button" onClick={()=>window.close()}
        className="mt-6 inline-flex items-center gap-2 border px-5 py-3 text-xs font-semibold">
        <ArrowLeft className="size-4"/>Close preview tab</button>
    </div>
  </main>;

  return <div className="min-h-screen bg-[#f7f6f9]">
    <div className="mx-auto flex max-w-[950px] items-center justify-between gap-4 px-4 pt-5 print:hidden">
      <p className="text-xs font-semibold text-[#625870]">
        Client View Preview · {snapshot.kind[0].toUpperCase()+snapshot.kind.slice(1)}
        <span className="ml-2 font-normal text-[#998d9f]">Test submissions are not sent; payments are disabled</span>
      </p>
      <div className="flex items-center gap-2">
        {snapshot.kind==="contract"&&snapshot.contract?.canSign&&
          <button type="button" onClick={()=>setShowStudioSignatureTools(value=>!value)}
            aria-pressed={showStudioSignatureTools}
            className="border border-[#6337d8] bg-white px-4 py-2 text-xs font-semibold text-[#6337d8]">
            {showStudioSignatureTools?"Hide Owner Tools":"Sign as Studio Owner"}
          </button>}
        <button type="button" onClick={()=>window.close()}
          className="border border-[#e3ddeb] bg-white px-4 py-2 text-xs font-semibold text-[#5a5065]">
          Close Preview</button>
      </div>
    </div>
    {error&&<div role="alert" className="mx-auto mt-4 max-w-[850px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
    <StudioPublic kind={snapshot.kind} token="" data={snapshot.data} ownerPreview showOwnerPreviewNotice={false}
      onStudioSignerNameChange={snapshot.kind==="contract"&&snapshot.contract?.canSign&&showStudioSignatureTools?updateSigner:undefined}
      onSaveStudioSignature={snapshot.kind==="contract"&&snapshot.contract?.canSign&&showStudioSignatureTools?
        async signature=>{try{await persistStudioSignature(signature);setError("");}
          catch(e){const message=e instanceof Error?e.message:"Could not sign the draft";
            setError(message);throw e;}}:undefined}
      onRemoveStudioSignature={snapshot.kind==="contract"&&snapshot.contract?.canSign&&showStudioSignatureTools?
        async()=>{if(!window.confirm("Remove your saved studio signature and unlock the draft?"))return;
          try{await persistStudioSignature(null);setError("");}
          catch(e){const message=e instanceof Error?e.message:"Could not remove the signature";
            setError(message);throw e;}}:undefined}/>
  </div>;
}

"use client";

import {useRef,useState,type PointerEvent} from "react";
import {Eraser,ImagePlus,Loader2,PenLine,Type,Upload} from "lucide-react";
import {toast} from "sonner";
import {uploadMobileGalleryAsset} from "@/api-hooks/use-mobile-gallery";

export type StudioSignature =
  | {kind:"drawn";strokes:number[][][]}
  | {kind:"typed";name:string}
  | {kind:"image";url:string};

function safeSignatureImageUrl(value:string){
  try{
    const url=new URL(value);
    return (url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))&&
      !url.username&&!url.password&&!url.search&&!url.hash&&/\.(png|jpe?g|webp|avif)$/i.test(url.pathname);
  }catch{return false;}
}

export function signatureComplete(signature:StudioSignature|null|undefined){
  if(!signature)return false;
  if(signature.kind==="typed")return signature.name.trim().length>=2;
  if(signature.kind==="image")return safeSignatureImageUrl(signature.url)&&signature.url.length<=2048;
  return signature.strokes.some(stroke=>stroke.length>=2);
}

export function SignatureDisplay({signature,name="",label="Signature",signedAt}:{
  signature?:StudioSignature|null;name?:string;label?:string;signedAt?:string;
}){
  if(!signatureComplete(signature))return null;
  return <div className="min-w-0">
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#999]">{label}</p>
    <div className="flex h-28 max-w-[480px] items-center border-b border-[#cfcbd4]">
      {signature?.kind==="typed"?
        <p className="break-words font-serif text-3xl italic leading-relaxed text-[#32264f]">{signature.name}</p>:
        signature?.kind==="image"?
          <img src={signature.url} alt={label} className="h-full max-h-28 max-w-[440px] object-contain object-left" />:
          <svg viewBox="0 0 600 160" role="img" aria-label={label+" drawing"}
            className="h-full max-h-28 w-full max-w-[440px]">
            {signature?.strokes.map((stroke,index)=><polyline key={index}
              points={stroke.map(([x,y])=>x+","+y).join(" ")} fill="none"
              stroke="#302744" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.7"/>)}
          </svg>}
    </div>
    <p className="mt-2 text-xs text-[#79727e]">{name||"Signed"}
      {signedAt&&" · "+new Date(signedAt).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"})}</p>
  </div>;
}

export function StudioSignaturePad({value,onChange,disabled=false,label="Draw, type or upload your signature"}:{
  value:StudioSignature|null;onChange:(value:StudioSignature|null)=>void;
  disabled?:boolean;label?:string;
}){
  const [mode,setMode]=useState<"drawn"|"typed"|"image">(value?.kind||"drawn");
  const [uploading,setUploading]=useState(false);
  const active=useRef<number|null>(null);
  const strokes=value?.kind==="drawn"?value.strokes:[];
  const typed=value?.kind==="typed"?value.name:"";
  const imageUrl=value?.kind==="image"?value.url:"";
  const activeMode=value?.kind||mode;
  const uploadImage=async(file?:File)=>{
    if(!file)return;
    if(!file.type.startsWith("image/")){toast.error("Choose an image file for your signature.");return;}
    if(file.size>5*1024*1024){toast.error("Signature image must be 5 MB or smaller.");return;}
    setUploading(true);
    try{
      const url=await uploadMobileGalleryAsset(file);
      if(!url||!safeSignatureImageUrl(url))throw new Error("The uploaded signature image URL is invalid.");
      setMode("image");onChange({kind:"image",url});
      toast.success("Signature image uploaded");
    }catch(error){toast.error(error instanceof Error?error.message:"Could not upload signature image");}
    finally{setUploading(false);}
  };
  const point=(event:PointerEvent<SVGSVGElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    const x=Math.max(0,Math.min(600,Math.round((event.clientX-rect.left)/Math.max(1,rect.width)*600)));
    const y=Math.max(0,Math.min(160,Math.round((event.clientY-rect.top)/Math.max(1,rect.height)*160)));
    return [x,y];
  };
  const start=(event:PointerEvent<SVGSVGElement>)=>{
    if(disabled||activeMode!=="drawn"||active.current!==null||strokes.length>=20)return;
    event.preventDefault();
    active.current=event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start=point(event);
    onChange({kind:"drawn",strokes:[...strokes,[start]]});
  };
  const move=(event:PointerEvent<SVGSVGElement>)=>{
    if(disabled||activeMode!=="drawn"||active.current!==event.pointerId||!strokes.length)return;
    event.preventDefault();
    const lastStroke=strokes[strokes.length-1];
    const total=strokes.reduce((sum,stroke)=>sum+stroke.length,0);
    if(lastStroke.length>=240||total>=1800)return;
    const next=point(event);
    const last=lastStroke[lastStroke.length-1];
    if(Math.abs(next[0]-last[0])+Math.abs(next[1]-last[1])<2)return;
    onChange({kind:"drawn",strokes:[
      ...strokes.slice(0,-1),[...lastStroke,next],
    ]});
  };
  const end=(event:PointerEvent<SVGSVGElement>)=>{
    if(active.current!==event.pointerId)return;
    active.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="space-y-4">
    <p className="text-sm font-semibold">{label}</p>
    <div className="flex items-center gap-2">
      <button type="button" disabled={disabled} onClick={()=>{setMode("drawn");onChange(null)}}
        className={"flex items-center gap-2 border px-4 py-2 text-xs font-medium disabled:opacity-50 "+
          (activeMode==="drawn"?"border-[#6337d8] bg-[#f5f0ff] text-[#6337d8]":"border-[#ddd] text-[#888]")}>
        <PenLine className="size-4"/>Draw
      </button>
      <button type="button" disabled={disabled} onClick={()=>{setMode("typed");onChange(null)}}
        className={"flex items-center gap-2 border px-4 py-2 text-xs font-medium disabled:opacity-50 "+
          (activeMode==="typed"?"border-[#6337d8] bg-[#f5f0ff] text-[#6337d8]":"border-[#ddd] text-[#888]")}>
        <Type className="size-4"/>Type
      </button>
      <button type="button" disabled={disabled||uploading} onClick={()=>setMode("image")}
        className={"flex items-center gap-2 border px-4 py-2 text-xs font-medium disabled:opacity-50 "+
          (activeMode==="image"?"border-[#6337d8] bg-[#f5f0ff] text-[#6337d8]":"border-[#ddd] text-[#888]")}>
        <ImagePlus className="size-4"/>Upload image
      </button>
      {!disabled&&value&&<button type="button" onClick={()=>onChange(null)}
        className="ml-auto flex items-center gap-1 text-xs text-[#777] hover:text-red-600">
        <Eraser className="size-4"/>Clear
      </button>}
    </div>
    {activeMode==="drawn"?<div className="relative border border-[#ded9e3] bg-white">
      <svg viewBox="0 0 600 160" role="img" aria-label="Signature drawing pad"
        className={"block aspect-[600/160] w-full "+(disabled?"cursor-not-allowed":"cursor-crosshair touch-none")}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <path d="M 16 137 H 584" stroke="#e6e1e9" strokeDasharray="5 6"/>
        {strokes.map((stroke,index)=><polyline key={index}
          points={stroke.map(([x,y])=>x+","+y).join(" ")}
          fill="none" stroke="#302744" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/>)}
      </svg>
      {!strokes.length&&<span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-[#b7afb9]">
        Sign here with your mouse, finger or stylus</span>}
    </div>:activeMode==="typed"?<div className="border border-[#ded9e3] p-5">
      <input type="text" maxLength={120} disabled={disabled} value={typed}
        placeholder="Type your signature" aria-label="Typed signature"
        onChange={e=>onChange({kind:"typed",name:e.target.value})}
        className="w-full border-b border-[#ddd] bg-white px-1 py-3 font-serif text-2xl italic outline-none focus:border-[#6337d8] disabled:opacity-60"/>
    </div>:<div className="space-y-3 border border-[#ded9e3] bg-white p-4">
      {imageUrl?<div className="flex min-h-24 items-center gap-4"><img src={imageUrl} alt="Uploaded signature preview" className="max-h-24 max-w-[260px] object-contain object-left"/><button type="button" disabled={disabled||uploading} onClick={()=>onChange(null)} className="text-xs font-semibold text-red-600">Remove</button></div>:<p className="text-xs text-[#888]">Upload a clear PNG, JPG or WebP image of your signature. Transparent PNG works best.</p>}
      <label className="inline-flex cursor-pointer items-center gap-2 border border-[#ded9e3] px-4 py-2 text-xs font-semibold text-[#51465f] hover:bg-[#f8f5fc]">
        {uploading?<Loader2 className="size-4 animate-spin"/>:<Upload className="size-4"/>}{uploading?"Uploading…":imageUrl?"Replace image":"Choose signature image"}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={disabled||uploading} className="sr-only" onChange={e=>{void uploadImage(e.target.files?.[0]);e.currentTarget.value="";}}/>
      </label>
    </div>}
    <p className="text-[11px] leading-5 text-[#9d95a2]">
      Your signature and consent are recorded with the agreement; this is not a certified digital-signature provider.
    </p>
  </div>;
}

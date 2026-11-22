"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, FileCheck2, FilePlus2,
  FileText, FolderOpen, ImageIcon, Loader2, Mail, MessageSquare, MoreHorizontal,
  Pencil, Plus, Trash2, X, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  studioAddProjectNote, studioCreateBookingEvent, studioDelete, studioDeleteBookingEvent,
  studioDeleteProjectNote, studioLinkProjectGallery, studioProjectOverview,
  studioRecordPayment, studioSendContract, studioSendInvoice, studioUnlinkProjectGallery,
  studioUpdate, studioUpdateBookingEvent,
  type StudioProjectOverview, type StudioRecord, type StudioSession,
} from "@/actions/studio";

const BASE="/dashboard/studio-management";
const ACCENT="text-[#6337d8]";
const INPUT="min-h-10 w-full border border-[#e7e4eb] bg-white px-3 text-sm outline-none focus:border-[#6337d8]";
const ACT="inline-flex min-h-10 items-center justify-center gap-2 bg-[#6337d8] px-5 text-xs font-semibold text-white hover:bg-[#5229bc] disabled:opacity-40";
const SECONDARY="inline-flex min-h-10 items-center justify-center gap-2 border border-[#e9e6ed] px-4 text-xs font-semibold hover:bg-[#faf9fd] disabled:opacity-40";
const defaultStages=["inquiry","booked","post-production","completed","cancelled"];
function nameOf(value:string) {return value.split("-").map(s=>s[0]?.toUpperCase()+s.slice(1)).join(" ");}
function money(value:number,currency="EUR"){return currency+" "+Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
function day(value?:string){if(!value)return "TBD";const d=new Date(value);return Number.isNaN(d.getTime())?"TBD":d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});}
function when(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?"TBD":d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric",year:"numeric"});}
function time(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});}
function shortName(name:string){return name.trim().split(/\s+/).map(v=>v[0]).join("").slice(0,2).toUpperCase()||"CL";}
const statuses:Record<string,string>={
  inquiry:"bg-[#fff9e8] text-[#b07a00]",booked:"bg-[#f3f0ff] text-[#673db8]",
  "post-production":"bg-[#eaf6ff] text-[#277fab]",completed:"bg-[#e7f6ed] text-[#278650]",
  cancelled:"bg-[#fff0f2] text-[#b94e61]","awaiting-client":"bg-[#f4f2f7] text-[#73707e]",
  draft:"bg-[#f5f4f6] text-[#807c87]",paid:"bg-[#e7f6ed] text-[#278650]",
  sent:"bg-[#edf2ff] text-[#5a73a4]",confirmed:"bg-[#eaf8ec] text-[#388655]",
  pending:"bg-[#fff8e9] text-[#a97c18]",
};
function Tag({value}:{value:string}){
  return <span className={"inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.02em] "+(statuses[value]||"bg-[#f3f2f5] text-[#777]")}>{nameOf(value||"draft")}</span>;
}
function SectionTitle({title,action,actionLabel}:{title:string;action?:()=>void;actionLabel?:string}){
  return <div className="flex items-center justify-between border-b border-[#e9e8eb] pb-3.5">
    <h2 className="text-[15px] font-semibold text-[#24212a]">{title}</h2>
    {action&&<button type="button" aria-label={actionLabel||"Add "+title} title={actionLabel||"Add "+title} onClick={action}
      className="rounded p-1 text-[#6337d8] hover:bg-[#f4efff]"><Plus className="size-[17px]"/></button>}
  </div>;
}
function DropItem({children,onClick,danger=false}:{children:React.ReactNode;onClick:()=>void;danger?:boolean}){
  return <button type="button" onClick={onClick} className={"flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-[#f7f5fb] "+(danger?"text-red-600":"text-[#4c4653]")}>{children}</button>;
}

const documentStarters = [
  { type:"invoice", label:"Invoice", description:"Get paid for your services.", icon:FileText },
  { type:"contract", label:"Contract", description:"Request a signature from your client.", icon:FileCheck2 },
  { type:"questionnaire", label:"Questionnaire", description:"Learn about your client's needs.", icon:FilePlus2 },
  { type:"quote", label:"Quote", description:"Get your client's acceptance before sending an invoice.", icon:FileText },
] as const;
type StarterType = "invoice"|"contract"|"questionnaire"|"quote"|"session";

function StarterAction({icon:Icon,label,description,onClick}:{
  icon:LucideIcon;label:string;description:string;onClick:()=>void;
}){
  return <button type="button" onClick={onClick} className="group flex w-full items-center gap-5 rounded-sm px-1 py-2 text-left transition hover:bg-[#faf8fe] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6337d8]">
    <span className="grid size-[52px] shrink-0 place-items-center bg-[#f7f6f9] text-[#8b8492] transition group-hover:bg-[#eee8fb] group-hover:text-[#6337d8]">
      <Icon className="size-6 stroke-[1.35]"/>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-medium text-[#292430] transition group-hover:text-[#6337d8]">{label}</span>
      <span className="mt-0.5 block text-xs text-[#8d8794]">{description}</span>
    </span>
  </button>;
}

function ProjectGettingStarted({onCreate,onGallery,galleryPicker}:{
  onCreate:(type:StarterType)=>void;onGallery:()=>void;galleryPicker?:React.ReactNode;
}){
  return <section>
    <SectionTitle title="Get Started"/>
    <p className="mt-7 mb-3 text-[13px] font-medium text-[#948d9a]">Send documents</p>
    <div className="space-y-1">
      {documentStarters.map(item=><StarterAction key={item.type} icon={item.icon} label={item.label}
        description={item.description} onClick={()=>onCreate(item.type)}/>)}
    </div>
    <p className="mt-7 mb-3 text-[13px] font-medium text-[#948d9a]">Schedule sessions</p>
    <StarterAction icon={CalendarDays} label="Session" description="Schedule a session for your client."
      onClick={()=>onCreate("session")}/>
    <p className="mt-7 mb-3 text-[13px] font-medium text-[#948d9a]">Client Gallery Collections</p>
    <StarterAction icon={ImageIcon} label="Client Gallery Collections" description="Link photo collections from Client Gallery."
      onClick={onGallery}/>
    {galleryPicker}
  </section>;
}

function ProjectGalleryPicker({available,galleryId,setGalleryId,busy,onLink,onClose}:{
  available:StudioProjectOverview["availableGalleries"];galleryId:string;
  setGalleryId:(id:string)=>void;busy:boolean;onLink:()=>void;onClose:()=>void;
}){
  return <div className="mt-4 flex flex-wrap items-center gap-2 border border-[#eee9f1] bg-[#fbfaff] p-4">
    <select className={INPUT+" min-w-[200px] flex-1"} value={galleryId} onChange={e=>setGalleryId(e.target.value)} aria-label="Choose a gallery collection">
      <option value="">Choose a collection</option>
      {available.map(g=><option key={g._id} value={g._id}>{g.name}</option>)}
    </select>
    <button type="button" className={ACT} disabled={!galleryId||busy} onClick={onLink}>Link</button>
    <button type="button" className={SECONDARY} onClick={onClose}>Cancel</button>
    {!available.length&&<p className="w-full text-xs text-[#999]">No unlinked collections found. Create a collection in Client Gallery first, then return to link it.</p>}
    <Link href="/dashboard/client-gallery/collections" className="w-full text-xs font-semibold text-[#6337d8] hover:underline">Open Client Gallery Collections</Link>
  </div>;
}

export function StudioProjectDetail({
  projectId,revision,projectStages,projectStageColors,projectStageLabels,onEditProject,onNewDocument,onOpenDocument,onCompose,
}:{
  projectId:string;revision:number;projectStages?:string[];
  projectStageColors?:Record<string,string>;projectStageLabels?:Record<string,string>;
  onEditProject:(project:StudioRecord)=>void;
  onNewDocument:(type:"invoice"|"contract"|"questionnaire"|"quote",project:StudioRecord,client:StudioRecord|null)=>void;
  onOpenDocument:(record:StudioRecord)=>void;
  onCompose:(project:StudioRecord,client:StudioRecord|null)=>void;
}){
  const router=useRouter();
  const [data,setData]=useState<StudioProjectOverview|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [actions,setActions]=useState<"more"|"create"|"stage"|null>(null);
  const [documentMenu,setDocumentMenu]=useState<string|null>(null);
  const [sessionMenu,setSessionMenu]=useState<string|null>(null);
  const [selectedCurrency,setSelectedCurrency]=useState("EUR");
  const [noteText,setNoteText]=useState("");
  const [gallerySelector,setGallerySelector]=useState(false);
  const [documentSelector,setDocumentSelector]=useState(false);
  const [galleryId,setGalleryId]=useState("");
  const [sessionEditor,setSessionEditor]=useState<StudioSession|"new"|null>(null);
  const [expandedMessage,setExpandedMessage]=useState<string|null>(null);
  const reload=useCallback(async()=>{
    try{
      const result=await studioProjectOverview(projectId);
      setData(result);setError("");
    }catch(e){setError(e instanceof Error?e.message:"Could not load this project");}
    finally{setLoading(false);}
  },[projectId]);
  // Refresh asynchronously whenever a project save or route change completes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void reload();},[reload,revision]);
  const project=data?.project;
  const client=data?.primaryClient||null;
  const showGettingStarted=Boolean(data && !data.documents.length && !data.sessions.length &&
    !data.messages.length && !data.galleries.length);
  const payments=data?.payments||[];
  const currency=payments.find(v=>v.currency===selectedCurrency)||payments[0]||{currency:"EUR",paid:0,upcoming:0,overdue:0};
  const allCurrencies=payments.map(v=>v.currency);
  const notes=[...(data?.notes||[])].reverse();
  const available=(data?.availableGalleries||[]).filter(g=>!(data?.galleries||[]).some(x=>x._id===g._id));
  const create=(type:"invoice"|"contract"|"questionnaire"|"quote"|"session")=>{
    setActions(null);
    if(!project)return;
    if(type==="session")setSessionEditor("new");
    else onNewDocument(type,project,client);
  };
  const updateStatus=async(stage:string)=>{
    if(!project)return;
    if(stage===project.status){setActions(null);return;}
    setActions(null);setBusy(true);
    try{await studioUpdate("projects",projectId,{status:stage});toast.success("Project stage updated");await reload();}
    catch(e){toast.error(e instanceof Error?e.message:"Could not update project stage");}
    finally{setBusy(false);}
  };
  const removeProject=async()=>{
    if(!project||!window.confirm("Permanently delete "+project.title+"? This cannot be undone."))return;
    setBusy(true);setActions(null);
    try{await studioDelete("projects",projectId);toast.success("Project deleted");router.push(BASE+"/projects");}
    catch(e){toast.error(e instanceof Error?e.message:"Could not delete project");setBusy(false);}
  };
  const archiveProject=async()=>{
    if(!project)return;
    setBusy(true);setActions(null);
    try{await studioUpdate("projects",projectId,{archived:!project.archived});toast.success(project.archived?"Project restored":"Project archived");await reload();}
    catch(e){toast.error(e instanceof Error?e.message:"Could not change archive status");}
    finally{setBusy(false);}
  };
  const saveNote=async(e?:FormEvent)=>{
    e?.preventDefault();
    if(!noteText.trim()||busy)return;
    setBusy(true);
    try{await studioAddProjectNote(projectId,noteText.trim());setNoteText("");await reload();toast.success("Private note saved");}
    catch(e){toast.error(e instanceof Error?e.message:"Could not save note");}
    finally{setBusy(false);}
  };
  const deleteNote=async(id:string)=>{
    if(!window.confirm("Delete this private note?"))return;
    setBusy(true);
    try{await studioDeleteProjectNote(projectId,id);await reload();toast.success("Note removed");}
    catch(e){toast.error(e instanceof Error?e.message:"Could not delete note");}
    finally{setBusy(false);}
  };
  const linkGallery=async()=>{
    if(!galleryId)return;
    setBusy(true);
    try{await studioLinkProjectGallery(projectId,galleryId);setGalleryId("");setGallerySelector(false);await reload();toast.success("Gallery linked to project");}
    catch(e){toast.error(e instanceof Error?e.message:"Could not link gallery");}
    finally{setBusy(false);}
  };
  const unlinkGallery=async(id:string)=>{
    if(!window.confirm("Unlink this gallery from the project? The collection itself will not be deleted."))return;
    setBusy(true);
    try{await studioUnlinkProjectGallery(projectId,id);await reload();toast.success("Gallery unlinked");}
    catch(e){toast.error(e instanceof Error?e.message:"Could not unlink gallery");}
    finally{setBusy(false);}
  };
  const sendDocument=async(doc:StudioRecord)=>{
    setDocumentMenu(null);setBusy(true);
    try{
      if(doc.kind==="invoices")await studioSendInvoice(doc._id);
      else await studioSendContract(doc._id);
      toast.success("Document emailed to client");await reload();
    }catch(e){toast.error(e instanceof Error?e.message:"Could not send document");}
    finally{setBusy(false);}
  };
  const paidDocument=async(doc:StudioRecord)=>{
    setDocumentMenu(null);
    if(!window.confirm("Record receipt of "+money(doc.amount,doc.currency)+" for this invoice?"))return;
    const method=window.prompt("Payment method", "Bank transfer");
    if(!method?.trim())return;
    setBusy(true);
    try{await studioRecordPayment(doc._id,method);toast.success("Payment recorded");await reload();}
    catch(e){toast.error(e instanceof Error?e.message:"Could not record payment");}
    finally{setBusy(false);}
  };
  const removeDocument=async(doc:StudioRecord)=>{
    setDocumentMenu(null);
    if(!window.confirm("Delete "+doc.title+"?"))return;
    setBusy(true);
    try{await studioDelete(doc.kind,doc._id);toast.success("Document deleted");await reload();}
    catch(e){toast.error(e instanceof Error?e.message:"Could not delete document");}
    finally{setBusy(false);}
  };
  const updateSession=async(session:StudioSession,status:string)=>{
    setSessionMenu(null);setBusy(true);
    try{await studioUpdateBookingEvent(session._id,{status});toast.success("Session updated");await reload();}
    catch(e){toast.error(e instanceof Error?e.message:"Could not update session");}
    finally{setBusy(false);}
  };
  const removeSession=async(session:StudioSession)=>{
    setSessionMenu(null);
    if(!window.confirm("Delete this session?"))return;
    setBusy(true);
    try{await studioDeleteBookingEvent(session._id);toast.success("Session deleted");await reload();}
    catch(e){toast.error(e instanceof Error?e.message:"Could not delete session");}
    finally{setBusy(false);}
  };
  if(loading&&!data)return <div className="flex min-h-[400px] items-center gap-2 text-sm text-[#8c8791]"><Loader2 className="size-4 animate-spin"/> Loading project…</div>;
  if(!data||!project)return <div className="space-y-5"><Link className={"inline-flex items-center gap-2 text-xs font-semibold "+ACCENT} href={BASE+"/projects"}><ArrowLeft className="size-4"/> Back to projects</Link><p role="alert" className="bg-red-50 p-5 text-sm text-red-700">{error||"Project not found"}</p><button className={SECONDARY} onClick={()=>void reload()}>Try again</button></div>;
  const stages=Array.from(new Set([
    ...((projectStages?.length?projectStages:defaultStages).filter(stage=>/^[a-z][a-z0-9-]{0,39}$/.test(stage))),
    "cancelled",project.status,
  ]));
  const stageTitle=(stage:string)=>projectStageLabels?.[stage]||nameOf(stage);
  const stageStyle=(stage:string)=>{
    const color=projectStageColors?.[stage];
    return color&&/^#[0-9a-f]{6}$/i.test(color)?{color,backgroundColor:color+"1A"}:undefined;
  };
  const galleryPicker=gallerySelector?<ProjectGalleryPicker available={available} galleryId={galleryId}
    setGalleryId={setGalleryId} busy={busy} onLink={()=>void linkGallery()}
    onClose={()=>setGallerySelector(false)}/>:null;
  return <div className="min-h-[90vh] text-[#25212b]">
    <div className="flex flex-wrap items-center justify-between gap-4 pb-11">
      <div className="flex min-w-0 items-center gap-4">
        <Link href={BASE+"/projects"} aria-label="Back to projects" className="rounded p-1.5 hover:bg-[#f6f3fb]"><ArrowLeft className="size-5"/></Link>
        <h1 className="max-w-[470px] truncate text-[23px] font-medium tracking-[-.035em] sm:text-[26px]">{project.title}</h1>
        <div className="relative">
          <button disabled={busy} onClick={()=>setActions(actions==="stage"?null:"stage")}
            aria-label={"Change project stage, currently "+stageTitle(project.status)}
            aria-expanded={actions==="stage"} aria-haspopup="menu"
            style={stageStyle(project.status)}
            className={"inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-bold uppercase "+(statuses[project.status]||"bg-[#f4f2f7] text-[#73707e]")}>
            <span className="size-1.5 rounded-full bg-current"/>{stageTitle(project.status)}<ChevronDown className="size-3.5"/>
          </button>
          {actions==="stage"&&<div className="absolute left-0 top-full z-40 mt-1 w-48 border border-[#e7e3ed] bg-white py-1 shadow-xl" role="menu" aria-label="Choose project stage">
            {stages.map(stage=><div key={stage} role="none"><button type="button" role="menuitemradio" aria-checked={stage===project.status}
              onClick={()=>void updateStatus(stage)} className={"flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-[#f7f5fb] "+(stage===project.status?"font-semibold text-[#6337d8]":"text-[#4c4653]")}>
              {stage===project.status?<Check className="size-3.5"/>:<span className="size-3.5"/>}{stageTitle(stage)}
            </button></div>)}
          </div>}
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative">
          <button className="inline-flex h-10 items-center gap-2 px-2 text-xs font-semibold hover:text-[#6337d8]" onClick={()=>setActions(actions==="more"?null:"more")}>More <ChevronDown className="size-3.5"/></button>
          {actions==="more"&&<div className="absolute right-0 top-11 z-40 w-52 border border-[#e7e3ed] bg-white py-1 shadow-xl">
            <DropItem onClick={()=>{setActions(null);onEditProject(project);}}><Pencil className="size-4"/> Edit project</DropItem>
            <DropItem onClick={()=>void archiveProject()}><FolderOpen className="size-4"/>{project.archived?"Restore project":"Archive project"}</DropItem>
            <DropItem danger onClick={()=>void removeProject()}><Trash2 className="size-4"/>Delete project</DropItem>
          </div>}
        </div>
        <div className="relative">
          <button className={ACT+" !min-h-[40px]"} onClick={()=>setActions(actions==="create"?null:"create")}>Create New <ChevronDown className="size-4"/></button>
          {actions==="create"&&<div className="absolute right-0 top-11 z-40 w-[205px] border border-[#ece7f2] bg-white py-1 shadow-[0_15px_40px_rgba(35,21,47,.13)]">
            <DropItem onClick={()=>create("invoice")}><FileText className="size-4"/> Invoice</DropItem>
            <DropItem onClick={()=>create("contract")}><FileCheck2 className="size-4"/> Contract</DropItem>
            <DropItem onClick={()=>create("questionnaire")}><FilePlus2 className="size-4"/> Questionnaire</DropItem>
            <DropItem onClick={()=>create("quote")}><FileText className="size-4"/> Quote</DropItem>
            <DropItem onClick={()=>create("session")}><CalendarDays className="size-4"/> Session</DropItem>
          </div>}
        </div>
      </div>
    </div>
    {error&&<p role="alert" className="mb-5 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {project.archived&&<p className="mb-7 border-l-2 border-[#6337d8] bg-[#f5f1ff] p-3 text-xs text-[#6e5aaa]">This project is archived. Restore it from More to make it active again.</p>}
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.52fr)_minmax(300px,1fr)] lg:gap-14 xl:gap-[62px]">
      <div className="min-w-0 space-y-14">
        {showGettingStarted?<ProjectGettingStarted onCreate={create} onGallery={()=>setGallerySelector(v=>!v)}
          galleryPicker={galleryPicker}/>:<>
        <section>
          <SectionTitle title="Payments"/>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="grid w-full grid-cols-3 gap-3 sm:gap-5">
              {[
                ["Paid",currency.paid,"bg-[#10a37f]"],
                ["Upcoming",currency.upcoming,"bg-[#e9a900]"],
                ["Past due",currency.overdue,"bg-[#df4559]"],
              ].map(([label,value,color])=><div key={String(label)}>
                <p className="flex items-center gap-2 text-xs text-[#5b5860]"><span className={"size-[7px] rounded-full "+color}/>{label}</p>
                <p className="mt-4 text-[16px] font-medium tracking-[-.02em] sm:text-[19px]">{money(Number(value),currency.currency)}</p>
              </div>)}
            </div>
            {allCurrencies.length>1&&<label className="mt-2 text-xs text-[#777]">Currency <select className="ml-2 border px-2 py-1" value={currency.currency} onChange={e=>setSelectedCurrency(e.target.value)}>{allCurrencies.map(c=><option key={c}>{c}</option>)}</select></label>}
          </div>
        </section>
        <section>
          <SectionTitle title="Documents" action={()=>setDocumentSelector(v=>!v)} actionLabel="Create project document"/>
          {documentSelector&&<div className="flex flex-wrap gap-2 border-b border-[#eee] bg-[#faf8fd] px-3 py-3">
            {(["invoice","contract","questionnaire","quote"] as const).map(type=><button key={type} className="border border-[#e9e5ef] bg-white px-3 py-2 text-xs font-semibold hover:border-[#b59ce8]" onClick={()=>{setDocumentSelector(false);create(type);}}>{nameOf(type)}</button>)}
          </div>}
          {(data.documents||[]).length? <div className="divide-y divide-[#eeebf0]">{data.documents.map(doc=>{
            const label=doc.kind==="invoices"?"Invoice":nameOf(doc.type||"Document");
            return <div key={doc._id} className="flex min-h-[78px] items-center gap-4 py-3.5">
              <button type="button" onClick={()=>onOpenDocument(doc)} className="grid size-10 shrink-0 place-items-center border border-[#ebe9ed] bg-[#faf9fb] text-[#9b96a0] hover:text-[#6337d8]"><FileText className="size-5"/></button>
              <button type="button" onClick={()=>onOpenDocument(doc)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-semibold hover:text-[#6337d8]">{doc.kind==="invoices"&&doc.details?.number?"Invoice #"+String(doc.details.number).replace(/^INV-/i,""):doc.title}</p>
                <p className="mt-1.5 truncate text-[11px] text-[#87818c]">{label} · {money(doc.amount,doc.currency)} · {day(doc.dueDate||doc.createdAt)}</p>
              </button>
              <Tag value={doc.status}/>
              <span className="hidden size-7 shrink-0 place-items-center rounded-full bg-[#f6eeee] text-[10px] font-bold text-[#825c65] sm:grid">{shortName(client?.title||doc.email||"Client")}</span>
              <div className="relative">
                <button type="button" aria-label={"Actions for "+doc.title} className="rounded p-2 hover:bg-[#f6f3f9]" onClick={()=>setDocumentMenu(documentMenu===doc._id?null:doc._id)}><MoreHorizontal className="size-[17px]"/></button>
                {documentMenu===doc._id&&<div className="absolute right-0 top-9 z-40 w-48 border border-[#e9e6ed] bg-white py-1 shadow-xl">
                  <DropItem onClick={()=>{setDocumentMenu(null);onOpenDocument(doc);}}>Open document</DropItem>
                  {!["paid","completed","cancelled"].includes(doc.status)&&<DropItem onClick={()=>void sendDocument(doc)}><Mail className="size-4"/> Email client</DropItem>}
                  {doc.kind==="invoices"&&!["paid","cancelled"].includes(doc.status)&&<DropItem onClick={()=>void paidDocument(doc)}>Record payment</DropItem>}
                  {!["paid","completed"].includes(doc.status)&&<DropItem danger onClick={()=>void removeDocument(doc)}><Trash2 className="size-4"/> Delete</DropItem>}
                </div>}
              </div>
            </div>;
          })}</div>:<p className="py-9 text-center text-sm text-[#a5a0a9]">No documents yet. Use Create New to add one.</p>}
        </section>
        <section>
          <SectionTitle title="Sessions" action={()=>create("session")} actionLabel="Add project session"/>
          {data.sessions.length?<div className="divide-y divide-[#eeebf0]">{data.sessions.map(session=><div key={session._id} className="flex min-h-[79px] items-center gap-4 py-3.5">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={()=>setSessionEditor(session)}>
              <p className="truncate text-xs font-semibold hover:text-[#6337d8]">{session.title}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#87818c]"><span className="size-1.5 rounded-full bg-[#aaa4ac]"/>{session.kind==="event"?"Blocked time / event":session.serviceName||"One-off Session"}</p>
            </button>
            <Tag value={session.status}/>
            <span className="hidden size-7 shrink-0 place-items-center rounded-full bg-[#f6eeee] text-[10px] font-bold text-[#825c65] sm:grid">{shortName(session.clientName||client?.title||"Client")}</span>
            <button type="button" className="min-w-[120px] text-left text-[11px]" onClick={()=>setSessionEditor(session)}>
              <p className="font-medium">{when(session.startAt)}</p>
              <p className="mt-1 text-[#89818e]">{time(session.startAt)} – {time(session.endAt)}</p>
            </button>
            <div className="relative">
              <button type="button" aria-label={"Actions for "+session.title} className="rounded p-2 hover:bg-[#f6f3f9]" onClick={()=>setSessionMenu(sessionMenu===session._id?null:session._id)}><MoreHorizontal className="size-4"/></button>
              {sessionMenu===session._id&&<div className="absolute right-0 top-9 z-40 w-48 border border-[#eee] bg-white py-1 shadow-xl">
                <DropItem onClick={()=>{setSessionMenu(null);setSessionEditor(session);}}>Edit session</DropItem>
                {session.status!=="confirmed"&&<DropItem onClick={()=>void updateSession(session,"confirmed")}>Mark confirmed</DropItem>}
                {session.status!=="completed"&&<DropItem onClick={()=>void updateSession(session,"completed")}>Mark completed</DropItem>}
                {session.status!=="cancelled"&&<DropItem onClick={()=>void updateSession(session,"cancelled")}>Cancel session</DropItem>}
                <DropItem danger onClick={()=>void removeSession(session)}>Delete session</DropItem>
              </div>}
            </div>
          </div>)}</div>:<p className="py-9 text-center text-sm text-[#a5a0a9]">No sessions linked to this project yet.</p>}
        </section>
        <section>
          <SectionTitle title="Conversations"/>
          {data.messages.length?<div className="divide-y divide-[#eeebf0]">{data.messages.map(message=><button key={message._id} onClick={()=>setExpandedMessage(expandedMessage===message._id?null:message._id)} type="button" className="flex w-full gap-3 py-4 text-left hover:bg-[#fdfbff]">
            <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-[#f3eefb] text-[#6337d8]"><Mail className="size-4"/></span>
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold">{message.title}</p><span className="shrink-0 text-[10px] text-[#aaa]">{day(message.createdAt)}</span></div>
              <p className="mt-1 text-[11px] text-[#8e8993]">{message.status==="sent"?"To: ":"From: "}{message.email||"Client"}</p>
              <p className={"mt-2 whitespace-pre-wrap text-xs leading-5 text-[#67616e] "+(expandedMessage===message._id?"":"line-clamp-2")}>{message.description||"Open to view the message"}</p></div>
          </button>)}</div>:<div className="flex flex-col items-center justify-center py-12">
            <div className="relative text-[#c5c0c9]"><FileText className="size-9 stroke-[1.15]"/><MessageSquare className="absolute -bottom-2 -right-3 size-5 stroke-[1.6]"/></div>
            <p className="mt-5 text-[12px] text-[#a6a0ab]">No conversation yet</p>
          </div>}
          <button className={"mx-auto mt-3 flex items-center gap-2 text-xs font-semibold "+ACCENT} onClick={()=>onCompose(project,client)}>
            <Plus className="size-[16px]"/> Send a message
          </button>
        </section>
        <section>
          <SectionTitle title="Client Gallery Collections" action={()=>setGallerySelector(v=>!v)} actionLabel="Link a Client Gallery collection"/>
          {galleryPicker}
          {data.galleries.length?<div className="divide-y divide-[#eee]">{data.galleries.map(g=><div key={g._id} className="flex items-center gap-3 py-5">
            <div className="grid size-12 shrink-0 place-items-center bg-[#f7f4fa] text-[#8f8a94]"><ImageIcon className="size-6"/></div>
            <Link href={"/dashboard/client-gallery/collections/"+encodeURIComponent(g._id)} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold hover:text-[#6337d8]">{g.name}</p><p className="mt-1 text-xs text-[#999]">{g.imageCount||0} photos · {nameOf(g.status||"draft")}</p>
            </Link>
            <button type="button" className="p-2 text-[#999] hover:text-red-600" aria-label={"Unlink "+g.name} onClick={()=>void unlinkGallery(g._id)}><X className="size-4"/></button>
          </div>)}</div>:<p className="py-8 text-center text-sm text-[#aaa4ae]">No client gallery collections linked to this project.</p>}
        </section>
        </>}
      </div>
      <aside className="min-w-0 space-y-16">
        <section>
          <div className="flex items-center justify-between border-b border-[#e9e8eb] pb-3.5">
            <h2 className="text-[15px] font-semibold">Project Details</h2>
            <button type="button" aria-label="Edit project details" onClick={()=>onEditProject(project)} className={"p-1 hover:bg-[#f4efff] "+ACCENT}><Pencil className="size-4"/></button>
          </div>
          <dl className="mt-5 grid grid-cols-[minmax(95px,35%)_1fr] gap-x-4 gap-y-5 text-[12px] leading-5">
            <dt className="text-[#92909a]">Primary Client</dt><dd>{client?<><Link className="font-semibold text-[#6337d8] hover:underline" href={BASE+"/contacts"}>{client.title}</Link><p className="mt-1 break-all text-[11px]">{client.email}</p></>:<span className="text-[#aaa]">—</span>}</dd>
            <dt className="text-[#92909a]">Additional Clients</dt>
            <dd>{data.additionalClients.length?data.additionalClients.map(c=><p key={c._id} className="mb-2"><span className="font-semibold">{c.title}</span><span className="block break-all text-[11px] text-[#888]">{c.email}</span></p>):"—"}</dd>
            <dt className="text-[#92909a]">Project Type</dt><dd>{nameOf(project.type||"Other")}</dd>
            <dt className="text-[#92909a]">Project Date</dt><dd>{day(project.date)}</dd>
            <dt className="text-[#92909a]">Location</dt><dd className="break-words">{String(project.details?.location||"—")}</dd>
            <dt className="text-[#92909a]">Description</dt><dd className="whitespace-pre-wrap break-words">{project.description||"—"}</dd>
          </dl>
        </section>
        <section>
          <SectionTitle title="Notes"/>
          <form onSubmit={e=>void saveNote(e)} className="mt-5">
            <textarea rows={2} maxLength={2000} value={noteText} onChange={e=>setNoteText(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void saveNote();}}}
              placeholder="Write a note and press enter (only visible to you)"
              className="w-full min-h-[49px] resize-y border border-[#ebe8ed] p-3 text-[12px] outline-none placeholder:text-[#aaa3ae] focus:border-[#9773e1]"/>
            {noteText.trim()&&<button type="submit" className={ACT+" mt-2"} disabled={busy}><Check className="size-4"/> Save note</button>}
          </form>
          {notes.length>0&&<div className="mt-5 divide-y divide-[#eeebf0]">{notes.map(note=><div key={note.id} className="flex gap-3 py-4">
            <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words text-xs leading-6 text-[#5e5864]">{note.text}</p><p className="mt-2 text-[10px] text-[#a5a0ab]">{day(note.createdAt)}</p></div>
            <button type="button" aria-label="Delete private note" onClick={()=>void deleteNote(note.id)} className="self-start p-1 text-[#aaa] hover:text-red-600"><Trash2 className="size-3.5"/></button>
          </div>)}</div>}
        </section>
      </aside>
    </div>
    {sessionEditor&&<ProjectSessionEditor initial={sessionEditor==="new"?null:sessionEditor} project={project} client={client}
      onClose={()=>setSessionEditor(null)} onSaved={async()=>{setSessionEditor(null);await reload();}}/>}
  </div>;
}

function localDateTime(iso?:string){
  if(!iso)return "";
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return "";
  const pad=(n:number)=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
}
function ProjectSessionEditor({
  initial,project,client,onClose,onSaved,
}:{
  initial:StudioSession|null;project:StudioRecord;client:StudioRecord|null;
  onClose:()=>void;onSaved:()=>Promise<void>;
}){
  const [defaultStart]=useState(()=>{
    const d=project.date?new Date(project.date):new Date();
    d.setHours(9,0,0,0);return d.toISOString();
  });
  const [form,setForm]=useState({
    title:initial?.title||project.title+" Session",
    kind:initial?.kind||"booking",
    status:initial?.status||"awaiting-client",
    startAt:localDateTime(initial?.startAt||defaultStart),
    endAt:localDateTime(initial?.endAt||new Date(new Date(defaultStart).getTime()+60*60*1000).toISOString()),
    location:initial?.location||String(project.details?.location||""),
    notes:initial?.notes||"",
  });
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const save=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError("");
    try{
      const start=new Date(form.startAt);const end=new Date(form.endAt);
      if(!form.title.trim()||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)
        throw new Error("Give this session a title and valid start and end times.");
      const payload={
        title:form.title.trim(),kind:form.kind,status:form.status,
        startAt:start.toISOString(),endAt:end.toISOString(),
        location:form.location,notes:form.notes,
      };
      if(initial)await studioUpdateBookingEvent(initial._id,payload);
      else await studioCreateBookingEvent({
        ...payload,projectId:project._id,contactId:project.contactId||"",
        clientName:client?.title||"",clientEmail:client?.email||"",
      });
      toast.success(initial?"Session updated":"Session created");
      await onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Could not save session");}
    finally{setBusy(false);}
  };
  return <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-[#1b1722]/60 px-3 py-10" role="dialog" aria-modal="true" aria-label="Project session editor">
    <form onSubmit={e=>void save(e)} className="w-full max-w-xl bg-white px-7 py-8 shadow-2xl sm:p-10">
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#999]">Project Sessions</p>
        <h2 className="mt-2 text-xl font-semibold">{initial?"Edit session":"Create session"}</h2></div>
        <button type="button" aria-label="Close session editor" onClick={onClose}><X className="size-5"/></button></div>
      <div className="mt-8 space-y-5">
        <label className="block space-y-2 text-xs font-semibold">Session title *<input required className={INPUT} value={form.title} maxLength={180} onChange={e=>setForm({...form,title:e.target.value})}/></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-xs font-semibold">Type<select className={INPUT} value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as StudioSession["kind"]})}><option value="booking">One-off Session</option><option value="event">Blocked time / event</option></select></label>
          <label className="block space-y-2 text-xs font-semibold">Status<select className={INPUT} value={form.status} onChange={e=>setForm({...form,status:e.target.value as StudioSession["status"]})}>{["awaiting-client","pending","confirmed","completed","cancelled"].map(s=><option value={s} key={s}>{nameOf(s)}</option>)}</select></label>
          <label className="block space-y-2 text-xs font-semibold">Start date & time *<input required type="datetime-local" className={INPUT} value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/></label>
          <label className="block space-y-2 text-xs font-semibold">End date & time *<input required type="datetime-local" className={INPUT} value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/></label>
        </div>
        <label className="block space-y-2 text-xs font-semibold">Location<input className={INPUT} maxLength={240} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
        <label className="block space-y-2 text-xs font-semibold">Session notes<textarea className={INPUT+" min-h-28 p-3"} maxLength={2000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <p className="text-[11px] leading-5 text-[#918b97]">Saving a session adds it to your studio calendar. It does not automatically email the client.</p>
      </div>
      {error&&<p role="alert" className="mt-5 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-8 flex justify-end gap-3 border-t pt-6"><button type="button" className={SECONDARY} onClick={onClose}>Cancel</button>
        <button type="submit" className={ACT} disabled={busy}><Check className="size-4"/>{busy?"Saving…":"Save session"}</button></div>
    </form>
  </div>;
}

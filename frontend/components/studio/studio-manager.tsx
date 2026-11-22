"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  Archive, ArrowLeft, ArrowRight, BarChart3, Bell, CalendarDays, Check, ChevronDown,
  CircleDollarSign, ClipboardList, Copy, CreditCard, Ellipsis, ExternalLink, FileCheck2,
  FilePenLine, FilePlus2, FileText, Folder, House, Inbox, LayoutGrid, List, Loader2,
  Images, Mail, Menu, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Smartphone, SquareStack,
  Store, Tag, Trash2, Users, WalletCards, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  studioCreate, studioDelete, studioList, studioOverview, studioRecordPayment,
  studioSendContract, studioSendInvoice, studioShareUrl,studioUpdate, studioBookingOverview, studioProjectPayments, studioFinancialReport,
  type StudioKind, type StudioRecord, type StudioOverview, type StudioBookings, type StudioProjectPayment, type StudioFinancialReport,
  type StudioList,
} from "@/actions/studio";
import { StudioEditor } from "./studio-editors";
import { StudioBookingsPage } from "./studio-bookings";
import { StudioFormDesigner } from "./studio-form-designer";
import { StudioInvoiceDesigner } from "./studio-invoice-designer";
import { StudioEmailComposer, StudioTemplateUseDialog } from "./studio-email";
import { StudioProjectDetail } from "./studio-project-detail";
import { StudioProjectCreate } from "./studio-project-create";
import { StudioProjectSheet } from "./studio-project-sheet";
import { StudioContractEditor } from "./studio-contract-editor";
import { StudioDocumentDesigner } from "./studio-document-designer";
import { StudioStageDialog } from "./studio-stage-dialog";
import { StudioPaymentSettings } from "./studio-payment-settings";
import { StudioPaymentLinkEditor } from "./studio-payment-link-editor";
import {studioPaymentLinkSites} from "@/actions/studio-payment-links";
import {previewStudioPublicDraft} from "./studio-public-links";

const BASE = "/dashboard/studio-management";
const PRIMARY = "bg-[#6337d8] text-white hover:bg-[#532ac2]";
const BTN = "inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold transition disabled:opacity-50";
const OUTLINE = "inline-flex h-10 items-center justify-center gap-2 border border-[#e8e5ee] bg-white px-4 text-sm font-medium text-[#44414c] hover:bg-[#f6f4f9]";
const SMALL_HEADING = "text-[10px] font-semibold uppercase tracking-[.13em] text-[#96919e]";
const INK = "#25212d";
type StudioNavItem = { label: string; page: string; icon: LucideIcon; children?: StudioNavItem[] };
const nav: StudioNavItem[] = [
  { label: "Home", page: "home", icon: House },
  { label: "Projects", page: "projects", icon: Folder },
  { label: "Contacts", page: "contacts", icon: Users, children: [
    { label: "Contacts", page: "contacts", icon: Users },
    { label: "Contact Forms", page: "contact-forms", icon: FilePenLine },
  ] },
  { label: "Inbox", page: "inbox", icon: Inbox },
  { label: "Payments", page: "invoices", icon: CircleDollarSign, children: [
    { label: "Invoices", page: "invoices", icon: FileText },
    { label: "Payment Links", page: "payment-links", icon: WalletCards },
    { label: "Transactions", page: "transactions", icon: CreditCard },
    { label: "Reports", page: "reports", icon: BarChart3 },
  ] },
  { label: "Bookings", page: "session-types", icon: CalendarDays, children: [
    { label: "Session Types", page: "session-types", icon: ClipboardList },
    { label: "Sessions", page: "sessions", icon: FileCheck2 },
    { label: "Calendar", page: "calendar", icon: CalendarDays },
    { label: "Booking Site", page: "booking-site", icon: LayoutGrid },
    { label: "Discounts", page: "discounts", icon: Tag },
  ] },
  { label: "Documents", page: "contracts", icon: FileText, children: [
    { label: "Contracts", page: "contracts", icon: FilePenLine },
    { label: "Questionnaires", page: "questionnaires", icon: ClipboardList },
    { label: "Quotes", page: "quotes", icon: FilePlus2 },
  ] },
  { label: "Templates", page: "templates", icon: SquareStack },
  { label: "Settings", page: "settings", icon: Settings },
];
const productSwitcherItems: {key:string;title:string;description:string;href:string;icon:LucideIcon}[] = [
  {key:"client-gallery",title:"Client Gallery",description:"Share, deliver, proof and sell photo galleries",href:"/dashboard/client-gallery",icon:Images},
  {key:"store-gallery",title:"Store Gallery",description:"Manage your online store, prints and downloads",href:"/dashboard/store-gallery",icon:Store},
  {key:"mobile-gallery",title:"Mobile Gallery App",description:"Create installable mobile-first photo apps",href:"/dashboard/mobile-gallery",icon:Smartphone},
  {key:"studio-management",title:"Studio Manager",description:"Projects, contacts, payments, bookings and documents",href:BASE+"/home",icon:CalendarDays},
];

function ProductSwitcher({compact=false,onNavigate}:{compact?:boolean;onNavigate?:()=>void}){
  return <details className="group relative min-w-0">
    <summary aria-label="Switch product" className={"flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 font-bold outline-none transition hover:bg-[#f7f5fb] focus-visible:ring-2 focus-visible:ring-[#6337d8] [&::-webkit-details-marker]:hidden "+(compact?"text-sm":"w-full text-[13px]")}>
      <span className="truncate">{compact?"Gallerista · Studio Manager":"Studio Manager"}</span>
      <ChevronDown className="size-3 shrink-0 text-[#8b8691] transition-transform group-open:rotate-180"/>
    </summary>
    <div className={"absolute top-full z-[80] mt-2 w-[320px] max-w-[calc(100vw-2rem)] border border-[#ece8f1] bg-white p-2 shadow-[0_18px_45px_rgba(24,18,38,.16)] "+(compact?"left-1/2 -translate-x-1/2":"left-0")}>
      <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#a09aa7]">Switch product</p>
      {productSwitcherItems.map(item=>{
        const Icon=item.icon;
        const current=item.key==="studio-management";
        return <Link key={item.key} href={item.href} onClick={event=>{onNavigate?.();event.currentTarget.closest("details")?.removeAttribute("open");}} aria-current={current?"page":undefined}
          className={"flex items-center gap-3 rounded-md px-3 py-3 transition "+(current?"bg-[#f4f0ff]":"hover:bg-[#f8f7fa]")}>
          <span className={"grid size-9 shrink-0 place-items-center rounded-full text-white "+(current?"bg-[#6337d8]":"bg-[#8a6bd2]")}><Icon className="size-[17px]"/></span>
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-[#282431]">{item.title}</span><span className="mt-0.5 block text-[11px] leading-4 text-[#8c8792]">{item.description}</span></span>
          {current&&<span className="text-[9px] font-bold uppercase tracking-wider text-[#6337d8]">Current</span>}
        </Link>;
      })}
      <div className="mt-1 border-t border-[#f0edf3] px-3 py-3"><Link href="/dashboard/overview" onClick={event=>{onNavigate?.();event.currentTarget.closest("details")?.removeAttribute("open");}} className="flex items-center gap-2 text-xs font-semibold text-[#706a78] hover:text-[#6337d8]"><LayoutGrid className="size-4"/> All products overview</Link></div>
    </div>
  </details>;
}

const allPages = nav.flatMap((n) => [n.page, ...(n.children ? [...n.children.map((x) => x.page)] : [])]);
type EditorState = { kind: StudioKind; initial?: StudioRecord | null; subtype?: string; defaults?: {contactId?:string;projectId?:string;email?:string} };
type RecordMap = Partial<Record<StudioKind, StudioRecord[]>>;

const stagesDefault = ["inquiry", "booked", "post-production", "completed"];
const stageColor: Record<string,string> = {
  inquiry: "bg-[#fff8dd] text-[#a77300]", booked: "bg-[#f1edff] text-[#6950b6]",
  "post-production": "bg-[#e8f7fe] text-[#3181a4]", completed: "bg-[#e9f8ec] text-[#40834e]",
  cancelled: "bg-[#fceef1] text-[#c04f63]",
};
function badge(status: string) {
  return "inline-flex items-center gap-2 whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.05em] " +
    (stageColor[status] || (status==="paid" || status==="client" || status==="active" || status==="published" ? "bg-[#eaf9ef] text-[#3c9055]" :
      status==="lead" || status==="pending" ? "bg-[#e9f3ff] text-[#3d78af]" : "bg-[#f4f3f6] text-[#797681]"));
}
function money(amount?: number, currency="EUR") {
  return currency + " " + Number(amount||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}
function dateLabel(value?: string) {
  if(!value)return "TBD";
  const d=new Date(value);return Number.isNaN(d.getTime())?"TBD":d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
}
function timeAgo(value?: string) {return value?dateLabel(value):"—";}
function nice(value: string) {return value.split("-").map(x=>x.slice(0,1).toUpperCase()+x.slice(1)).join(" ");}
function initials(value: string) {return value.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()||"CL";}
function array(data: RecordMap, kind: StudioKind) {return data[kind]||[];}
function recordKinds(page:string):StudioKind[] {
  if(page==="home")return ["projects","invoices","messages","contacts"];
  if(page==="projects")return ["projects","contacts","settings"];
  if(page==="contacts")return ["contacts","projects"];
  if(page==="contact-forms")return ["forms"];
  if(page==="inbox")return ["messages","contacts","projects"];
  if(page==="invoices")return ["invoices","contacts","projects"];
  if(page==="payment-links")return ["payment-links","contacts","projects"];
  if(page==="transactions")return ["transactions"];
  if(page==="reports")return ["invoices","transactions","projects"];
  if(page==="templates")return ["templates","contacts","projects"];
  if(["contracts","questionnaires","quotes"].includes(page))return ["documents","contacts","projects","templates"];
  if(page==="discounts")return ["discounts"];
  if(page==="settings")return ["settings"];
  return [];
}
const recordPage = (page: string): StudioKind | null => {
  if(["projects","contacts","invoices","templates","discounts","settings","transactions","payment-links"].includes(page)) return page as StudioKind;
  if(page==="contact-forms")return "forms";
  if(page==="inbox")return "messages";
  if(["contracts","questionnaires","quotes"].includes(page))return "documents";
  return null;
};
const typeForPage = (page:string) => page==="contracts"?"contract":page==="quotes"?"quote":page==="questionnaires"?"questionnaire":undefined;
const titleForPage:Record<string,string> = {
  "home":"Home","projects":"Projects","contacts":"Contacts","contact-forms":"Contact Forms",
  "inbox":"Inbox","invoices":"Invoices","payment-links":"Payment Links","transactions":"Transactions",
  "reports":"Reports","session-types":"Session Types","sessions":"Sessions","calendar":"Calendar",
  "booking-site":"Booking Site","discounts":"Discounts","contracts":"Contracts",
  "questionnaires":"Questionnaires","quotes":"Quotes","templates":"Templates","settings":"Settings",
};

export function StudioManager({ page: requestedPage = "home", projectId, sessionTypeId }: { page?: string; projectId?: string; sessionTypeId?: string }) {
  const router=useRouter();
  const page = allPages.includes(requestedPage) ? requestedPage : "home";
  const [records, setRecords] = useState<RecordMap>({});
  const [overview,setOverview]=useState<StudioOverview|null>(null);
  const [bookings,setBookings]=useState<StudioBookings|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [mobileOpen,setMobileOpen]=useState(false);
  const [navOpen,setNavOpen]=useState<string[]>([]);
  const [editor,setEditor]=useState<EditorState|null>(null);
  const [contractDesigner,setContractDesigner]=useState<{
    initial:StudioRecord|null;
    project:StudioRecord|null;
    client:StudioRecord|null;
    asTemplate:boolean;
  }|null>(null);
  const [designer,setDesigner]=useState<{kind:"forms"|"invoices";initial:StudioRecord|null;defaults?:{contactId?:string;projectId?:string}}|null>(null);
  const [documentDesigner,setDocumentDesigner]=useState<{
    kind:"questionnaire"|"quote";initial:StudioRecord|null;
    defaults?:{contactId?:string;projectId?:string;email?:string};
    contextClient?:StudioRecord|null;
  }|null>(null);
  const [emailComposer,setEmailComposer]=useState<{contactId?:string;email?:string;projectId?:string;template?:StudioRecord|null}|null>(null);
  const [templateToUse,setTemplateToUse]=useState<StudioRecord|null>(null);
  const [paymentLinkDesigner,setPaymentLinkDesigner]=useState<StudioRecord|"new"|null>(null);
  const [projectPayments,setProjectPayments]=useState<StudioProjectPayment[]>([]);
  const [financialReport,setFinancialReport]=useState<StudioFinancialReport|null>(null);
  const [search,setSearch]=useState("");
  const [tab,setTab]=useState("");
  const [projectView,setProjectView]=useState<"board"|"list"|"archived">("board");
  const [stagePrompt,setStagePrompt]=useState(false);
  const [chosenRecord,setChosenRecord]=useState<StudioRecord|null>(null);
  const [revision,setRevision]=useState(0);

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const kinds=recordKinds(page);
      const wantsBooking=Boolean(sessionTypeId)||["home","session-types","sessions","calendar","booking-site"].includes(page);
      const [lists, home, booking, payments, financial] = await Promise.all([
        Promise.all(kinds.map(async (kind)=>[kind,(await studioList(kind,kind==="projects"?{archived:"all",limit:250}:{limit:250})).items] as const)),
        page==="home"?studioOverview():Promise.resolve(null),
        wantsBooking?studioBookingOverview():Promise.resolve(null),
        page==="projects"?studioProjectPayments():Promise.resolve([] as StudioProjectPayment[]),
        ["home","reports"].includes(page)?studioFinancialReport():Promise.resolve(null),
      ]);
      setRecords(Object.fromEntries(lists) as RecordMap);
      setRevision(v=>v+1);
      if(page==="projects")setProjectPayments(payments);
      if(["home","reports"].includes(page))setFinancialReport(financial);
      if(page==="home")setOverview(home);
      if(wantsBooking)setBookings(booking);
    }catch(err){setError(err instanceof Error?err.message:"Studio Manager could not load");}
    finally{setLoading(false);}
  },[page,sessionTypeId]);
  // Refresh server-owned records when the selected page or nested session editor route changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void refresh();},[refresh]);
  // Clear page-specific state when the route changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{setSearch("");setTab("");setProjectView("board");setChosenRecord(null);setEditor(null);setDesigner(null);setContractDesigner(null);setDocumentDesigner(null);setEmailComposer(null);setTemplateToUse(null);},[page]);
  const notify=(message:string)=>toast.success(message);
  const openEditor=(item:StudioRecord|null,kind:StudioKind,subtype?:string,
    defaults?:{contactId?:string;projectId?:string;email?:string},
    context?:{project?:StudioRecord|null;client?:StudioRecord|null})=>{
    if(kind==="payment-links"){setPaymentLinkDesigner(item||"new");return;}
    if((kind==="documents"||kind==="templates")&&(subtype==="contract"||item?.type==="contract")){
      const project=context?.project||array(records,"projects").find(x=>x._id===(item?.projectId||defaults?.projectId))||null;
      const client=context?.client||array(records,"contacts").find(x=>x._id===(item?.contactId||defaults?.contactId||project?.contactId))||null;
      setContractDesigner({initial:item,project,client,asTemplate:kind==="templates"});
      return;
    }
    if(kind==="documents"&&
        ["quote","questionnaire"].includes(subtype||item?.type||"")){
      setDocumentDesigner({
        kind:(subtype||item?.type) as "quote"|"questionnaire",
        initial:item,
        defaults:{
          contactId:item?.contactId||defaults?.contactId||context?.client?._id||"",
          projectId:item?.projectId||defaults?.projectId||context?.project?._id||"",
          email:item?.email||defaults?.email||context?.client?.email||"",
        },
        contextClient:context?.client||null,
      });
      return;
    }
    if(kind==="forms"||kind==="invoices"){setDesigner({kind,initial:item,defaults});return;}
    setEditor({kind,subtype,initial:item,defaults});
  };
  const updateRecord=async (kind:StudioKind,item:StudioRecord,patch:Record<string,unknown>,message="Updated")=>{
    try{await studioUpdate(kind,item._id,patch);notify(message);await refresh();}
    catch(e){toast.error(e instanceof Error?e.message:"Update failed");}
  };
  const save=async(payload:Record<string,unknown>)=>{
    if(!editor)return;
    if(editor.initial)await studioUpdate(editor.kind,editor.initial._id,payload);
    else await studioCreate(editor.kind,payload);
    setEditor(null);notify(editor.initial?"Changes saved":"Created successfully");await refresh();
  };
  const deleteRecord=async(kind:StudioKind,item:StudioRecord)=>{
    if(!window.confirm("Delete "+item.title+"? This cannot be undone."))return;
    try{await studioDelete(kind,item._id);notify("Deleted");await refresh();}
    catch(e){toast.error(e instanceof Error?e.message:"Unable to delete");}
  };
  const send=async(item:StudioRecord)=>{
    try{
      const result=item.kind==="invoices"?await studioSendInvoice(item._id):await studioSendContract(item._id);
      notify(result.emailSent?"Email sent to client":"Record ready");
      await refresh();
    }catch(e){toast.error(e instanceof Error?e.message:"Could not send email");}
  };
  const pay=async(item:StudioRecord)=>{
    const method=window.prompt("How was this invoice paid? (e.g. bank transfer, cash, bKash)", "Bank transfer");
    if(!method)return;
    if(!window.confirm("Confirm you have actually received "+money(item.amount,item.currency)+"?"))return;
    try{await studioRecordPayment(item._id,method);notify("Payment recorded");await refresh();}
    catch(e){toast.error(e instanceof Error?e.message:"Could not record payment");}
  };
  const useTemplate=(item:StudioRecord)=>{
    if(item.type==="email")setEmailComposer({template:item});
    else setTemplateToUse(item);
  };
  const linkFor=(item:StudioRecord)=>{
    const path=item.kind==="forms"?"form":item.kind==="invoices"?"invoice":item.kind==="documents"?item.type:item.kind==="payment-links"?"payment":"";
    return path&&item.token?window.location.origin+"/studio/"+path+"/"+encodeURIComponent(item.token):"";
  };
  const copy=async(item:StudioRecord)=>{
    if(["forms","documents","invoices"].includes(item.kind)){
      try{
        const {url,preview}=await studioShareUrl(item.kind as "forms"|"documents"|"invoices",item._id);
        await navigator.clipboard.writeText(url);
        notify(preview?"Read-only draft preview link copied":"Client link copied");
      }catch(e){toast.error(e instanceof Error?e.message:"Unable to copy the studio link");}
      return;
    }
    let url=linkFor(item);
    if(item.kind==="payment-links"&&item.details?.siteSlug&&item.details?.slug){
      try{
        const sites=await studioPaymentLinkSites();
        if(sites.rootDomain!=="localhost"&&
          sites.sites.some(s=>s.slug===item.details.siteSlug)){
          url="https://"+item.details.siteSlug+"."+sites.rootDomain+"/payment/"+item.details.slug;
        }
      }catch{ /* Keep the token link as a fallback. */ }
    }
    if(!url)return;
    await navigator.clipboard.writeText(url);
    notify("Shareable link copied");
  };
  const previewRecord=(item:StudioRecord)=>{
    if(!["forms","invoices","documents"].includes(item.kind))return;
    void previewStudioPublicDraft(item.kind as "forms"|"invoices"|"documents",
      async()=>item).catch(e=>toast.error(e instanceof Error?e.message:"Cannot open public preview"));
  };
  const activeParent=nav.find((n)=>n.page===page||(n.children&&n.children.some((child)=>child.page===page)));
  const isActive=(pageName:string)=>page===pageName;
  return (
    <main className="min-h-screen bg-white font-sans text-[#221f29] antialiased">
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[#eeeaf0] bg-white px-5 md:hidden">
        <button onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu className="size-5"/></button>
        <ProductSwitcher compact/>
        <Link href="/dashboard/overview" aria-label="Dashboard"><LayoutGrid className="size-5"/></Link>
      </div>
      {mobileOpen&&<button className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-label="Close sidebar" onClick={()=>setMobileOpen(false)}/>}
      <aside className={"fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-[#eceaf0] bg-white transition-transform md:translate-x-0 "+(mobileOpen?"translate-x-0":"-translate-x-full")}>
        <div className="flex h-16 items-center gap-2 border-b border-[#f2f0f4] px-5">
          <span className="grid size-8 place-items-center rounded-full bg-[#6337d8] text-white"><SquareStack className="size-4"/></span>
          <div className="min-w-0 flex-1"><ProductSwitcher onNavigate={()=>setMobileOpen(false)}/></div>
          <Link href="/dashboard/overview" title="All products"><LayoutGrid className="size-4 text-[#999]"/></Link>
          <button className="md:hidden" aria-label="Close" onClick={()=>setMobileOpen(false)}><X className="size-4"/></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-8 pt-5 text-sm" aria-label="Studio Manager navigation">
          {nav.map((n,i)=>{
            const hasChildren=Boolean(n.children);
            const selected=Boolean(n.page===page||(n.children&&n.children.some((x)=>x.page===page)));
            const expanded=navOpen.includes(n.label);
            const NavIcon=n.icon;
            return <div key={n.label} className={i===4?"mt-6":""}>
              {i===4&&<p className="mb-4 px-3 text-xs text-[#a29ea6]">Tools</p>}
              <div className={"flex items-center rounded-md "+(selected?"bg-[#f8f5ff]":"")}>
                {hasChildren?<button type="button" aria-expanded={expanded} aria-controls={"studio-nav-"+n.page}
                  title={expanded?"Collapse "+n.label:"Expand "+n.label}
                  onClick={()=>setNavOpen(old=>old.includes(n.label)?[]:[n.label])}
                  className={"flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[13px] transition "+(selected?"font-semibold text-[#6239c9] hover:bg-[#f3efff]":"text-[#39363e] hover:bg-[#f8f7fa]")}>
                  <NavIcon className="size-[17px]"/><span className="flex-1">{n.label}</span><ChevronDown className={"size-3 transition-transform "+(expanded?"rotate-180":"")}/>
                </button>:<Link href={BASE+"/"+n.page} onClick={()=>setMobileOpen(false)}
                  className={"flex h-11 flex-1 items-center gap-3 rounded-md px-3 text-[13px] "+(selected?"font-semibold text-[#6239c9]":"text-[#39363e] hover:bg-[#f8f7fa]")}>
                  <NavIcon className="size-[17px]"/><span>{n.label}</span></Link>}
              </div>
              {hasChildren&&expanded&&<div id={"studio-nav-"+n.page} className="ml-5 border-l border-[#eeeaf0] pl-2">
                {n.children?.map((sub)=>{const Icon=sub.icon;return <Link key={sub.page} href={BASE+"/"+sub.page} onClick={()=>setMobileOpen(false)}
                  className={"flex h-10 items-center gap-3 px-3 text-[12px] "+(isActive(sub.page)?"bg-[#f5f2ff] font-semibold text-[#5c32c5]":"text-[#77737f] hover:bg-[#faf9fc]")}>
                  <Icon className="size-4"/>{sub.label}</Link>})}
              </div>}
            </div>;
          })}
        </nav>
        <div className="border-t border-[#f0edf3] p-4">
          <Link href="/dashboard/client-gallery/collections" className="flex items-center gap-3 text-xs font-semibold text-[#777] hover:text-[#6337d8]"><ArrowLeft className="size-4"/> Back to Client Gallery</Link>
        </div>
      </aside>
      <section className="min-h-screen pt-14 md:ml-[260px] md:pt-0">
        {!projectId&&<header className="flex h-16 items-center justify-end gap-6 border-b border-[#faf9fc] px-6 text-xs text-[#8b8691] lg:px-12">
          <span className="mr-auto hidden font-medium text-[#96919d] sm:inline">Gallerista / Studio Manager / <span className="text-[#423c4c]">{titleForPage[page]}</span></span>
          <Link href="/dashboard/client-gallery/account" aria-label="Account"><span className="grid size-8 place-items-center rounded-full bg-[#eee8ff] font-bold text-[#6337d8]">G</span></Link>
        </header>}
        <div className={"mx-auto px-5 sm:px-8 "+(page==="projects"&&!projectId&&projectView!=="board"?"w-full max-w-none lg:px-8":"max-w-[1580px] lg:px-12")+" "+(projectId?"py-7 lg:py-8":"py-8 lg:py-10")}>
          {loading && <div className="mb-5 inline-flex items-center gap-2 text-xs text-[#888]"><Loader2 className="size-3 animate-spin"/> Updating Studio Manager…</div>}
          {error&&<div role="alert" className="mb-6 flex items-start justify-between gap-4 bg-red-50 px-5 py-4 text-sm text-red-700"><span>{error}</span><button onClick={()=>void refresh()} className="font-semibold underline">Retry</button></div>}
          {page==="home"&&<HomePage overview={overview} bookings={bookings} records={records} financial={financialReport}/>}
          {page==="reports"&&<ReportsPage financial={financialReport}/>}
          {["session-types","sessions","calendar","booking-site"].includes(page)&&
            <StudioBookingsPage page={page} data={bookings} refresh={refresh} notify={notify} sessionTypeId={sessionTypeId}/>}
          {page==="projects"&&projectId==="new"&&<StudioProjectCreate onCreated={async project=>{
            await refresh();
            router.push(BASE+"/projects/"+encodeURIComponent(project._id));
          }}/>}
          {page==="projects"&&projectId&&projectId!=="new"&&<StudioProjectDetail projectId={projectId} revision={revision}
            projectStages={Array.isArray(array(records,"settings")[0]?.details?.projectStages)?
              array(records,"settings")[0].details.projectStages:undefined}
            projectStageColors={array(records,"settings")[0]?.details?.projectStageColors}
            projectStageLabels={array(records,"settings")[0]?.details?.projectStageLabels}
            onEditProject={project=>openEditor(project,"projects")}
            onNewDocument={(type,project,client)=>{
              const defaults={projectId:project._id,contactId:project.contactId||"",email:client?.email||""};
              if(type==="invoice")openEditor(null,"invoices",undefined,defaults);
              else openEditor(null,"documents",type,defaults,{project,client});
            }}
            onOpenDocument={document=>document.kind==="invoices"?openEditor(document,"invoices"):
              ["contract","quote","questionnaire"].includes(document.type)?openEditor(document,"documents",document.type):
                setChosenRecord(document)}
            onCompose={(project,client)=>setEmailComposer({contactId:project.contactId||"",projectId:project._id,email:client?.email||""})}
          />}
          {recordPage(page)&&!(page==="projects"&&projectId)&&<RecordsPage
            page={page} records={records} search={search} setSearch={setSearch} tab={tab} setTab={setTab}
            view={projectView} setView={setProjectView} open={openEditor}
            revision={revision}
            onCreateProject={()=>router.push(BASE+"/projects/new")}
            onDelete={deleteRecord} onUpdate={updateRecord} onSend={send} onPay={pay} onCopy={copy} onPreview={previewRecord} loading={loading}
            choose={(item)=>item.kind==="projects"?router.push(BASE+"/projects/"+encodeURIComponent(item._id)):
              item.kind==="forms"||item.kind==="invoices"||
                (item.kind==="documents"&&["contract","quote","questionnaire"].includes(item.type))||
                (item.kind==="templates"&&item.type==="contract")?
                openEditor(item,item.kind):setChosenRecord(item)} notify={notify} refresh={refresh} onUseTemplate={useTemplate}
            projectPayments={projectPayments}
            onCompose={(item)=>setEmailComposer(item?{contactId:item.kind==="contacts"?item._id:item.contactId,email:item.email||"",projectId:item.projectId||""}:{})}
          />}
        </div>
      </section>
      {editor?.kind==="projects"&&editor.initial&&<StudioProjectSheet project={editor.initial}
        contacts={array(records,"contacts")} onClose={()=>setEditor(null)} onSaved={save}/>}
      {editor&&editor.kind!=="projects"&&<StudioEditor kind={editor.kind} subtype={editor.subtype} initial={editor.initial} defaults={editor.defaults} contacts={array(records,"contacts")} projects={array(records,"projects")} onSave={save} onClose={()=>setEditor(null)}/>}
      {contractDesigner&&<StudioContractEditor initial={contractDesigner.initial}
        project={contractDesigner.project} client={contractDesigner.client}
        asTemplate={contractDesigner.asTemplate}
        contacts={array(records,"contacts")} projects={array(records,"projects")}
        studio={array(records,"settings")[0]||null}
        onClose={()=>{setContractDesigner(null);void refresh();}}
        onSaved={async()=>{await refresh();}}/>}
      {documentDesigner&&<StudioDocumentDesigner
        kind={documentDesigner.kind} initial={documentDesigner.initial}
        contextClient={documentDesigner.contextClient}
        defaultContactId={documentDesigner.defaults?.contactId}
        defaultProjectId={documentDesigner.defaults?.projectId}
        defaultEmail={documentDesigner.defaults?.email}
        contacts={array(records,"contacts")} projects={array(records,"projects")}
        onClose={()=>{setDocumentDesigner(null);void refresh();}}
        onSaved={refresh}/>}
      {designer?.kind==="forms"&&<StudioFormDesigner initial={designer.initial} onClose={()=>setDesigner(null)} onSaved={refresh}/>}
      {designer?.kind==="invoices"&&<StudioInvoiceDesigner initial={designer.initial} defaultContactId={designer.defaults?.contactId} defaultProjectId={designer.defaults?.projectId} contacts={array(records,"contacts")} projects={array(records,"projects")} onClose={()=>setDesigner(null)} onSaved={refresh}/>}
      {emailComposer&&<StudioEmailComposer contacts={array(records,"contacts")} projects={array(records,"projects")} initialContactId={emailComposer.contactId} initialEmail={emailComposer.email} initialProjectId={emailComposer.projectId} initialTemplate={emailComposer.template} onClose={()=>setEmailComposer(null)} onSent={async()=>{setEmailComposer(null);await refresh();}}/>}
      {templateToUse&&<StudioTemplateUseDialog template={templateToUse} contacts={array(records,"contacts")} projects={array(records,"projects")} onClose={()=>setTemplateToUse(null)} onCreated={async(record)=>{setTemplateToUse(null);await refresh();openEditor(record,record.kind);}}/>}
      {paymentLinkDesigner!==null&&<StudioPaymentLinkEditor
        initial={paymentLinkDesigner==="new"?null:paymentLinkDesigner}
        onClose={()=>setPaymentLinkDesigner(null)}
        onSaved={async()=>{setPaymentLinkDesigner(null);await refresh();}}/>}
      {chosenRecord&&<RecordDetail record={chosenRecord} onClose={()=>setChosenRecord(null)} onEdit={()=>{openEditor(chosenRecord,chosenRecord.kind);setChosenRecord(null);}} onSend={()=>void send(chosenRecord)} onCopy={()=>void copy(chosenRecord)} onCompose={()=>{setEmailComposer({contactId:chosenRecord.kind==="contacts"?chosenRecord._id:chosenRecord.contactId,email:chosenRecord.email||""});setChosenRecord(null);}}/>}
    </main>
  );
}

function HomePage({ overview, bookings, records, financial }: { overview:StudioOverview|null; bookings:StudioBookings|null; records:RecordMap; financial:StudioFinancialReport|null }) {
  const [now] = useState(Date.now);
  const hour=new Date(now).getHours();
  const greeting=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const [selectedCurrency,setSelectedCurrency]=useState("EUR");
  const currency=financial?.currencies.find(x=>x.currency===selectedCurrency)||financial?.currencies[0]||null;
  const currencyLabel=currency?.currency||selectedCurrency;
  const months=Array.from({length:6},(_,index)=>{
    const date=new Date();date.setDate(1);date.setMonth(date.getMonth()-(5-index));
    const key=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");
    const value=currency?.monthly.find(x=>x.month===key)?.amount||0;
    return {key:date.toLocaleDateString(undefined,{month:"short"}),value};
  });
  const max=Math.max(1,...months.map(x=>x.value));
  const upcoming=(bookings?.events||[]).filter(x=>new Date(x.startAt).getTime()>now&&x.status!=="cancelled").slice(0,4);
  return <div>
    <h1 className="text-3xl font-medium tracking-tight">{greeting}</h1>
    <p className="mt-1 text-sm text-[#99939e]">{new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
    <div className="mt-14 grid gap-12 xl:grid-cols-[minmax(0,1.7fr)_350px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-[15px] font-medium">Payments</h2>
          <div className="flex items-center gap-3">{financial&&financial.currencies.length>1&&<select aria-label="Revenue currency" className="h-9 border border-[#eee] px-3 text-xs" value={currencyLabel} onChange={e=>setSelectedCurrency(e.target.value)}>{financial.currencies.map(x=><option key={x.currency}>{x.currency}</option>)}</select>}
          <Link className="text-xs font-semibold text-[#6337d8]" href={BASE+"/reports"}>View report <ArrowRight className="inline size-3"/></Link></div></div>
        <div className="mt-5 border-y border-[#efedf1] py-6">
          <div className="mb-7 flex flex-wrap gap-10"><div><p className={SMALL_HEADING}>Paid revenue</p><p className="mt-2 text-2xl font-medium">{money(currency?.paid||0,currencyLabel)}</p></div>
            <div><p className={SMALL_HEADING}>Invoices ({currencyLabel})</p><p className="mt-2 text-2xl font-medium">{currency?.invoiceCount||0}</p></div>
            <div><p className={SMALL_HEADING}>Projects</p><p className="mt-2 text-2xl font-medium">{overview?.counts?.projects||0}</p></div></div>
          <div className="grid h-44 grid-cols-6 items-end gap-5 border-b border-[#eeeaf2]">
            {months.map((month)=><div key={month.key} className="flex h-full flex-col justify-end text-center">
              <div className="mx-auto w-full max-w-12 bg-[#bfaaf7] transition-all" style={{height:Math.max(2,month.value/max*90)+"%"}} title={money(month.value)} />
              <span className="mt-3 -mb-5 text-[11px] text-[#a29eaa]">{month.key}</span></div>)}
          </div>
          {!currency?.paidCount&&<p className="mt-10 text-center text-sm text-[#999]">No payments yet. Record a paid invoice to see your revenue.</p>}
        </div>
        <h2 className="mt-14 border-b border-[#eee] pb-4 text-[15px] font-medium">Recent Projects</h2>
        {overview?.recentProjects?.length ? <div>{overview.recentProjects.map((p)=><Link href={BASE+"/projects"} key={p._id} className="flex items-center justify-between gap-2 border-b border-[#eee] py-4 text-sm">
          <span className="font-semibold">{p.title}</span><span className={badge(p.status)}>{nice(p.status)}</span></Link>)}</div> :
          <div className="py-14 text-center"><Folder className="mx-auto size-10 text-[#bfb1e9]"/><p className="mt-3 text-sm text-[#8c8793]">No projects yet</p><Link href={BASE+"/projects"} className="mt-3 inline-block text-xs font-semibold text-[#6337d8]">Create your first project</Link></div>}
        <h2 className="mt-10 border-b border-[#eee] pb-4 text-[15px] font-medium">Upcoming Sessions</h2>
        {upcoming.length ? upcoming.map((s)=><div key={s._id} className="flex justify-between gap-3 border-b py-4 text-sm"><span>{s.title}</span><span className="text-[#888]">{dateLabel(s.startAt)}</span></div>) :
          <div className="py-12 text-center text-sm text-[#9a95a0]">No upcoming sessions. <Link href={BASE+"/sessions"} className="font-medium text-[#6337d8]">Schedule one</Link></div>}
      </div>
      <aside className="space-y-5"><p className="text-[15px] font-medium">Get Started with Studio Manager</p>
        {[
          {title:"Send invoices & contracts",desc:"Manage projects with professional invoices, questionnaires and contracts.",href:"invoices",icon:FileText},
          {title:"Automate client booking",desc:"Create a booking page with session types and availability.",href:"session-types",icon:CalendarDays},
          {title:"Organize client relationships",desc:"Keep track of inquiries, leads, and all your studio contacts.",href:"contacts",icon:Users},
        ].map((c)=><Link key={c.href} href={BASE+"/"+c.href} className="block border border-[#f0edf5] bg-[#faf9fc] p-6 transition hover:border-[#c8b5f3]">
          <div className="grid h-24 place-items-center bg-gradient-to-br from-[#f2edff] to-[#f8f7fb] text-[#6337d8]"><c.icon className="size-11 stroke-[1.4]"/></div>
          <h3 className="mt-5 text-[14px] font-semibold">{c.title}</h3><p className="mt-2 text-xs leading-6 text-[#8e8994]">{c.desc}</p>
          <p className="mt-5 text-xs font-semibold text-[#6337d8]">Set up now <ArrowRight className="inline size-3"/></p></Link>)}
      </aside>
    </div>
  </div>;
}

function ReportsPage({financial}:{financial:StudioFinancialReport|null}) {
  const [selectedCurrency,setSelectedCurrency]=useState("EUR");
  const row=financial?.currencies.find(x=>x.currency===selectedCurrency)||financial?.currencies[0]||null;
  const currency=row?.currency||selectedCurrency;
  const monthly=Array.from({length:6},(_,index)=>{
    const day=new Date();day.setDate(1);day.setMonth(day.getMonth()+index-5);
    const month=day.getFullYear()+"-"+String(day.getMonth()+1).padStart(2,"0");
    return {label:day.toLocaleDateString(undefined,{month:"short",year:"2-digit"}),amount:row?.monthly.find(x=>x.month===month)?.amount||0};
  });
  const max=Math.max(1,...monthly.map(x=>x.amount));
  const transactions=(financial?.recentTransactions||[]).filter(x=>x.currency===currency);
  return <section className="min-h-[75vh]">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-medium">Reports</h1><p className="mt-2 text-sm text-[#888]">Revenue and outstanding invoices, calculated from your studio’s records.</p></div>
      <label className="flex items-center gap-3 text-xs font-medium">Currency
        <select className="h-10 border border-[#e8e3ee] bg-white px-4 text-xs" value={currency} onChange={e=>setSelectedCurrency(e.target.value)}>
          {(financial?.currencies.length?financial.currencies:[{currency:"EUR"}]).map(x=><option key={x.currency}>{x.currency}</option>)}
        </select>
      </label>
    </div>
    <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Total received",money(row?.paid||0,currency)],
        ["Outstanding invoices",money(row?.unpaid||0,currency)],
        ["Overdue amount",money(row?.overdue||0,currency)],
        ["Paid invoices",String(row?.paidCount||0)],
      ].map(([label,value])=><div className="border border-[#eae8ee] bg-white p-6" key={label}>
        <p className={SMALL_HEADING}>{label}</p>
        <p className="mt-3 text-xl font-medium">{value}</p>
      </div>)}
    </div>
    <div className="mt-11 border border-[#ebe8ef] bg-white p-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium">Paid invoices — last six months</h2><span className="text-xs text-[#888]">{currency}</span></div>
      <div className="mt-10 grid h-56 grid-cols-6 items-end gap-5 border-b border-[#ede9ef]">
        {monthly.map(x=><div key={x.label} className="flex h-full flex-col justify-end" title={money(x.amount,currency)}>
          <div className="mx-auto w-full max-w-20 bg-[#896ae3]" style={{height:Math.max(2,x.amount/max*85)+"%"}}/>
          <p className="relative top-6 text-center text-xs text-[#888]">{x.label}</p>
        </div>)}
      </div>
      {!row?.paidCount&&<p className="mt-11 text-center text-sm text-[#98929d]">No completed payments in this currency yet.</p>}
    </div>
    <h2 className="mt-16 text-lg font-medium">Recent recorded transactions</h2>
    <p className="mt-2 text-xs text-[#999]">The last 20 manual payment entries are shown here.</p>
    <div className="mt-5">{transactions.length ? transactions.map(x=><div key={x._id} className="flex flex-wrap items-center justify-between gap-2 border-b py-4 text-sm">
      <div><strong>{x.title}</strong><p className="mt-1 text-xs text-[#999]">{dateLabel(x.createdAt)} · {x.details?.method||"Manual"}</p></div>
      <span className="font-semibold">{money(x.amount,x.currency)}</span>
    </div>):<div className="border-y py-14 text-center text-sm text-[#999]">No recorded transactions yet.</div>}</div>
  </section>;
}

type RecordProps = {
  page:string; records:RecordMap; search:string; setSearch:(v:string)=>void; tab:string; setTab:(v:string)=>void;
  view:"board"|"list"|"archived";setView:(v:"board"|"list"|"archived")=>void;
  open:(initial:StudioRecord|null,kind:StudioKind,subtype?:string)=>void;
  onCreateProject:()=>void;
  onDelete:(kind:StudioKind,record:StudioRecord)=>Promise<void>;
  onUpdate:(kind:StudioKind,record:StudioRecord,patch:Record<string,unknown>,message?:string)=>Promise<void>;
  onSend:(record:StudioRecord)=>Promise<void>;
  onPay:(record:StudioRecord)=>Promise<void>;
  onCopy:(record:StudioRecord)=>Promise<void>;
  onPreview:(record:StudioRecord)=>void;
  choose:(record:StudioRecord)=>void;
  loading:boolean;notify:(message:string)=>void;refresh:()=>Promise<void>;
  onUseTemplate:(record:StudioRecord)=>void;
  onCompose:(record:StudioRecord|null)=>void;
  projectPayments:StudioProjectPayment[];
  revision:number;
};
function RecordsPage(props:RecordProps) {
  const [now] = useState(Date.now);
  const {page,records,search,setSearch,tab,setTab,view,setView,open,onCreateProject,onDelete,onUpdate,onSend,onPay,onCopy,onPreview,choose,loading,notify,onUseTemplate,onCompose,projectPayments,revision}=props;
  const kind=recordPage(page)!;
  const all=array(records,kind);
  const selectedType=typeForPage(page);
  const typed=selectedType?all.filter(x=>x.type===selectedType):all;
  const projects=page==="projects";
  const invoice=page==="invoices";
  const contacts=page==="contacts";
  const templates=page==="templates";
  const messages=page==="inbox";
  const settings=page==="settings";
  const transactions=page==="transactions";
  const forms=page==="contact-forms";
  const readonly=messages||transactions;
  const [sort,setSort]=useState<"newest"|"oldest">("newest");
  const [projectType,setProjectType]=useState("all");
  const [invoiceCurrency,setInvoiceCurrency]=useState("EUR");
  const [invoicePeriod,setInvoicePeriod]=useState("all");
  const [contactActionsOpen,setContactActionsOpen]=useState(false);
  const [exportBusy,setExportBusy]=useState(false);
  const [templateType,setTemplateType]=useState("contract");
  const [stageModal,setStageModal]=useState(false);
  const [pageNumber,setPageNumber]=useState(1);
  const [pageSize,setPageSize]=useState(20);
  const [pagedProjects,setPagedProjects]=useState<StudioList|null>(null);
  const [listBusy,setListBusy]=useState(false);
  const [listError,setListError]=useState("");
  const [menuPosition,setMenuPosition]=useState({left:8,top:8});
  useEffect(()=>{
    // Changing filters starts a fresh page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageNumber(1);
  },[search,projectType,view,sort,pageSize]);
  useEffect(()=>{
    if(!projects||view==="board")return;
    let live=true;
    const timer=window.setTimeout(()=>{
      setListBusy(true);setListError("");
      void studioList("projects",{
        archived:view==="archived"?"true":"false",
        page:pageNumber,limit:pageSize,search:search.trim(),
        ...(projectType!=="all"?{type:projectType}:{}),
        sort,
      }).then(result=>{
        if(!live)return;
        setPagedProjects(result);
        if(result.total>0&&pageNumber>Math.ceil(result.total/pageSize))setPageNumber(Math.ceil(result.total/pageSize));
      }).catch(err=>{
        if(live)setListError(err instanceof Error?err.message:"Could not load project list");
      }).finally(()=>{if(live)setListBusy(false)});
    },search?180:0);
    return ()=>{live=false;window.clearTimeout(timer);};
  },[projects,view,pageNumber,pageSize,search,projectType,sort,revision]);
  const tabs=projects?["Board View","List View","Archived"]:
    contacts?["All Contacts","Clients","Leads","Other"]:
    invoice?["All Invoices","Draft","Upcoming","Past Due","Paid","Canceled"]:
    transactions?["All Payments","Paid","Refunded"]:
    templates?["Contracts","Invoices","Questionnaires","Quotes","Emails"]:
    page==="contracts"?["All Contracts","Draft","In Progress","Completed","Canceled"]:
    page==="contact-forms"?["All Forms","Draft","Published"]:
    page==="sessions"?["All Sessions","Upcoming","Inquiry","Past"]:
    page==="inbox"?["All Messages","Unread","Read","Sent"]:
    [];
  const effectiveTab=tab||tabs[0]||"";
  const invoiceCurrencies=Array.from(new Set(["EUR",...all.map(x=>x.currency||"EUR")])).sort((a,b)=>a==="EUR"?-1:b==="EUR"?1:a.localeCompare(b));
  const activeCurrency=invoiceCurrencies.includes(invoiceCurrency)?invoiceCurrency:invoiceCurrencies[0]||"EUR";
  const withinPeriod=(record:StudioRecord)=>{
    if(invoicePeriod==="all")return true;
    const current=new Date(now);
    const created=new Date(record.createdAt);
    if(invoicePeriod==="this-month")return created.getFullYear()===current.getFullYear()&&created.getMonth()===current.getMonth();
    return created.getTime()>now-90*86400000;
  };
  const filtered=(projects&&view!=="board"?(pagedProjects?.items||[]):typed).filter((x)=>{
    const label=(x.title+" "+x.email+" "+x.description+" "+x.type).toLowerCase();
    if(search&&!(projects&&view!=="board")&&
      !(label+" "+x.status).includes(search.toLowerCase()))return false;
    if(projects&&projectType!=="all"&&x.type!==projectType)return false;
    if(invoice&&(!withinPeriod(x)||x.currency!==activeCurrency))return false;
    if(projects){
      if(view==="archived"&&!x.archived)return false;
      if(view!=="archived"&&x.archived)return false;
      // Board View and List View are presentation modes, never project statuses.
      // Previously every new Inquiry project was incorrectly filtered out as
      // status "board-view" / "list-view" and looked missing after creation.
      return true;
    }
    if(!effectiveTab||effectiveTab.startsWith("All")||tabs.length===0)return true;
    if(contacts)return x.status===effectiveTab.toLowerCase().replace(/s$/,"");
    if(templates)return x.type===effectiveTab.toLowerCase().replace(/s$/,"");
    if(transactions)return effectiveTab==="All Payments"?["paid","refunded"].includes(x.status):
      x.status===effectiveTab.toLowerCase();
    if(invoice){
      if(effectiveTab==="Upcoming")return x.status==="sent"&&(!x.dueDate||new Date(x.dueDate).getTime()>=now);
      if(effectiveTab==="Past Due")return x.status!=="paid"&&x.status!=="cancelled"&&Boolean(x.dueDate)&&new Date(x.dueDate!).getTime()<now;
      return x.status===effectiveTab.toLowerCase().replace("canceled","cancelled");
    }
    return x.status===effectiveTab.toLowerCase().replaceAll(" ","-").replace("canceled","cancelled");
  }).sort((a,b)=>projects&&view!=="board"?0:
    sort==="newest"?new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime():
      new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime());
  const invoicesForSummary=invoice?all.filter(x=>x.currency===activeCurrency&&withinPeriod(x)):[];
  const pending=invoice?invoicesForSummary.filter(x=>x.status==="sent"&&x.dueDate&&new Date(x.dueDate).getTime()>=now).reduce((s,x)=>s+x.amount,0):0;
  const overdue=invoice?invoicesForSummary.filter(x=>!["paid","cancelled"].includes(x.status)&&x.dueDate&&new Date(x.dueDate).getTime()<now).reduce((s,x)=>s+x.amount,0):0;
  const paid=invoice?invoicesForSummary.filter(x=>x.status==="paid").reduce((s,x)=>s+x.amount,0):0;
  const settingsItem=settings?all[0]:array(records,"settings")[0]||null;
  const paymentForProject=(item:StudioRecord)=>{
    const paid=projectPayments.filter(x=>x.projectId===item._id);
    return paid.length?paid.map(x=>money(x.amount,x.currency)).join(" · "):"EUR 0.00";
  };
  const stages=Array.from(new Set([
    ...((array(records,"settings")[0]?.details?.projectStages||stagesDefault) as string[]),
    ...(projects?all.map(item=>item.status).filter(Boolean):[]),
  ]));
  const stageColors=(settingsItem?.details?.projectStageColors||{}) as Record<string,string>;
  const stageLabels=(settingsItem?.details?.projectStageLabels||{}) as Record<string,string>;
  const stageTitle=(stage:string)=>stageLabels[stage]||nice(stage);
  const stageStyle=(stage:string)=>{
    const raw=stageColors[stage];
    const color=raw&&/^#[0-9a-f]{6}$/i.test(raw)?raw:null;
    return color?{backgroundColor:color+"1A",color}:undefined;
  };
  const newLabel=kind==="contacts"?"New Contact":kind==="forms"?"New Contact Form":kind==="invoices"?"New Invoice":
    kind==="projects"?"New Project":kind==="documents"?"New "+nice(page.slice(0,-1)):kind==="templates"?"New Template":kind==="payment-links"?"New Payment Link":kind==="discounts"?"New Discount":"New";
  const header=page==="inbox"?"Inbox":titleForPage[page]||nice(page);
  const [showActions,setShowActions]=useState<string|null>(null);
  useEffect(()=>{
    if(!showActions)return;
    const close=()=>setShowActions(null);
    window.addEventListener("scroll",close,true);
    window.addEventListener("resize",close);
    return ()=>{window.removeEventListener("scroll",close,true);window.removeEventListener("resize",close);};
  },[showActions]);
  const exportContacts=async()=>{
    setExportBusy(true);
    try {
    const firstPage=await studioList("contacts",{page:1,limit:250});
    const contactsToExport=[...firstPage.items];
    for(let page=2;(page-1)*250<firstPage.total;page++){
      if(page>100)throw new Error("Export limit reached. Contact support for a bulk export.");
      const next=await studioList("contacts",{page,limit:250});
      contactsToExport.push(...next.items);
    }
    const cleanCell=(value:unknown)=>{
      let cell=String(value??"");
      if(/^[\s]*[=+\-@]/.test(cell))cell="'"+cell;
      return '"'+cell.replace(/"/g,'""')+'"';
    };
    const rows=[["Name","Type","Email","Phone","Company","Address","City","State","Postcode","Country"],
      ...contactsToExport.map(x=>[x.title,x.status,x.email,x.phone,x.details?.company,x.details?.address,x.details?.city,x.details?.state,x.details?.postcode,x.details?.country])];
    const file=new Blob([rows.map(row=>row.map(cleanCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(file);
    const a=document.createElement("a");a.href=url;a.download="gallerista-contacts.csv";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setContactActionsOpen(false);notify("Exported "+contactsToExport.length+" contacts");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not export contacts");}
    finally{setExportBusy(false);}
  };
  const addStage=async(name:string,color:string)=>{
    const slug=name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40);
    if(!slug||stages.includes(slug))throw new Error("This stage already exists");
    if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error("Choose a valid stage colour");
    const next={
      ...(settingsItem?.details||{}),
      projectStages:[...stages.filter(s=>s!=="cancelled"),slug],
      projectStageColors:{...stageColors,[slug]:color},
      projectStageLabels:{...stageLabels,[slug]:name.trim()},
    };
    if(settingsItem)await studioUpdate("settings",settingsItem._id,{details:next});
    else await studioCreate("settings",{details:next});
    setStageModal(false);notify("Project stage created");await props.refresh();
  };
  const onDrop=async(event:DragEvent,stage:string)=>{
    event.preventDefault();
    const item=all.find(x=>x._id===event.dataTransfer.getData("text/plain"));
    if(item&&item.status!==stage)await onUpdate("projects",item,{status:stage},"Project moved to "+nice(stage));
  };
  return <div className="min-h-[75vh]">
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex items-center gap-7"><h1 className="text-[24px] font-medium tracking-tight">{header}</h1>
        {!["settings","templates"].includes(page)&&<div className="relative hidden md:block">
          <Search className="absolute left-2 top-3 size-4 text-[#aaa]"/><input className="h-10 w-64 border-0 bg-white pl-9 text-xs outline-none placeholder:text-[#aaa]" placeholder="Search email or contact name" value={search} onChange={(e)=>setSearch(e.target.value)}/>
        </div>}
      </div>
      <div className="flex items-center gap-4">
        {invoice&&<Link href={BASE+"/templates"} className="text-xs text-[#777]">View Templates</Link>}
        {projects&&<Link href={BASE+"/settings"} className="text-xs text-[#777]">Project Settings</Link>}
        {contacts&&<div className="relative"><button className={OUTLINE} onClick={()=>setContactActionsOpen(v=>!v)}>Actions <ChevronDown className="size-3"/></button>
          {contactActionsOpen&&<div className="absolute right-0 top-11 z-30 w-40 border border-[#e8e6ea] bg-white p-1 shadow-lg"><button disabled={exportBusy} className="w-full px-3 py-2 text-left text-xs hover:bg-[#f6f3fc] disabled:opacity-50" onClick={()=>void exportContacts()}>{exportBusy?"Exporting…":"Export CSV"}</button></div>}</div>}
        {(contacts||messages)&&<button className={OUTLINE} onClick={()=>onCompose(null)}><Mail className="size-4"/> Compose Email</button>}
        {templates&&<select aria-label="New template type" className="h-10 border border-[#e9e5ed] bg-white px-3 text-xs" value={templateType} onChange={e=>setTemplateType(e.target.value)}>
          <option value="contract">Contract</option><option value="invoice">Invoice</option><option value="questionnaire">Questionnaire</option><option value="quote">Quote</option><option value="email">Email</option>
        </select>}
        {!readonly&&<button onClick={()=>projects?onCreateProject():open(settingsItem||null,kind,selectedType|| (templates?templateType:undefined))} className={BTN+" "+PRIMARY}>
          <Plus className="size-4"/>{settings?"Edit Settings":newLabel}</button>}
      </div>
    </div>
    {!["settings","templates"].includes(page)&&<div className="relative mt-4 md:hidden"><Search className="absolute left-3 top-3 size-4 text-[#aaa]"/><input className="h-10 w-full border px-9 text-sm" placeholder="Search records" value={search} onChange={e=>setSearch(e.target.value)}/></div>}
    {invoice&&<div className="mt-8 flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-wrap gap-12">{[["Paid",paid,"#1c9d7c"],["Upcoming",pending,"#d8ab28"],["Past due",overdue,"#ce4b62"]].map(([label,amount,color])=><div key={String(label)}><p className="flex items-center gap-2 text-xs"><span className="size-2 rounded-full" style={{backgroundColor:String(color)}}/>{label}</p><p className="mt-3 text-xl font-medium">{money(Number(amount),activeCurrency)}</p></div>)}</div>
      <div className="flex gap-3"><select aria-label="Invoice currency" value={activeCurrency} className="h-10 border border-[#ebe8ef] px-3 text-xs" onChange={e=>setInvoiceCurrency(e.target.value)}>{(invoiceCurrencies.length?invoiceCurrencies:["EUR"]).map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Invoice time range" className="h-10 border border-[#ebe8ef] px-3 text-xs" value={invoicePeriod} onChange={e=>setInvoicePeriod(e.target.value)}><option value="all">All time</option><option value="this-month">This month</option><option value="last-90">Last 90 days</option></select></div>
    </div>}
    {tabs.length>0&&<div className="mt-8 flex flex-wrap items-center gap-7 border-b border-[#eceaf0]">
      {tabs.map((name)=><button key={name} onClick={()=>{setTab(name);if(projects)setView(name==="Board View"?"board":name==="Archived"?"archived":"list");}} className={"border-b-2 pb-4 text-xs "+((projects?(name==="Board View"&&view==="board"||name==="List View"&&view==="list"||name==="Archived"&&view==="archived") : (tab||tabs[0])===name)?"border-[#6337d8] font-semibold text-[#211f27]":"border-transparent text-[#77737d]")}>{name}</button>)}
      {projects&&<div className="ml-auto flex gap-3 pb-3">
        <select aria-label="Filter project type" value={projectType} onChange={e=>setProjectType(e.target.value)} className="bg-white text-xs text-[#8a8790]"><option value="all">Project Type</option>{Array.from(new Set(all.map(x=>x.type).filter(Boolean))).map(x=><option value={x} key={x}>{nice(x)}</option>)}</select>
        <button className="text-xs text-[#8a8790]" onClick={()=>setSort(x=>x==="newest"?"oldest":"newest")}>Project Date {sort==="newest"?"↓":"↑"}</button>
      </div>}
    </div>}
    {projects&&view==="board"?<div className="mt-6 flex gap-3 overflow-x-auto pb-10">
      {[...stages,"cancelled"].filter((v,i,a)=>a.indexOf(v)===i).map((stage)=>
        <div key={stage} className="min-h-[185px] w-[175px] shrink-0" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>void onDrop(e,stage)}>
          <div className="flex items-center gap-2"><span className={badge(stage)+" max-w-[140px] truncate"} style={stageStyle(stage)} title={stageTitle(stage)}><span className="size-1.5 shrink-0 rounded-full bg-current"/>{stageTitle(stage)}</span><span className="text-[11px] text-[#a4a0aa]">{filtered.filter(x=>x.status===stage).length}</span></div>
          <div className="mt-3 space-y-2">{filtered.filter(x=>x.status===stage).map((item)=><button draggable onDragStart={(e)=>e.dataTransfer.setData("text/plain",item._id)} onClick={()=>choose(item)} key={item._id} className="block w-full border border-[#e3e0e8] bg-white px-3 py-2.5 text-left text-[11px] transition hover:border-[#a995df]" style={stageColors[stage]?{borderTopColor:stageColors[stage]}:undefined}>
            <span className="block truncate font-semibold text-[#292334]" title={item.title}>{item.title}</span><span className="mt-1 block truncate text-[#777]" title={array(records,"contacts").find(x=>x._id===item.contactId)?.title||""}>{array(records,"contacts").find(x=>x._id===item.contactId)?.title||"No client"}</span><span className="mt-1.5 block truncate text-[#aaa]">{nice(item.type||"project")}</span><span className="mt-1.5 block truncate text-[10px] font-semibold text-[#6337d8]">{paymentForProject(item)} paid</span></button>)}
            <button onClick={onCreateProject} className="inline-flex items-center gap-1 py-1 text-[11px] text-[#8f8995]"><Plus className="size-3"/> Add Project</button>
          </div>
        </div>)}
      <button onClick={()=>setStageModal(true)} className="h-10 w-[115px] shrink-0 text-left text-xs font-semibold text-[#7c60b9]"><Plus className="mr-1 inline size-3"/> Add stage</button>
    </div>:null}
    {(!projects||view!=="board")&&(
      settings?<div className="mt-8 max-w-2xl space-y-5 border border-[#ece8f1] p-8"><h2 className="text-lg font-medium">Studio preferences</h2><p className="text-sm text-[#888]">Studio name, default currency, contact details and custom project stages.</p>
        <dl className="divide-y text-sm">{[["Studio",settingsItem?.details?.company||"Not set"],["Currency",settingsItem?.details?.currency||"EUR"],["Email",settingsItem?.details?.email||"Not set"],["Project stages",stages.map(stageTitle).join(" · ")]].map(([a,b])=><div key={a} className="grid grid-cols-2 gap-4 py-4"><dt className="text-[#777]">{a}</dt><dd>{b}</dd></div>)}</dl>
        <button onClick={()=>open(settingsItem||null,"settings")} className={BTN+" "+PRIMARY}>Edit preferences</button></div>
      : projects&&listBusy&&!pagedProjects?(
        <div className="mt-10 flex items-center gap-2 text-xs text-[#888]"><Loader2 className="size-4 animate-spin"/> Loading projects…</div>
      ) : projects&&listError?(
        <div role="alert" className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
      ) : filtered.length? (
        <div className="mt-5 w-full">
          {projects&&<div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#8c8491]">
            <span>{listBusy?"Updating projects…":pagedProjects?pagedProjects.total+" projects":""}</span>
            <label className="flex items-center gap-2">Rows per page
              <select aria-label="Rows per page" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}
                className="h-8 border border-[#e8e3ee] bg-white px-2 text-xs">
                {[10,20,50,100].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>}
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[740px] text-left text-[13px]">
            <thead><tr className="border-b border-[#e9e7eb]">{[
              projects?"Project Name":contacts?"Name":invoice?"Invoice #":templates?"Template Name":messages?"Message":kind==="documents"?"Document":kind==="payment-links"?"Payment Link":kind==="transactions"?"Transaction":"Name",
              projects?"Primary Client":contacts?"Type":invoice?"Amount":templates?"Type":messages?"From / To":kind==="documents"?"Client":kind==="transactions"?"Amount":kind==="payment-links"?"Amount":"Type",
              projects?"Type":contacts?"Email":invoice?"Client":templates?"Created":messages?"Date":kind==="documents"?"Status":"Status",
              projects?"Stage":contacts?"Phone":invoice?"Project":templates||messages?"Status":kind==="documents"?"Project":kind==="transactions"?"Method":"Created",
              projects?"Project Date":contacts?"Created":invoice?"Due On":kind==="documents"?"Created":kind==="transactions"?"Date":"",
              ...(projects?["Paid"]:[]),
              "Actions",
            ].map((n,i)=><th key={i} className={"pb-3 pr-5 "+SMALL_HEADING}>{n}</th>)}</tr></thead>
            <tbody>{filtered.map((item)=><tr key={item._id} className={"border-b border-[#efedf1] hover:bg-[#fdfcff] "+(projects?"cursor-pointer":"")}
              onClick={e=>{
                if(!projects)return;
                const target=e.target as HTMLElement;
                if(target.closest("button,select,a,input,[role=menu]"))return;
                choose(item);
              }}>
              <td className="py-4 pr-5 font-semibold">{projects?
                <Link href={BASE+"/projects/"+encodeURIComponent(item._id)} className="inline-block text-left text-[#30243b] hover:text-[#6337d8] hover:underline">{item.title}</Link>:
                <button onClick={()=>choose(item)} className="text-left hover:text-[#6337d8]">{invoice?item.details?.number||item.title:item.title}</button>}
                {invoice&&<span className="ml-3 align-middle text-[10px] text-[#98939d]">{item.status==="sent"?"IN PROGRESS · SENT":item.status.toUpperCase()}</span>}</td>
              <td className="pr-5">{invoice?money(item.amount,item.currency):projects||kind==="documents"?<span className="inline-flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#f3edf8] text-[10px]">{initials(array(records,"contacts").find(x=>x._id===item.contactId)?.title||"Client")}</span>{array(records,"contacts").find(x=>x._id===item.contactId)?.title||item.email||"—"}</span>:
                contacts?<span className={badge(item.status)}>{nice(item.status)}</span>:
                messages?(item.status==="sent"?"To: ":"From: ")+(item.email||"—"):
                kind==="transactions"?money(item.amount,item.currency):
                kind==="payment-links"?(item.details?.fixedAmount?money(item.amount,item.currency):"Flexible · "+item.currency):
                nice(item.type||item.status)}</td>
              <td className="pr-5">{projects?nice(item.type||"project"):contacts?item.email:invoice?array(records,"contacts").find(x=>x._id===item.contactId)?.title||item.email||"—":templates?dateLabel(item.createdAt):kind==="documents"?<span className={badge(item.status)}>{nice(item.status)}</span>:messages?dateLabel(item.createdAt):<span className={badge(item.status)}>{nice(item.status)}</span>}</td>
              <td className="pr-5">{projects?<select className={badge(item.status)+" border-0"} style={stageStyle(item.status)} value={item.status} onChange={(e)=>void onUpdate("projects",item,{status:e.target.value},"Project stage updated")}>{[...stages,"cancelled"].filter((v,i,a)=>a.indexOf(v)===i).map(v=><option key={v} value={v}>{stageTitle(v)}</option>)}</select>
                : contacts?item.phone||"—":invoice?array(records,"projects").find(x=>x._id===item.projectId)?.title||"—":kind==="transactions"?nice(item.details?.provider||item.details?.paymentMethod||item.details?.method||item.type||"manual"):templates||messages?<span className={badge(item.status)}>{nice(item.status)}</span>:dateLabel(item.createdAt)}</td>
              <td className="pr-5 text-[#777]">{projects?dateLabel(item.date):contacts?dateLabel(item.createdAt):invoice?dateLabel(item.dueDate):templates||messages?"—":dateLabel(item.createdAt)}</td>
              {projects&&<td className="pr-5 whitespace-nowrap text-[#777]">{paymentForProject(item)}</td>}
              <td className="py-4 text-right">
                <button type="button" aria-label={"Actions for "+item.title} aria-expanded={showActions===item._id}
                  onClick={e=>{
                    if(showActions===item._id){setShowActions(null);return;}
                    const rect=e.currentTarget.getBoundingClientRect();
                    setMenuPosition({
                      left:Math.max(8,Math.min(window.innerWidth-208,rect.right-196)),
                      top:Math.max(8,Math.min(rect.bottom+4,window.innerHeight-360)),
                    });
                    setShowActions(item._id);
                  }} className="rounded p-2 text-[#9e9aa4] hover:bg-[#f3eefb] hover:text-[#6337d8]"><Ellipsis className="size-5"/></button>
                {showActions===item._id&&typeof document!=="undefined"&&createPortal(<>
                  <button type="button" aria-label="Close row actions" className="fixed inset-0 z-[95] cursor-default bg-transparent" onClick={()=>setShowActions(null)}/>
                  <div role="menu" aria-label={"Actions for "+item.title} className="fixed z-[96] w-48 overflow-y-auto border border-[#e8e5eb] bg-white py-2 text-left text-xs shadow-[0_12px_40px_rgba(33,19,51,.18)]"
                    style={{left:menuPosition.left,top:menuPosition.top,maxHeight:"calc(100vh - "+(menuPosition.top+12)+"px)"}}>
                  {projects&&<button type="button" role="menuitem" className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{choose(item);setShowActions(null);}}>View project</button>}
                  {!readonly&&!(kind==="invoices"&&["paid","cancelled"].includes(item.status))&&!(kind==="documents"&&["completed","cancelled"].includes(item.status))&&
                    <button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{open(item,kind);setShowActions(null);}}>Edit</button>}
                  {kind==="templates"&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{onUseTemplate(item);setShowActions(null);}}>{item.type==="email"?"Compose email from template":"Create "+nice(item.type)+" from template"}</button>}
                  {(kind==="contacts"||kind==="messages")&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{onCompose(item);setShowActions(null);}}>Compose email</button>}
                  {(kind==="forms"||kind==="invoices"||kind==="payment-links"||(kind==="documents"&&["contract","quote","questionnaire"].includes(item.type)))&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{void onCopy(item);setShowActions(null);}}>Copy link</button>}
                  {(kind==="forms"||kind==="invoices"||(kind==="documents"&&["contract","quote","questionnaire"].includes(item.type)))&&
                    <button type="button" className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{onPreview(item);setShowActions(null);}}>Preview in new tab</button>}
                  {kind==="payment-links"&&item.status==="draft"&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{void onUpdate(kind,item,{status:"active"},"Payment request activated");setShowActions(null);}}>Activate link</button>}
                  {(kind==="invoices"||(kind==="documents"&&["contract","quote","questionnaire"].includes(item.type)))&&!["paid","completed","cancelled"].includes(item.status)&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{void onSend(item);setShowActions(null);}}>Send email</button>}
                  {kind==="invoices"&&!["paid","cancelled"].includes(item.status)&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{void onPay(item);setShowActions(null);}}>Record payment</button>}
                  {(kind==="invoices"||kind==="documents")&&!["completed","paid","cancelled"].includes(item.status)&&
                    <button type="button" className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50" onClick={()=>{
                      setShowActions(null);
                      if(window.confirm("Cancel "+item.title+"? Existing share links will stop working.")){
                        void onUpdate(kind,item,{status:"cancelled"},"Document cancelled");
                      }
                    }}>Cancel {kind==="invoices"?"invoice":"document"}</button>}
                  {kind==="forms"&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{void onUpdate(kind,item,{status:item.status==="published"?"draft":"published"});setShowActions(null);}}>{item.status==="published"?"Unpublish":"Publish"}</button>}
                  {kind==="messages"&&item.status!=="sent"&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{void onUpdate(kind,item,{status:item.status==="read"?"unread":"read"});setShowActions(null);}}>{item.status==="read"?"Mark unread":"Mark read"}</button>}
                  {kind==="projects"&&<button className="block w-full px-4 py-2 text-left hover:bg-[#f7f5fa]" onClick={()=>{void onUpdate(kind,item,{archived:!item.archived});setShowActions(null);}}>{item.archived?"Restore project":"Archive"}</button>}
                  {!readonly&&!(kind==="documents"&&["in-progress","completed"].includes(item.status))&&
                    <button className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50" onClick={()=>{void onDelete(kind,item);setShowActions(null);}}>Delete</button>}
                  </div>
                </>,document.body)}
              </td>
            </tr>)}</tbody>
          </table>
          </div>
          {projects&&pagedProjects?<div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#eeebf0] py-4 text-xs text-[#89818f]">
            <span>Showing {(pageNumber-1)*pageSize+1}–{Math.min(pageNumber*pageSize,pagedProjects.total)} of {pagedProjects.total}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={pageNumber<=1||listBusy} onClick={()=>setPageNumber(n=>Math.max(1,n-1))}
                className="h-9 border border-[#e6e1eb] px-3 font-semibold text-[#453f4c] disabled:opacity-35">Previous</button>
              <span className="px-2">Page {pageNumber} of {Math.max(1,Math.ceil(pagedProjects.total/pageSize))}</span>
              <button type="button" disabled={pageNumber>=Math.ceil(pagedProjects.total/pageSize)||listBusy}
                onClick={()=>setPageNumber(n=>n+1)} className="h-9 border border-[#e6e1eb] px-3 font-semibold text-[#453f4c] disabled:opacity-35">Next</button>
            </div>
          </div>:<p className="mt-5 text-right text-xs text-[#aaa]">1 - {filtered.length} of {filtered.length}</p>}
        </div>)
      :<div className="flex min-h-[420px] flex-col items-center justify-center text-center">
        <span className="grid size-32 place-items-center rounded-full bg-[#f7f4fe] text-[#7357c5]">{kind==="contacts"?<Users className="size-12 stroke-[1.4]"/>:invoice?<FileText className="size-12 stroke-[1.4]"/>:kind==="forms"?<FilePenLine className="size-12 stroke-[1.4]"/>:kind==="documents"?<FileCheck2 className="size-12 stroke-[1.4]"/>:kind==="templates"?<SquareStack className="size-12 stroke-[1.4]"/>:<Folder className="size-12 stroke-[1.4]"/>}</span>
        <h2 className="mt-7 text-base font-semibold">{search?"No results found":transactions?(effectiveTab==="Refunded"?"No refunded payments":"No recorded payments"):kind==="documents"?"Simple documents & client signing":kind==="forms"?"Create your first contact form":invoice?"Make invoicing effortless":projects?"Manage your bookings with projects":templates?"Create reusable studio templates":kind==="contacts"?"Build lasting client relationships":messages?"Your inbox is clear":"Nothing here yet"}</h2>
        <p className="mt-3 max-w-[350px] text-sm leading-6 text-[#8c8793]">{search?"Try another search.":"Keep everything organized in one place, then come back to manage your studio."}</p>
        {!readonly&&<button className={BTN+" "+PRIMARY+" mt-6"} onClick={()=>projects?onCreateProject():open(null,kind,selectedType||(templates?templateType:undefined))}><Plus className="size-4"/>{newLabel}</button>}
      </div>)}
    {kind==="payment-links"&&<p className="mt-6 text-xs text-[#80758d]">Reusable payment links offer Stripe or PayPal checkout with your Store payment accounts. Previously created manual payment requests can be edited to enable the new checkout. Payments only appear in Transactions after provider verification.</p>}
    {kind==="discounts"&&<p className="mt-6 text-xs text-[#8e8995]">Discounts are stored for your studio; they are not yet applied automatically to public bookings.</p>}
    {settings&&<StudioPaymentSettings/>}
    {stageModal&&<StudioStageDialog existing={stages} onClose={()=>setStageModal(false)} onCreate={addStage}/>}
  </div>;
}

function RecordDetail({record,onClose,onEdit,onSend,onCopy,onCompose}:{
  record:StudioRecord;onClose:()=>void;onEdit:()=>void;onSend:()=>void;onCopy:()=>void;onCompose:()=>void;
}) {
  return <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Studio record details">
    <button aria-label="Close details" className="flex-1" onClick={onClose}/>
    <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-8 shadow-2xl">
      <div className="flex justify-between"><div><p className={SMALL_HEADING}>{nice(record.kind)}</p><h2 className="mt-2 text-2xl font-medium">{record.title}</h2></div><button title="Close" onClick={onClose}><X className="size-5"/></button></div>
      <div className="mt-7 flex flex-wrap items-center gap-3"><span className={badge(record.status)}>{nice(record.status)}</span>
        {!["messages","transactions"].includes(record.kind)&&!(record.kind==="invoices"&&["paid","cancelled"].includes(record.status))&&!(record.kind==="documents"&&["completed","cancelled"].includes(record.status))&&
          <button className={OUTLINE} onClick={onEdit}>Edit</button>}
        {["contacts","messages"].includes(record.kind)&&<button className={OUTLINE} onClick={onCompose}><Mail className="size-3"/> Compose Email</button>}
        {["forms","invoices","documents","payment-links"].includes(record.kind)&&<button className={OUTLINE} onClick={onCopy}><Copy className="size-3"/>Copy Link</button>}
        {record.kind==="invoices"&&!["paid","cancelled"].includes(record.status)&&<button className={BTN+" "+PRIMARY} onClick={onSend}><Mail className="size-3"/> Send Invoice</button>}
        {record.kind==="documents"&&!["completed","cancelled"].includes(record.status)&&<button className={BTN+" "+PRIMARY} onClick={onSend}><Mail className="size-3"/> Send Document</button>}
      </div>
      <dl className="mt-8 divide-y divide-[#eee] text-sm">
        {[["Created",dateLabel(record.createdAt)],["Type",nice(record.type||"—")],["Status",nice(record.status||"—")],
          ["Email",record.email||"—"],["Date",dateLabel(record.date)],["Due date",dateLabel(record.dueDate)],
          ["Amount",record.amount?money(record.amount,record.currency):"—"]].map(([label,value])=><div key={label} className="grid grid-cols-3 gap-4 py-4"><dt className="text-[#aaa]">{label}</dt><dd className="col-span-2">{value}</dd></div>)}
      </dl>
      {record.description&&<div className="mt-6"><h3 className="text-sm font-semibold">Notes</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#6f6b76]">{record.description}</p></div>}
      {(record.kind==="documents"||record.kind==="templates")&&record.details?.content&&<div className="mt-8 border-t pt-6"><h3 className="font-semibold">Content</h3><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#6c6874]">{record.details.content}</p></div>}
      {record.kind==="invoices"&&<div className="mt-8 border-t pt-6"><h3 className="font-semibold">Invoice items</h3>
        {(record.details?.lines||[]).map((line:{name:string;quantity:number;unitPrice:number},i:number)=><div className="flex justify-between border-b py-3 text-sm" key={i}><span>{line.name} × {line.quantity}</span><span>{money(line.unitPrice*line.quantity,record.currency)}</span></div>)}
        <p className="mt-5 text-right text-lg font-bold">Total: {money(record.amount,record.currency)}</p></div>}
      {record.kind==="messages"&&<div className="mt-8 border-t pt-6"><h3 className="font-semibold">Form responses</h3>
        {Object.entries(record.details?.responses||{}).map(([key,value])=><div className="mt-3 text-sm" key={key}><span className="text-[#aaa]">{nice(key)}</span><p>{String(value)}</p></div>)}</div>}
      {record.kind==="transactions"&&<div className="mt-8 border-t pt-6">
        <h3 className="text-sm font-semibold">Payment details</h3>
        <dl className="mt-3 divide-y text-xs">{[
          ["Customer",String([record.details?.firstName,record.details?.lastName].filter(Boolean).join(" ")||record.email||"—")],
          ["Email",record.email||"—"],
          ["Provider",nice(record.details?.provider||record.type||"manual")],
          ["Payment amount",record.details?.baseAmount!=null?money(Number(record.details.baseAmount),record.currency):money(record.amount,record.currency)],
          ["Tip",money(Number(record.details?.tipAmount||0),record.currency)],
          ["Total received",money(record.amount,record.currency)],
          ["Status",nice(record.status)],
          ["Payment date",dateLabel(record.details?.paidAt||record.createdAt)],
        ].map(([label,value])=><div key={label} className="grid grid-cols-[130px_1fr] gap-3 py-3">
          <dt className="text-[#999]">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl>
        {record.projectId&&<Link href={BASE+"/projects/"+encodeURIComponent(record.projectId)}
          className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#6337d8]"><Folder className="size-4"/>Open linked project</Link>}
      </div>}
    </div>
  </div>;
}

"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {
  ArrowLeft,CheckCircle2,ChevronDown,Copy,Eye,FileCheck2,
  LayoutList,Loader2,Mail,Plus,Save,Settings2,Trash2,X,
} from "lucide-react";
import {toast} from "sonner";
import {StudioPublic} from "./studio-public";
import {copyStudioPublicLink,previewStudioPublicDraft} from "./studio-public-links";
import {studioCreate,studioDelete,studioDetail,studioSendContract,studioUpdate,type StudioRecord} from "@/actions/studio";
import {
  createQuoteItem,displayQuoteMoney,newQuoteId,quoteTotals,
  type QuoteItem,type QuoteItemType,type QuoteSelections,
} from "./studio-quote-model";

type Kind="quote"|"questionnaire";
type QuestionType="radio"|"checkbox"|"text"|"textarea"|"date"|"select";
type Question={
  name:string;label:string;type:QuestionType;required:boolean;
  options:string[];allowOther:boolean;
};
type Props={
  kind:Kind;initial?:StudioRecord|null;
  contacts:StudioRecord[];projects:StudioRecord[];
  contextClient?:StudioRecord|null;
  defaultContactId?:string;defaultProjectId?:string;defaultEmail?:string;
  onClose:()=>void;onSaved:()=>Promise<void>;
};
const field="h-11 w-full border border-[#e4e4e4] bg-white px-3 text-sm outline-none focus:border-[#14b8a6] disabled:bg-[#f7f7f7]";
const textarea="min-h-20 w-full resize-y border border-[#e4e4e4] bg-white px-3 py-3 text-sm outline-none focus:border-[#14b8a6] disabled:bg-[#f7f7f7]";
const green="inline-flex min-h-11 items-center justify-center gap-2 bg-[#19bca5] px-5 text-xs font-semibold text-white hover:bg-[#14a891] disabled:cursor-not-allowed disabled:opacity-50";
const outline="inline-flex min-h-10 items-center justify-center gap-2 border border-[#e7e5e9] bg-white px-4 text-xs font-semibold text-[#49454c] hover:bg-[#f8f7f9] disabled:opacity-50";
const kinds:[QuestionType,string][]=[
  ["radio","Multiple Choice"],["checkbox","Checkboxes"],
  ["text","Short Answer"],["textarea","Paragraph"],["date","Date"],["select","Dropdown"],
];
const question=(type:QuestionType):Question=>({
  name:"q_"+newQuoteId(),label:"",type,required:false,
  options:["radio","checkbox","select"].includes(type)?["Option 1"]:[],allowOther:false,
});
function initialQuestions(raw:unknown):Question[]{
  if(!Array.isArray(raw))return [];
  return raw.map((field)=>{
    const q=(field&&typeof field==="object"?field:{} ) as Record<string,unknown>;
    const type=kinds.some(x=>x[0]===q.type)?q.type as QuestionType:"text";
    return {name:String(q.name||("q_"+newQuoteId())),label:String(q.label||""),
      type,required:q.required===true,
      options:Array.isArray(q.options)?q.options.map(String):
        String(q.options||"").split(",").map(x=>x.trim()).filter(Boolean),
      allowOther:q.allowOther===true};
  });
}
function initialQuote(raw:unknown):QuoteItem[]{
  if(!Array.isArray(raw))return [];
  return raw.filter(v=>v&&typeof v==="object").map(v=>({
    id:String(v.id||newQuoteId()),type:(["standard","selection","optional"].includes(v.type)?v.type:"standard") as QuoteItemType,
    title:String(v.title||""),description:String(v.description||""),
    quantity:Number(v.quantity||1),unitPrice:Number(v.unitPrice||0),
    options:Array.isArray(v.options)?v.options.map((o:Record<string,unknown>)=>({
      id:String(o.id||newQuoteId()),name:String(o.name||""),description:String(o.description||""),
      quantity:Number(o.quantity||1),unitPrice:Number(o.unitPrice||0),
    })):[],
  }));
}
function initialism(value:string){return value.split(/\s+/).map(x=>x.charAt(0)).join("").slice(0,2).toUpperCase()||"CL";}

export function StudioDocumentDesigner({
  kind,initial,contacts,projects,contextClient=null,
  defaultContactId="",defaultProjectId="",defaultEmail="",onClose,onSaved,
}:Props){
  const details=initial?.details||{};
  const [saved,setSaved]=useState<StudioRecord|null>(initial||null);
  const [step,setStep]=useState<"choose"|"editor">(
    kind==="quote"&&!initial&&!defaultContactId?"choose":"editor");
  const [title,setTitle]=useState(initial?.title||(kind==="quote"?"New Quote":"New Questionnaire"));
  const [description,setDescription]=useState(initial?.description||"");
  const [contactId,setContactId]=useState(initial?.contactId||defaultContactId||"");
  const [extraContacts,setExtraContacts]=useState<StudioRecord[]>(contextClient?[contextClient]:[]);
  const [projectId,setProjectId]=useState(initial?.projectId||defaultProjectId||"");
  const [email,setEmail]=useState(initial?.email||defaultEmail||"");
  const [currency,setCurrency]=useState(initial?.currency||"EUR");
  const [questions,setQuestions]=useState<Question[]>(()=>initialQuestions(details.fields));
  const [items,setItems]=useState<QuoteItem[]>(()=>initialQuote(details.quoteItems));
  const [discount,setDiscount]=useState<number>(Number(details.discountPercent)||0);
  const [tax,setTax]=useState<number>(Number(details.taxPercent)||0);
  const [notes,setNotes]=useState<string>(details.notes||"Thank you for your business.");
  const [autoInvoice,setAutoInvoice]=useState(details.autoCreateInvoice!==false);
  const [expiry,setExpiry]=useState(initial?.dueDate?new Date(initial.dueDate).toISOString().slice(0,10):"");
  const [accent,setAccent]=useState(/^#[a-f0-9]{6}$/i.test(details.accentColor||"")?details.accentColor:"#19bca5");
  const [preview,setPreview]=useState(Boolean(initial&&initial.status!=="draft"));
  const [design,setDesign]=useState(false);
  const [addQuestion,setAddQuestion]=useState(false);
  const [addQuoteItem,setAddQuoteItem]=useState(false);
  const [actions,setActions]=useState(false);
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [error,setError]=useState("");
  const [draftStatus,setDraftStatus]=useState<"idle"|"saving"|"saved">("idle");
  const [previewResponses,setPreviewResponses]=useState<Record<string,string>>({});
  const [previewSelections,setPreviewSelections]=useState<QuoteSelections>({});
  const savingRef=useRef(false);
  const locked=!!saved&&saved.status!=="draft";
  const contactOptions=useMemo(()=>Array.from(new Map(
    [...contacts,...extraContacts].map(c=>[c._id,c]),
  ).values()),[contacts,extraContacts]);
  const client=contactOptions.find(x=>x._id===contactId)||null;
  useEffect(()=>{
    if(!contactId||contactOptions.some(c=>c._id===contactId))return;
    let active=true;
    void studioDetail("contacts",contactId).then(record=>{
      if(active)setExtraContacts(current=>current.some(c=>c._id===record._id)?current:[...current,record]);
    }).catch(()=>undefined);
    return ()=>{active=false;};
  },[contactId,contactOptions]);
  const project=projects.find(x=>x._id===projectId)||null;
  const money=(n:number)=>displayQuoteMoney(n,currency);
  const totals=useMemo(()=>quoteTotals(items,{},discount,tax,true),[items,discount,tax]);
  const previewTotals=useMemo(()=>quoteTotals(items,previewSelections,discount,tax),[items,previewSelections,discount,tax]);
  const markDirty=()=>{setDirty(true);setDraftStatus("idle");};
  const changeClient=(id:string)=>{
    setContactId(id);const c=contactOptions.find(x=>x._id===id);
    setEmail(c?.email||"");markDirty();
  };
  const changeProject=(id:string)=>{
    setProjectId(id);
    const proj=projects.find(x=>x._id===id);
    if(proj?.contactId)changeClient(proj.contactId);
    markDirty();
  };
  const setQuestion=(index:number,patch:Partial<Question>)=>{
    setQuestions(old=>old.map((q,i)=>i===index?{...q,...patch}:q));markDirty();
  };
  const setQuote=(index:number,patch:Partial<QuoteItem>)=>{
    setItems(old=>old.map((item,i)=>i===index?{...item,...patch}:item));markDirty();
  };
  const setOption=(index:number,optionIndex:number,patch:Partial<QuoteItem["options"][number]>)=>{
    setItems(old=>old.map((item,i)=>i===index?{...item,options:item.options.map((o,j)=>j===optionIndex?{...o,...patch}:o)}:item));
    markDirty();
  };
  const savePayload=()=>{
    const base={
      title:title.trim(),description:description.trim(),type:kind,contactId,projectId,
      email:email.trim(),currency,
      dueDate:expiry||null,
    };
    return kind==="questionnaire"?{
      ...base,details:{
        fields:questions.map(q=>({...q,options:q.options.map(x=>x.trim()).filter(Boolean).join(",")})),
        content:"",accentColor:accent,
      },
    }:{
      ...base,details:{
        quoteItems:items,notes,discountPercent:discount,taxPercent:tax,
        autoCreateInvoice:autoInvoice,accentColor:accent,content:"",
      },
    };
  };
  const validate=()=>{
    if(!title.trim())return "Add a document title";
    if(!contactId||!email.trim())return "Select a client with an email address before saving";
    if(!projectId&&kind==="quote")return "Choose a project before saving this quote";
    if(kind==="questionnaire"){
      if(!questions.length)return "Add at least one questionnaire question";
      if(questions.some(q=>!q.label.trim()))return "Every questionnaire question needs a title";
      if(questions.some(q=>["radio","checkbox","select"].includes(q.type)&&
        (!q.options.length||q.options.some(v=>!v.trim())||new Set(q.options.map(x=>x.trim())).size!==q.options.length)))
        return "Choice questions need distinct, nonempty options";
    }
    if(kind==="quote"){
      if(!items.length)return "Add at least one quote item";
      if(items.some(item=>item.type==="standard"&&!item.title.trim()))return "Name each standard quote item";
      if(items.some(item=>item.type!=="standard"&&
        (!item.options.length||item.options.some(o=>!o.name.trim()))))
        return "Every client selection or optional item needs at least one named option";
      if(items.some(item=>item.type==="standard"&&(!Number.isFinite(item.unitPrice)||item.unitPrice<0||
        !Number.isFinite(item.quantity)||item.quantity<=0))||
        items.some(item=>item.options.some(o=>!Number.isFinite(o.unitPrice)||o.unitPrice<0||
          !Number.isFinite(o.quantity)||o.quantity<=0)))
        return "Use nonnegative prices and positive quantities";
      if(discount<0||discount>100||tax<0||tax>100)return "Discount and tax must be between 0 and 100%";
    }
    return "";
  };
  const persist=async(silent=false):Promise<StudioRecord|null>=>{
    if(savingRef.current)return null;
    if(locked)return saved;
    const issue=validate();
    if(issue){if(!silent)setError(issue);return null;}
    savingRef.current=true;setBusy(true);setDraftStatus("saving");setError("");
    try{
      const record=saved?
        await studioUpdate("documents",saved._id,savePayload()):
        await studioCreate("documents",savePayload());
      setSaved(record);setDirty(false);setDraftStatus("saved");
      if(!silent)toast.success(kind==="quote"?"Quote saved":"Questionnaire saved");
      await onSaved();
      return record;
    }catch(e){
      setError(e instanceof Error?e.message:"Could not save document");setDraftStatus("idle");
      return null;
    }finally{savingRef.current=false;setBusy(false);}
  };
  // Only already-saved drafts auto-save. New documents require explicit Save.
  useEffect(()=>{
    if(!saved||saved.status!=="draft"||!dirty||busy||step!=="editor")return;
    const id=window.setTimeout(()=>{void persist(true)},1300);
    return ()=>window.clearTimeout(id);
    // Persist deliberately captures the latest editor state on each dirty update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[saved?._id,dirty,title,description,contactId,projectId,email,currency,questions,items,discount,tax,
    notes,autoInvoice,expiry,accent,busy,step]);
  const send=async()=>{
    if(locked){toast.info("The document was already sent");return;}
    if(savingRef.current||busy)return;
    const record=(!saved||dirty)?await persist():saved;
    if(!record)return;
    if(!window.confirm("Send this "+kind+" to "+email+"? The client will receive a secure link."))return;
    setBusy(true);setError("");
    try{
      const result=await studioSendContract(record._id);
      setSaved(result.record);setDirty(false);setPreview(true);
      toast.success(kind==="quote"?"Quote sent to client":"Questionnaire sent to client");
      await onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Could not send document")}
    finally{setBusy(false);}
  };
  const copy=async()=>{
    if(!saved?._id){toast.error("Save the draft before copying a public link");return;}
    try{await copyStudioPublicLink("documents",saved._id);
      toast.success(saved.status==="draft"?"Shareable draft preview link copied":"Client link copied");}
    catch(e){toast.error(e instanceof Error?e.message:"Could not copy public link");}
  };
  const remove=async()=>{
    setActions(false);
    if(!saved||locked||!window.confirm("Delete this draft? This cannot be undone."))return;
    setBusy(true);
    try{await studioDelete("documents",saved._id);toast.success("Draft deleted");await onSaved();onClose();}
    catch(e){setError(e instanceof Error?e.message:"Delete failed");setBusy(false);}
  };
  const close=()=>{
    if(busy)return;
    if(dirty&&!window.confirm("Discard unsaved changes?"))return;
    onClose();
  };
  const changePreviewChoice=(id:string,value:string,multiple=false)=>{
    setPreviewSelections(old=>{
      if(!multiple)return {...old,[id]:value};
      const selected=Array.isArray(old[id])?old[id] as string[]:[];
      return {...old,[id]:selected.includes(value)?selected.filter(x=>x!==value):[...selected,value]};
    });
  };

  const label=(text:string)=> <span className="text-xs font-semibold text-[#242424]">{text}</span>;
  const questionBody=(q:Question,readonlyPreview=false)=>{
    const value=previewResponses[q.name]||"";
    const choose=(val:string)=>setPreviewResponses(old=>({...old,[q.name]:val}));
    return <div className="mt-4 space-y-2">
      {["radio","checkbox","select"].includes(q.type)?
        (q.type==="select"?
          <select className={field} value={value} onChange={e=>choose(e.target.value)}>
            <option value="">Choose an option</option>
            {q.options.filter(Boolean).map((opt,i)=><option key={i}>{opt}</option>)}
          </select>:
          <div className="space-y-3">
            {q.options.filter(Boolean).map((opt,i)=><label key={i} className="flex items-center gap-3 text-[13px] text-[#515151]">
              <input type={q.type==="radio"?"radio":"checkbox"} name={q.type==="radio"?q.name+"-preview":undefined}
                checked={q.type==="radio"?value===opt:value.split(" | ").includes(opt)}
                onChange={()=>{
                  if(q.type==="radio")choose(opt);
                  else{
                    const next=value?value.split(" | "):[];
                    choose((next.includes(opt)?next.filter(x=>x!==opt):[...next,opt]).join(" | "));
                  }
                }}/>
              {opt}
            </label>)}
            {q.allowOther&&<label className="flex items-center gap-3 text-xs text-[#555]">
              <input type={q.type==="radio"?"radio":"checkbox"} name={q.type==="radio"?q.name+"-preview":undefined}
                checked={value.includes("Other: ")} onChange={()=>choose("Other: Please specify")}/>Other
            </label>}
          </div>
        ):
      q.type==="textarea"?<textarea className={textarea} placeholder="Your answer" value={value} onChange={e=>choose(e.target.value)}/>:
      <input type={q.type==="date"?"date":"text"} className={field} placeholder="Your answer"
        value={value} onChange={e=>choose(e.target.value)}/>}
      {readonlyPreview&&q.required&&<p className="text-[11px] text-[#999]">Required</p>}
    </div>;
  };

  const clientPreviewData=kind==="questionnaire"?{
    title,description,status:saved?.status==="completed"?"completed":"in-progress",
    content:"",type:"questionnaire" as const,fields:questions.map(q=>({
      ...q,options:q.options.filter(Boolean).join(","),
    })),responses:saved?.details?.responses||{},amount:0,currency,
    accentColor:accent,
  }:{
    title,description,status:saved?.status==="completed"?"completed":"in-progress",
    content:"",type:"quote" as const,fields:[],responses:{},amount:totals.total,
    currency,quoteItems:items,discountPercent:discount,taxPercent:tax,notes,
    acceptedTotal:saved?.details?.acceptedTotal??null,
    acceptedSelections:saved?.details?.acceptedSelections||{},
    signerName:String(saved?.details?.signerName||""),
    acceptedAt:String(saved?.details?.acceptedAt||""),
    accentColor:accent,
  };
  const openClientPreview=()=>{
    if(busy)return;
    void previewStudioPublicDraft("documents",async()=>{
      if(saved&&!dirty)return saved;
      return persist();
    }).catch(e=>toast.error(e instanceof Error?e.message:"Could not open the public preview."));
  };

  if(step==="choose"){
    return <main className="fixed inset-0 z-[110] overflow-y-auto bg-white text-[#222]" role="dialog" aria-modal="true">
      <header className="flex h-16 items-center gap-4 border-b border-[#eee] px-6">
        <button aria-label="Close quote wizard" type="button" onClick={close}><X className="size-5"/></button>
        <span className="text-sm font-medium">New Quote</span>
      </header>
      <section className="mx-auto w-full max-w-[880px] px-6 pt-20 sm:pt-32">
        <h1 className="mb-6 text-2xl font-medium">Create a new quote</h1>
        <label className="block space-y-2">
          {label("Client")}
          <select className={field} value={contactId} onChange={e=>changeClient(e.target.value)}>
            <option value="">Choose a client</option>{contactOptions.map(c=><option key={c._id} value={c._id}>{c.title} · {c.email}</option>)}
          </select>
        </label>
        <label className="mt-7 block space-y-2">
          {label("Project")}
          <select className={field} value={projectId} onChange={e=>changeProject(e.target.value)}>
            <option value="">Choose a project</option>
            {projects.filter(p=>!contactId||!p.contactId||p.contactId===contactId).map(p=><option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
        </label>
        {error&&<p className="mt-5 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        <button type="button" className={green+" mt-7 min-w-[105px]"} onClick={()=>{
          if(!contactId){setError("Select a client");return;}
          if(!projectId){setError("Select a project");return;}
          setError("");setStep("editor");
        }}>Next</button>
      </section>
    </main>;
  }

  return <main className="fixed inset-0 z-[110] flex flex-col overflow-hidden bg-[#f5f5f5] text-[#262626]"
    role="dialog" aria-modal="true" aria-label={kind==="quote"?"Quote editor":"Questionnaire editor"}>
    <header className="flex min-h-[64px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e8e8e8] bg-white px-4 py-2 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button aria-label="Back to Studio Manager" type="button" onClick={close}><ArrowLeft className="size-5 text-[#777]"/></button>
        <div className="min-w-0">
          <input className="block max-w-[260px] border-0 bg-transparent text-[15px] font-semibold outline-none focus:border-b"
            value={title} onChange={e=>{setTitle(e.target.value);markDirty();}} disabled={locked}
            aria-label={kind==="quote"?"Quote title":"Questionnaire title"} maxLength={220}/>
          <p className="mt-1 truncate text-[11px] text-[#19a995]">{project?.title||"No project selected"}</p>
        </div>
        <span className="rounded-full bg-[#f4f3f3] px-3 py-2 text-[10px] font-bold uppercase text-[#888]">
          {saved?.status||"draft"}</span>
        <p role="status" className="hidden text-[11px] text-[#aaa] lg:block">
          {draftStatus==="saving"?"Saving changes…":dirty?"Unsaved changes":saved?"All changes saved":"New draft"}</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative hidden sm:block">
          <button type="button" className="flex items-center gap-1 px-2 text-xs" onClick={()=>setActions(!actions)}>Actions <ChevronDown className="size-3"/></button>
          {actions&&<div className="absolute right-0 top-7 z-30 min-w-[145px] border bg-white py-2 shadow-lg">
            <button type="button" className="block w-full px-4 py-2 text-left text-xs hover:bg-[#eee]" onClick={()=>{setActions(false);void copy()}}>Copy Link</button>
            {!locked&&saved&&<button type="button" className="block w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={()=>void remove()}>Delete Draft</button>}
          </div>}
        </div>
        <button type="button" className="hidden px-2 text-xs sm:block" onClick={()=>{setDesign(!design);setPreview(false);}}>
          Edit Design</button>
        {preview&&!locked&&<button type="button" className={outline}
          onClick={()=>{setPreview(false);setDesign(false);}}>Edit {kind==="quote"?"Quote":"Questions"}</button>}
        <button type="button" disabled={busy} onClick={openClientPreview}
          className={outline+(preview?" bg-[#f5f0ff] text-[#6337d8]":"")}>
          <Eye className="size-4"/>Preview</button>
        {!locked&&<button type="button" className={outline+" hidden sm:inline-flex"} disabled={busy} onClick={()=>void persist()}>
          <Save className="size-4"/>Save Draft</button>}
        {!locked&&<button type="button" className={green} disabled={busy} onClick={()=>void send()}>
          {busy?<Loader2 className="size-4 animate-spin"/>:<Mail className="size-4"/>}
          <span className="hidden sm:inline">Send {kind==="quote"?"Quote":"Questionnaire"}</span>
          <span className="sm:hidden">Send</span>
        </button>}
        {locked&&<button type="button" className={outline} onClick={()=>void copy()}><Copy className="size-4"/>Copy Link</button>}
      </div>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-[265px] shrink-0 overflow-y-auto border-r border-[#e7e7e7] bg-white px-6 py-7 md:block lg:w-[295px]">
        <h2 className="text-sm font-semibold">Client</h2>
        <div className="mt-5 flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1eef8] text-xs font-medium text-[#423856]">
            {initialism(client?.title||"Client")}</div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{client?.title||"Select client"}</p>
            <p className="truncate text-[11px] text-[#888]">{client?.email||"Email required to send"}</p>
          </div>
        </div>
        <label className="mt-6 block space-y-2">
          {label("Client")}
          <select className={field} disabled={locked} value={contactId} onChange={e=>changeClient(e.target.value)}>
            <option value="">Choose a client</option>
            {contactOptions.map(c=><option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
        </label>
        <label className="mt-5 block space-y-2">
          {label("Project")}
          <select className={field} disabled={locked} value={projectId} onChange={e=>changeProject(e.target.value)}>
            <option value="">No project</option>
            {projects.map(p=><option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
        </label>
        <h3 className="mt-9 text-sm font-semibold">Settings</h3>
        {kind==="quote"&&<>
          <label className="mt-6 flex items-center justify-between gap-3 text-xs font-semibold">Auto create invoice
            <input type="checkbox" disabled={locked} checked={autoInvoice} onChange={e=>{setAutoInvoice(e.target.checked);markDirty();}}
              className="size-4 accent-[#19bca5]"/></label>
          <p className="mt-2 text-[11px] leading-5 text-[#999]">Generate a draft invoice when the client accepts the quote.</p>
          <label className="mt-7 block space-y-2">{label("Currency")}
            <select className={field} disabled={locked} value={currency} onChange={e=>{setCurrency(e.target.value);markDirty();}}>
              {["BDT","EUR","USD","GBP","SGD","INR"].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </>}
        <label className="mt-7 block space-y-2">{label("Document expiry")}
          <input type="date" disabled={locked} className={field} value={expiry} onChange={e=>{setExpiry(e.target.value);markDirty();}}/></label>
        <p className="mt-3 text-[11px] leading-5 text-[#999]">The recipient should respond before this date. Keep a copy for your records.</p>
        <p className="mt-10 border-t pt-5 text-[11px] leading-6 text-[#999]">
          Drafts can be edited. After sending, clients receive a link and the document is locked from further changes.</p>
      </aside>
      <section className={"min-w-0 flex-1 overflow-y-auto bg-[#f5f5f5] "+(preview?"py-3 sm:px-5":"px-4 py-8 sm:px-8 lg:py-12")}>
        {preview?<StudioPublic kind={kind} token="" ownerPreview data={clientPreviewData}/>:
          <div className="mx-auto w-full max-w-[740px]">
          <div className="mb-5 grid gap-4 border border-[#e5e5e5] bg-white p-5 md:hidden">
            <label className="space-y-2">{label("Client")}
              <select className={field} disabled={locked} value={contactId}
                onChange={e=>changeClient(e.target.value)}>
                <option value="">Choose a client</option>
                {contactOptions.map(c=><option key={c._id} value={c._id}>{c.title}</option>)}
              </select></label>
            <label className="space-y-2">{label("Project")}
              <select className={field} disabled={locked} value={projectId}
                onChange={e=>changeProject(e.target.value)}>
                <option value="">No linked project</option>
                {projects.map(p=><option key={p._id} value={p._id}>{p.title}</option>)}
              </select></label>
            {kind==="quote"&&<>
              <label className="flex items-center gap-3 text-xs font-semibold">
                <input type="checkbox" disabled={locked} checked={autoInvoice}
                  onChange={e=>{setAutoInvoice(e.target.checked);markDirty();}}/>
                Auto-create draft invoice when quote is accepted
              </label>
              <label className="space-y-2">{label("Currency")}
                <select className={field} disabled={locked} value={currency}
                  onChange={e=>{setCurrency(e.target.value);markDirty();}}>
                  {["BDT","EUR","USD","GBP","SGD","INR"].map(c=><option key={c}>{c}</option>)}
                </select></label>
            </>}
          </div>
          {error&&<p role="alert" className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {design&&<div className="mb-5 flex items-center gap-4 border border-[#e2e2e2] bg-white p-5 text-sm">
            <Settings2 className="size-5 text-[#777]"/> Accent colour
            <input aria-label="Document accent colour" type="color" disabled={locked} value={accent}
              onChange={e=>{setAccent(e.target.value);markDirty();}}/>
            <button type="button" onClick={()=>setDesign(false)} className="ml-auto text-xs text-[#777]">Done</button>
          </div>}
          <div className="border border-[#e7e7e7] bg-white px-6 py-7 sm:px-8">
            <h2 className="text-[16px] font-semibold">{title||"Untitled document"}</h2>
            {preview?
              description&&<p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#555]">{description}</p>:
              <textarea className={textarea+" mt-5 min-h-[105px]"} disabled={locked}
                placeholder="Add description (optional)" value={description}
                onChange={e=>{setDescription(e.target.value);markDirty();}}/>}
            {kind==="quote"&&<p className="mt-6 text-[11px] text-[#888]">Prepared for {client?.title||"your client"} · {project?.title||"No project"}</p>}
          </div>
          {kind==="questionnaire"?<div className="mt-8 space-y-6">
            {!questions.length&&!preview&&<div className="border border-dashed border-[#ddd] bg-white px-6 py-10 text-center text-xs text-[#888]">
              No questions yet. Click the green plus to add your first question.</div>}
            {questions.map((q,index)=><div key={q.name} className="border border-[#e8e8e8] bg-white px-6 py-7 sm:px-8">
              {preview?<>
                <h3 className="text-sm font-semibold">{q.label||"Question "+(index+1)}{q.required&&" *"}</h3>
                {questionBody(q,true)}
              </>:<>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-3 text-xs font-semibold">
                    <span className="grid size-7 place-items-center bg-[#ecf8f0] text-[#358e79]"><CheckCircle2 className="size-4"/></span>
                    <select aria-label={"Question type "+(index+1)} value={q.type} disabled={locked}
                      className="bg-white text-xs font-semibold outline-none"
                      onChange={e=>{
                        const type=e.target.value as QuestionType;
                        setQuestion(index,{type,options:["radio","checkbox","select"].includes(type)?(q.options.length?q.options:["Option 1"]):[],allowOther:false});
                      }}>
                      {kinds.map(([value,name])=><option key={value} value={value}>{name}</option>)}
                    </select>
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-[11px] text-[#777]">
                      <input type="checkbox" disabled={locked} checked={q.required}
                        onChange={e=>setQuestion(index,{required:e.target.checked})}/>Required</label>
                    {!locked&&<button type="button" className="p-2 text-[#999] hover:text-red-600"
                      title="Delete question" onClick={()=>{setQuestions(old=>old.filter((_,i)=>i!==index));markDirty();}}><Trash2 className="size-4"/></button>}
                  </div>
                </div>
                <input className={field+" mt-5"} disabled={locked} value={q.label}
                  placeholder="Type your question here" onChange={e=>setQuestion(index,{label:e.target.value})}/>
                {["radio","checkbox","select"].includes(q.type)?<div className="mt-5 space-y-3">
                  {q.options.map((value,i)=><div key={i} className="flex items-center gap-3">
                    <input type={q.type==="checkbox"?"checkbox":"radio"} disabled aria-label="Option marker"/>
                    <input className="min-h-9 flex-1 border-b border-[#eee] bg-white text-[13px] outline-none focus:border-[#19bca5]"
                      disabled={locked} placeholder={"Option "+(i+1)} value={value}
                      onChange={e=>setQuestion(index,{options:q.options.map((x,j)=>j===i?e.target.value:x)})}/>
                    {!locked&&q.options.length>1&&<button type="button" title="Remove option" onClick={()=>
                      setQuestion(index,{options:q.options.filter((_,j)=>i!==j)})}><X className="size-4 text-[#aaa]"/></button>}
                  </div>)}
                  {!locked&&q.options.length<25&&<button type="button" className="flex items-center gap-2 text-xs" style={{color:accent}}
                    onClick={()=>setQuestion(index,{options:[...q.options,"Option "+(q.options.length+1)]})}>
                    <Plus className="size-4"/>Add option</button>}
                  {["radio","checkbox"].includes(q.type)&&<label className="mt-2 flex items-center gap-2 text-xs text-[#777]">
                    <input type="checkbox" disabled={locked} checked={q.allowOther} onChange={e=>setQuestion(index,{allowOther:e.target.checked})}/>
                    Include an &quot;Other&quot; answer</label>}
                </div>:<div className="mt-5 border-b border-[#ddd] px-1 py-3 text-xs text-[#aaa]">
                  {q.type==="textarea"?"Client writes a paragraph here":q.type==="date"?"Client selects a date":"Client types a short answer"}</div>}
              </>}
            </div>)}
            {!preview&&!locked&&<div className="relative flex justify-center">
              <button type="button" aria-label="Add question" className="grid size-9 place-items-center rounded-full text-white"
                style={{backgroundColor:accent}} onClick={()=>setAddQuestion(!addQuestion)}><Plus className="size-5"/></button>
              {addQuestion&&<div className="absolute top-11 z-10 min-w-[220px] border border-[#ddd] bg-white p-2 shadow-xl">
                {kinds.map(([type,name])=><button key={type} type="button" className="block w-full px-4 py-3 text-left text-xs hover:bg-[#f3f3f3]"
                  onClick={()=>{setQuestions(old=>[...old,question(type)]);setAddQuestion(false);markDirty();}}>{name}</button>)}
              </div>}
            </div>}
          </div>:<div className="mt-8 border border-[#e8e8e8] bg-white px-6 py-8 sm:px-8">
            <h2 className="text-lg font-semibold">Items</h2>
            {!items.length&&!preview?<div className="mt-6 bg-[#f7f7f7] px-5 py-6">
              <p className="mb-5 text-center text-sm font-semibold">Select quote item type to begin</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["standard","selection","optional"] as const).map(type=><button type="button" key={type}
                  className="min-h-[130px] border border-transparent bg-white p-3 text-center hover:border-[#19bca5]"
                  onClick={()=>{setItems([createQuoteItem(type)]);markDirty();}}>
                  <span className="mx-auto grid size-9 place-items-center bg-[#eaf5f0] text-[#408d7d]">
                    {type==="standard"?<LayoutList className="size-4"/>:type==="selection"?<CheckCircle2 className="size-4"/>:<FileCheck2 className="size-4"/>}
                  </span>
                  <span className="mt-4 block text-xs font-semibold">{type==="standard"?"Standard Item":type==="selection"?"Client Selection":"Optional Items"}</span>
                  <span className="mt-2 block text-[11px] text-[#888]">{type==="standard"?"Included in quote":type==="selection"?"Client selects one":"Client chooses any"}</span>
                </button>)}
              </div>
            </div>:<>
              <div className="mt-6 grid grid-cols-[minmax(0,1fr)_55px_100px] gap-2 border-b pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#aaa] sm:grid-cols-[minmax(0,1fr)_70px_115px]">
                <span>Items</span><span>Qty</span><span>Price</span>
              </div>
              {items.map((item,index)=><div key={item.id} className="mt-4 bg-[#f7f7f7] px-4 py-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold">
                    {item.type==="standard"?"Standard Item":item.type==="selection"?"Client Selection":"Optional Items"}</span>
                  {!preview&&!locked&&<button type="button" title="Remove item" className="text-[#999] hover:text-red-600"
                    onClick={()=>{setItems(old=>old.filter((_,i)=>i!==index));markDirty();}}><Trash2 className="size-4"/></button>}
                </div>
                {item.type==="standard"?<div className="grid grid-cols-[minmax(0,1fr)_55px_100px] gap-2 sm:grid-cols-[minmax(0,1fr)_70px_115px]">
                  <div className="space-y-2">
                    {preview?<p className="text-xs font-semibold">{item.title||"Service"}</p>:
                      <input className={field} disabled={locked} placeholder="Item name" value={item.title}
                        onChange={e=>setQuote(index,{title:e.target.value})}/>}
                    {preview?<p className="text-xs text-[#777]">{item.description}</p>:
                      <input className={field} disabled={locked} placeholder="Item description" value={item.description}
                        onChange={e=>setQuote(index,{description:e.target.value})}/>}
                  </div>
                  {preview?<span className="text-xs">{item.quantity}</span>:<input className={field} type="number" min=".01" step=".01" aria-label="Item quantity" disabled={locked}
                    value={item.quantity} onChange={e=>setQuote(index,{quantity:Number(e.target.value)})}/>}
                  {preview?<span className="text-xs">{money(item.unitPrice)}</span>:<input className={field} type="number" min="0" step=".01" aria-label="Unit price" disabled={locked}
                    value={item.unitPrice} onChange={e=>setQuote(index,{unitPrice:Number(e.target.value)})}/>}
                </div>:<>
                  {preview?<p className="mb-4 text-sm font-semibold">{item.title}</p>:<input className={field+" mb-4 max-w-sm"} disabled={locked}
                    aria-label="Selection group title" placeholder="e.g. Packages" value={item.title}
                    onChange={e=>setQuote(index,{title:e.target.value})}/>}
                  <p className="mb-4 text-[11px] text-[#888]">{item.type==="selection"?"Client must select one option":"Client may select any options"}</p>
                  {item.options.map((option,optionIndex)=><div className="mb-3 grid grid-cols-[22px_minmax(0,1fr)_55px_100px] items-start gap-2 sm:grid-cols-[22px_minmax(0,1fr)_70px_115px]" key={option.id}>
                    <input type={item.type==="selection"?"radio":"checkbox"} disabled={!preview||locked}
                      checked={item.type==="selection"?previewSelections[item.id]===option.id:
                        Array.isArray(previewSelections[item.id])&&(previewSelections[item.id] as string[]).includes(option.id)}
                      name={item.type==="selection"?item.id:undefined}
                      onChange={()=>changePreviewChoice(item.id,option.id,item.type==="optional")} className="mt-3 accent-[#19bca5]"/>
                    <div className="space-y-2">
                      {preview?<><p className="text-xs font-semibold">{option.name||"Item"}</p><p className="text-[11px] text-[#777]">{option.description}</p></>:
                        <><input className={field} disabled={locked} value={option.name} placeholder="Option name"
                          onChange={e=>setOption(index,optionIndex,{name:e.target.value})}/>
                        <input className={field} disabled={locked} value={option.description} placeholder="Option description"
                          onChange={e=>setOption(index,optionIndex,{description:e.target.value})}/></>}
                    </div>
                    {preview?<span className="mt-3 text-xs">{option.quantity}</span>:
                      <input className={field} type="number" min=".01" step=".01" disabled={locked}
                        aria-label="Option quantity" value={option.quantity}
                        onChange={e=>setOption(index,optionIndex,{quantity:Number(e.target.value)})}/>}
                    <div className="flex items-center gap-1">
                      {preview?<span className="mt-3 text-xs">{money(option.unitPrice)}</span>:
                        <><input className={field} type="number" min="0" step=".01" disabled={locked}
                          aria-label="Option unit price" value={option.unitPrice}
                          onChange={e=>setOption(index,optionIndex,{unitPrice:Number(e.target.value)})}/>
                        {!locked&&item.options.length>1&&<button type="button" aria-label="Remove option" onClick={()=>
                          setQuote(index,{options:item.options.filter((_,j)=>j!==optionIndex)})}><X className="size-4 text-[#aaa]"/></button>}</>}
                    </div>
                  </div>)}
                  {!preview&&!locked&&item.options.length<25&&<button type="button"
                    className="flex items-center gap-2 text-xs text-[#17ad99]" onClick={()=>setQuote(index,{options:[
                      ...item.options,{id:newQuoteId(),name:"",description:"",quantity:1,unitPrice:0},
                    ]})}><Plus className="size-4"/>Add option</button>}
                </>}
              </div>)}
            </>}
            {!preview&&!locked&&items.length>0&&<div className="relative mt-5">
              <button type="button" onClick={()=>setAddQuoteItem(!addQuoteItem)}
                className="flex items-center gap-1 text-xs font-semibold text-[#18ad99]">
                <Plus className="size-4"/> Add Item <ChevronDown className="size-3"/></button>
              {addQuoteItem&&<div className="absolute top-7 z-10 min-w-[200px] border bg-white p-2 shadow-lg">
                {(["standard","selection","optional"] as const).map(type=><button type="button" key={type}
                  className="block w-full px-4 py-3 text-left text-xs hover:bg-[#f3f3f3]"
                  onClick={()=>{setItems(old=>[...old,createQuoteItem(type)]);setAddQuoteItem(false);markDirty();}}>
                  {type==="standard"?"Standard Item":type==="selection"?"Client Selection":"Optional Items"}
                </button>)}
              </div>}
            </div>}
            <div className="mt-6 ml-auto max-w-[275px] space-y-4 text-xs">
              <div className="flex justify-between"><span>Subtotal</span>
                <span>{items.some(x=>x.type!=="standard")&&!preview?"From ":""}{money(preview?previewTotals.subtotal:totals.subtotal)}</span></div>
              {!preview&&<div className="grid grid-cols-[1fr_75px] items-center gap-2">
                <label htmlFor="quote-discount">Add discount %</label><input id="quote-discount" className={field} disabled={locked}
                  min="0" max="100" step=".01" type="number" value={discount} onChange={e=>{setDiscount(Number(e.target.value));markDirty();}}/>
                <label htmlFor="quote-tax">Add tax %</label><input id="quote-tax" className={field} disabled={locked}
                  min="0" max="100" step=".01" type="number" value={tax} onChange={e=>{setTax(Number(e.target.value));markDirty();}}/>
              </div>}
              {(discount>0||preview)&&<div className="flex justify-between"><span>Discount {discount}%</span><span>-{money(preview?previewTotals.discount:totals.discount)}</span></div>}
              {(tax>0||preview)&&<div className="flex justify-between"><span>Tax {tax}%</span><span>{money(preview?previewTotals.tax:totals.tax)}</span></div>}
              <div className="flex justify-between border-t border-[#ddd] pt-4 text-sm font-semibold">
                <span>Total</span><span>{items.some(x=>x.type!=="standard")&&!preview?"From ":""}{money(preview?previewTotals.total:totals.total)}</span>
              </div>
            </div>
            <div className="mt-12">
              <h3 className="text-xs font-semibold">Notes</h3>
              {preview?<p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-[#777]">{notes}</p>:
                <textarea className={textarea+" mt-3 max-w-[340px]"} disabled={locked} value={notes}
                  onChange={e=>{setNotes(e.target.value);markDirty();}}/>}
            </div>
          </div>}
          {kind==="questionnaire"&&preview&&
            <p className="mt-7 text-center text-xs text-[#888]">Preview only · The client completes these questions through the secure shared link.</p>}
        </div>}
      </section>
    </div>
  </main>;
}

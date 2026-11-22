"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import type {JSONContent} from "@tiptap/core";
import {
  ArrowLeft, Bold, Check, ChevronDown, Eye, FileCheck2,
  Italic, Link2, List, ListOrdered, Loader2, Minus, Palette,
  Printer, Quote, Redo2, Save, Send, Strikethrough, Underline as UnderlineIcon,
  Undo2, UserRound,
} from "lucide-react";
import {toast} from "sonner";
import {
  studioCreate, studioDelete, studioDetail, studioList, studioSendContract, studioUpdate,
  type StudioRecord,
} from "@/actions/studio";
import {
  CONTRACT_PRESETS, contractDocPlainText,
  textContractDoc, type ContractVariables,
} from "./studio-contract-presets";
import {CONTRACT_DOC_STYLE} from "./studio-contract-reader";
import {StudioPublic} from "./studio-public";
import {StudioSignaturePad,type StudioSignature} from "./studio-signature";
import {listenForStudioPreviewSave,openStudioClientPreview} from "./studio-client-preview";
import {copyStudioPublicLink,previewStudioPublicDraft} from "./studio-public-links";

const FIELD="min-h-10 w-full border border-[#e6e1eb] bg-white px-3 text-[13px] outline-none focus:border-[#6337d8]";
const SECONDARY="inline-flex min-h-10 items-center justify-center gap-2 border border-[#ebe6f0] px-4 text-xs font-semibold text-[#453d4d] hover:bg-[#faf8fd] disabled:opacity-50";
const PRIMARY="inline-flex min-h-10 items-center justify-center gap-2 bg-[#6337d8] px-4 text-xs font-semibold text-white hover:bg-[#5129b6] disabled:opacity-50";
const starter=CONTRACT_PRESETS[0];

type EditorStatus="idle"|"saving"|"saved"|"error";
type TemplateOption={id:string;title:string;description:string;contentDoc:JSONContent;defaultStudioSignature?:StudioSignature|null};

function baseVariables(project:StudioRecord|null,client:StudioRecord|null,studio:StudioRecord|null):ContractVariables {
  const eventDate=project?.date?new Date(project.date):null;
  return {
    client_name:client?.title||"",
    client_email:client?.email||"",
    photographer_name:String(studio?.details?.company||""),
    photographer_email:String(studio?.details?.email||""),
    project_title:project?.title||"",
    event_date:eventDate&&!Number.isNaN(eventDate.getTime())?eventDate.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}):"",
    location:String(project?.details?.location||""),
    fee:"",
    today:new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}),
  };
}
const VARIABLE_LABELS: Array<[keyof ContractVariables,string]>=[
  ["client_name","Client name"],["client_email","Client email"],
  ["photographer_name","Photographer / Studio"],["photographer_email","Studio email"],
  ["project_title","Project name"],["event_date","Event date"],
  ["location","Location"],["fee","Project fee"],["today","Agreement date"],
];

function ToolbarButton({title,active,disabled,onClick,children}:{
  title:string;active?:boolean;disabled?:boolean;onClick:()=>void;children:React.ReactNode;
}) {
  return <button type="button" title={title} aria-label={title} aria-pressed={active}
    disabled={disabled} onClick={onClick}
    className={"grid size-9 shrink-0 place-items-center text-[#504958] hover:bg-[#f1ecfa] disabled:opacity-35 "+
      (active?"bg-[#eee8fb] !text-[#6337d8]":"")}>{children}</button>;
}

/**
 * Rich editor stores schema-safe TipTap JSON, never arbitrary HTML. The backend
 * validates every node and link before a draft can be saved or sent.
 */
export function StudioContractEditor({
  initial,project,client,contacts,projects,studio,asTemplate=false,onClose,onSaved,
}:{
  initial?:StudioRecord|null;
  project?:StudioRecord|null;
  client?:StudioRecord|null;
  contacts:StudioRecord[];
  projects:StudioRecord[];
  studio?:StudioRecord|null;
  asTemplate?:boolean;
  onClose:()=>void;
  onSaved:(record:StudioRecord)=>Promise<void>;
}){
  const [record,setRecord]=useState<StudioRecord|null>(initial||null);
  const templateMode=asTemplate||initial?.kind==="templates";
  const [projectId,setProjectId]=useState(initial?.projectId||project?._id||"");
  const linkedProject=projects.find(p=>p._id===projectId)||(project?._id===projectId?project:null);
  const [contactId,setContactId]=useState(initial?.contactId||client?._id||linkedProject?.contactId||"");
  const [otherContacts,setOtherContacts]=useState<StudioRecord[]>([]);
  const contactOptions=useMemo(()=>{
    const seen=new Set<string>();
    return [...contacts,...otherContacts,...(client?[client]:[])].filter(c=>{
      if(seen.has(c._id))return false;
      seen.add(c._id);return true;
    });
  },[contacts,otherContacts,client]);
  const chosenClient=contactOptions.find(c=>c._id===contactId)||null;
  const [title,setTitle]=useState(initial?.title||starter.documentTitle);
  const [description,setDescription]=useState(initial?.description||"");
  const [doc,setDoc]=useState<JSONContent>(
    initial?.details?.contentDoc?.type==="doc"?initial.details.contentDoc:
      initial?.details?.content?textContractDoc(String(initial.details.content)):starter.contentDoc,
  );
  const [variables,setVariables]=useState<ContractVariables>(()=>({
    ...baseVariables(linkedProject,chosenClient,studio||null),
    ...(initial?.details?.variables||{}),
  }));
  const [accent,setAccent]=useState<string>(
    /^#[0-9a-f]{6}$/i.test(String(initial?.details?.accentColor||""))
      ?String(initial?.details?.accentColor):"#6337d8",
  );
  const [selectedTemplate,setSelectedTemplate]=useState(starter.id);
  const [defaultStudioSignature,setDefaultStudioSignature]=useState<StudioSignature|null>((initial?.details?.defaultStudioSignature||null) as StudioSignature|null);
  const [savedTemplates,setSavedTemplates]=useState<TemplateOption[]>([]);
  const [status,setStatus]=useState<EditorStatus>(initial?"saved":"idle");
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  // Show the resolved agreement first (including Project Details entry points).
  // Template editing remains available via the "Edit Contract" control.
  const [preview,setPreview]=useState(true);
  const [designOpen,setDesignOpen]=useState(false);
  const [showActions,setShowActions]=useState(false);
  const [showVariables,setShowVariables]=useState(false);
  const [showTemplates,setShowTemplates]=useState(false);
  const changingRef=useRef(0);
  const savingRef=useRef(false);
  const closedRef=useRef(false);
  const previewUnsubscribeRef=useRef<(()=>void)|null>(null);
  const previewRevisionRef=useRef(0);
  const readonly=Boolean(record&&!templateMode&&record.status!=="draft");
  const studioSignature=record?.details?.studioSignature as StudioSignature|null|undefined;
  const ownerSignedDraft=Boolean(!readonly&&!templateMode&&studioSignature);

  const markDirty=useCallback(()=>{
    changingRef.current++;
    setDirty(true);
    setStatus("idle");
  },[]);
  const editor=useEditor({
    extensions:[StarterKit,Underline,Link.configure({openOnClick:false,autolink:false})],
    content:doc,
    editable:!readonly,
    immediatelyRender:false,
    onUpdate:({editor:active})=>{
      setDoc(active.getJSON());
      markDirty();
    },
  });
  useEffect(()=>{
    if(editor&&!editor.isDestroyed)editor.setEditable(!readonly&&!ownerSignedDraft&&!preview);
  },[editor,readonly,ownerSignedDraft,preview]);

  useEffect(()=>{
    let live=true;
    void studioList("templates",{limit:250}).then(result=>{
      if(live)setSavedTemplates(result.items.filter(t=>t.type==="contract").map(t=>({
        id:t._id,title:t.title,
        description:t.description||"Saved Studio Manager template",
        contentDoc:t.details?.contentDoc?.type==="doc"?t.details.contentDoc:textContractDoc(String(t.details?.content||"")),
        defaultStudioSignature:(t.details?.defaultStudioSignature||null) as StudioSignature|null,
      })));
    }).catch(()=>undefined);
    return ()=>{live=false;};
  },[]);

  useEffect(()=>{
    if(!contactId||contactOptions.some(c=>c._id===contactId))return;
    let active=true;
    void studioDetail("contacts",contactId).then(contact=>{
      if(!active)return;
      setOtherContacts(existing=>existing.some(c=>c._id===contact._id)?existing:[contact,...existing]);
      setVariables(current=>({
        ...current,
        client_name:contact.title,
        client_email:contact.email,
      }));
      setPreview(true);
    }).catch(()=>undefined);
    return ()=>{active=false;};
  },[contactId,contactOptions]);

  const presetOptions=useMemo<TemplateOption[]>(()=>[
    ...CONTRACT_PRESETS.map(t=>({id:t.id,title:t.title,description:t.description,contentDoc:t.contentDoc})),
    ...savedTemplates,
  ],[savedTemplates]);

  const setVar=(key:string,value:string)=>{
    setVariables(previous=>({...previous,[key]:value}));
    markDirty();
  };
  const selectContact=(id:string)=>{
    setContactId(id);
    const next=contactOptions.find(c=>c._id===id);
    if(next){
      setVariables(current=>({...current,client_name:next.title,client_email:next.email}));
      setPreview(true);
    } else setVariables(current=>({...current,client_name:"",client_email:""}));
    markDirty();
  };
  const selectProject=(id:string)=>{
    setProjectId(id);
    const next=projects.find(p=>p._id===id)||(project?._id===id?project:null);
    if(next){
      const event=next.date?new Date(next.date):null;
      setVariables(current=>({
        ...current,
        project_title:next.title,
        event_date:event&&!Number.isNaN(event.getTime())
          ?event.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}):"",
        location:String(next.details?.location||""),
      }));
      if(next.contactId)selectContact(next.contactId);
      else selectContact("");
      setPreview(true);
    }
    markDirty();
  };
  const changeTemplate=(key:string)=>{
    const next=presetOptions.find(t=>t.id===key);
    if(!next)return;
    if(dirty&&!window.confirm("Replace the document content with "+next.title+"? Unsaved wording in this editor will be replaced."))return;
    setSelectedTemplate(key);
    setShowTemplates(false);
    setTitle(next.title);
    setDefaultStudioSignature(next.defaultStudioSignature||null);
    editor?.commands.setContent(next.contentDoc);
    setDoc(next.contentDoc);
    markDirty();
  };
  const insertVariable=(key:string)=>{
    editor?.chain().focus().insertContent("{{"+key+"}}").run();
    setShowVariables(false);
  };

  const payload=(signatureOverride?:StudioSignature|null):Record<string,unknown>=>({
    title:title.trim()||"Photography Agreement",
    type:"contract",status:templateMode?"active":"draft",description:description.trim(),
    ...(templateMode?{}:{
      contactId,projectId,
      email:variables.client_email?.trim()||"",
    }),
    details:{
      contentDoc:doc,
      content:contractDocPlainText(doc).slice(0,20000),
      ...(templateMode?{}:{
        variables,
        photographerName:variables.photographer_name||"",
        photographerEmail:variables.photographer_email||"",
        clientSignerName:variables.client_name||"",
        clientSignerEmail:variables.client_email||"",
        studioSignature:signatureOverride===undefined?(studioSignature||null):signatureOverride,
        studioSignatureDraft:defaultStudioSignature,
        studioSignerName:signatureOverride===null?"":String(variables.photographer_name||""),
      }),
      accentColor:accent,
      ...(templateMode?{defaultStudioSignature}:{}),
    },
  });
  const saveDraft=async(signatureOverride?:StudioSignature|null):Promise<StudioRecord|null>=>{
    if(savingRef.current)return record;
    if(readonly)return record;
    if(!templateMode&&(!contactId||!variables.client_email?.trim())){
      setError("Choose a client with an email address before saving the contract.");
      setStatus("error");
      return null;
    }
    if(!title.trim()){setError("A contract name is required.");setStatus("error");return null;}
    savingRef.current=true;
    const revision=changingRef.current;
    setBusy(true);setStatus("saving");setError("");
    try{
      const input=payload(signatureOverride);
      const saveKind=templateMode?"templates":"documents";
      const saved=record?
        await studioUpdate(saveKind,record._id,input):
        await studioCreate(saveKind,input);
      setRecord(saved);
      if(changingRef.current===revision){setDirty(false);setStatus("saved");}
      else setStatus("idle");
      await onSaved(saved);
      return saved;
    }catch(err){
      const message=err instanceof Error?err.message:"Could not save contract";
      setError(message);setStatus("error");
      return null;
    }finally{
      savingRef.current=false;
      setBusy(false);
    }
  };
  // Existing drafts auto-save after the user stops editing. First creation
  // requires clicking Save Draft, avoiding accidental empty documents.
  useEffect(()=>{
    if(!record||(!templateMode&&record.status!=="draft")||ownerSignedDraft||!dirty||busy)return;
    const t=window.setTimeout(()=>{void saveDraft();},1200);
    return ()=>window.clearTimeout(t);
    // saveDraft is deliberately captured from the latest render with the values
    // in the dependency list; auto-save is not triggered on an idle form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[record?._id,record?.status,doc,title,description,variables,accent,contactId,defaultStudioSignature,dirty,busy,templateMode,ownerSignedDraft]);

  const send=async()=>{
    if(templateMode){toast.error("Save the template, then use it to create a client contract.");return;}
    if(readonly){toast.info("This contract has already been sent.");return;}
    if(!window.confirm("Send this contract to "+(variables.client_email||"your client")+"? Once sent, the document text is locked to protect the client's acknowledgement."))return;
    let saved=record;
    if(!saved||dirty){saved=await saveDraft();}
    if(!saved)return;
    setBusy(true);setError("");
    try{
      const result=await studioSendContract(saved._id);
      setRecord(result.record);
      setDirty(false);setStatus("saved");
      await onSaved(result.record);
      toast.success("Contract sent to the client");
      setPreview(true);
    }catch(err){setError(err instanceof Error?err.message:"Could not send contract");}
    finally{setBusy(false);}
  };
  const saveTemplate=async()=>{
    setShowActions(false);setBusy(true);setError("");
    try{
      const t=await studioCreate("templates",{
        title:(title.trim()||"Photography Agreement")+" Template",
        type:"contract",status:"active",description:"Custom reusable photography contract",
        details:{
          contentDoc:doc,content:contractDocPlainText(doc).slice(0,20000),
          accentColor:accent,
          defaultStudioSignature,
        },
      });
      setSavedTemplates(old=>[...old,{id:t._id,title:t.title,description:t.description,contentDoc:doc,defaultStudioSignature}]);
      toast.success("Saved in Studio Manager → Templates");
    }catch(err){setError(err instanceof Error?err.message:"Could not save template");}
    finally{setBusy(false);}
  };
  const duplicate=async()=>{
    setShowActions(false);setBusy(true);
    try{
      const copy=await studioCreate(templateMode?"templates":"documents",{
        ...payload(null),title:title.trim()+" (Copy)",status:templateMode?"active":"draft",
      });
      setRecord(copy);setTitle(copy.title);setDirty(false);setStatus("saved");
      await onSaved(copy);
      toast.success("Saved a new contract copy");
    }catch(err){setError(err instanceof Error?err.message:"Could not duplicate contract");}
    finally{setBusy(false);}
  };
  const removeDraft=async()=>{
    setShowActions(false);
    if(!record||(!templateMode&&record.status!=="draft"))return;
    if(!window.confirm("Permanently delete this "+(templateMode?"contract template":"contract draft")+"?"))return;
    setBusy(true);
    try{
      await studioDelete(templateMode?"templates":"documents",record._id);
      toast.success(templateMode?"Contract template deleted":"Contract draft deleted");
      closedRef.current=true;
      onClose();
    }catch(err){setError(err instanceof Error?err.message:"Could not delete contract");setBusy(false);}
  };
  const close=()=>{
    if(busy)return;
    if(dirty&&!window.confirm("You have unsaved changes. Close the contract editor anyway?"))return;
    closedRef.current=true;
    onClose();
  };
  const copyLink=async()=>{
    setShowActions(false);
    if(!record?._id||templateMode){
      toast.error("Save this contract draft first");
      return;
    }
    try{
      await copyStudioPublicLink("documents",record._id);
      toast.success("Public studio link copied. Draft links are view-only until sent.");
    }catch(err){toast.error(err instanceof Error?err.message:"Could not copy studio link.");}
  };
  const print=()=>{
    setPreview(true);
    // Print from browser using the existing window print control.
    window.setTimeout(()=>window.print(),100);
  };
  const toolbarDisabled=busy||readonly||ownerSignedDraft||preview||!editor;
  const toolbar=[
    {icon:Bold,label:"Bold",active:editor?.isActive("bold"),command:()=>editor?.chain().focus().toggleBold().run()},
    {icon:Italic,label:"Italic",active:editor?.isActive("italic"),command:()=>editor?.chain().focus().toggleItalic().run()},
    {icon:UnderlineIcon,label:"Underline",active:editor?.isActive("underline"),command:()=>editor?.chain().focus().toggleUnderline().run()},
    {icon:Strikethrough,label:"Strikethrough",active:editor?.isActive("strike"),command:()=>editor?.chain().focus().toggleStrike().run()},
    {icon:List,label:"Bulleted list",active:editor?.isActive("bulletList"),command:()=>editor?.chain().focus().toggleBulletList().run()},
    {icon:ListOrdered,label:"Numbered list",active:editor?.isActive("orderedList"),command:()=>editor?.chain().focus().toggleOrderedList().run()},
    {icon:Quote,label:"Quote",active:editor?.isActive("blockquote"),command:()=>editor?.chain().focus().toggleBlockquote().run()},
    {icon:Minus,label:"Horizontal line",active:false,command:()=>editor?.chain().focus().setHorizontalRule().run()},
    {icon:Undo2,label:"Undo",active:false,command:()=>editor?.chain().focus().undo().run()},
    {icon:Redo2,label:"Redo",active:false,command:()=>editor?.chain().focus().redo().run()},
  ];
  const setLink=()=>{
    const href=window.prompt("Paste a full https:// link");
    if(!href)return;
    try{
      const url=new URL(href);
      if(!["http:","https:","mailto:"].includes(url.protocol))throw Error("Unsafe link");
      editor?.chain().focus().setLink({href:url.toString()}).run();
    }catch{toast.error("Use a valid http, https or mailto URL");}
  };
  const statusLabel=status==="saving"?"Saving…":status==="saved"?"All changes saved":
    status==="error"?"Not saved":dirty?"Unsaved changes":"Save a draft to begin";
  const pill=templateMode?"TEMPLATE":record?.status==="in-progress"?"SENT":record?.status==="completed"?"SIGNED":"DRAFT";
  useEffect(()=>()=>{previewUnsubscribeRef.current?.();},[]);
  const openClientPreview=()=>{
    try{
      const id=openStudioClientPreview("contract",{
        title,description,content:contractDocPlainText(doc),contentDoc:doc,variables,
        status:record?.status==="completed"?"completed":"in-progress",
        signerName:String(record?.details?.signerName||""),
        signedAt:String(record?.details?.signedAt||""),
        clientSignature:(record?.details?.clientSignature||null) as StudioSignature|null,
        photographerName:variables.photographer_name,accentColor:accent,
        studioSignature:studioSignature||null,
        studioSignerName:String(record?.details?.studioSignerName||variables.photographer_name||""),
        studioSignedAt:String(record?.details?.studioSignedAt||""),
      },{
        recordId:templateMode?undefined:record?._id,
        baseUpdatedAt:templateMode?undefined:record?.updatedAt,
        canSign:!templateMode&&!readonly,
        draft:payload(),
      });
      previewRevisionRef.current=changingRef.current;
      previewUnsubscribeRef.current?.();
      previewUnsubscribeRef.current=listenForStudioPreviewSave(id,recordId=>{
        void studioDetail("documents",recordId).then(next=>{
          setRecord(next);
          setPreview(true);
          if(changingRef.current===previewRevisionRef.current){
            setDirty(false);setStatus("saved");
            toast.success("Studio signature synced from the preview tab.");
          }else{
            setStatus("error");
            setError("Your draft changed while Preview was open. The preview signature was saved to the earlier version. Close and reopen this contract before editing or sending.");
            toast.error("The preview tab saved an earlier contract. Reopen the editor to sync.");
          }
          void onSaved(next);
        }).catch(()=>toast.error("Studio signature saved. Reopen the contract to refresh this editor."));
      });
    }catch(err){toast.error(err instanceof Error?err.message:"Could not open the preview tab.");}
  };

  return <div className="fixed inset-0 z-[140] flex flex-col bg-white text-[#27232d]" role="dialog" aria-label="Contract editor" aria-modal="true">
    <header className="flex h-[65px] shrink-0 items-center justify-between gap-4 border-b border-[#ece9ee] px-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={close} type="button" aria-label="Close contract editor" className="rounded p-1.5 hover:bg-[#f4f1f7]"><ArrowLeft className="size-5"/></button>
        <div className="min-w-0">
          <input aria-label="Contract title" maxLength={220} disabled={readonly||ownerSignedDraft||busy} className="w-full min-w-[120px] bg-transparent text-[16px] font-semibold outline-none focus:text-[#6337d8] sm:text-lg"
            value={title} onChange={e=>{setTitle(e.target.value);markDirty();}}/>
          {linkedProject&&<p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-medium text-[#6337d8]"><FileCheck2 className="size-3"/>{linkedProject.title}</p>}
        </div>
        <span className={"hidden rounded-full px-3 py-1 text-[10px] font-bold sm:inline-flex "+
          (pill==="SIGNED"?"bg-green-50 text-green-700":pill==="SENT"?"bg-blue-50 text-blue-700":"bg-[#f4f3f6] text-[#6f6876]")}>{pill}</span>
        <span role="status" className="hidden items-center gap-1 text-[11px] text-[#99929d] lg:flex">
          {status==="saving"&&<Loader2 className="size-3 animate-spin"/>}
          {status==="saved"&&<Check className="size-3 text-[#5a956d]"/>}{statusLabel}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="relative">
          <button onClick={()=>setShowActions(!showActions)} className="flex min-h-10 items-center gap-1 px-2 text-xs font-semibold">Actions <ChevronDown className="size-3"/></button>
          {showActions&&<div className="absolute right-0 top-full z-40 w-52 border border-[#ece8f0] bg-white py-1 shadow-lg">
            <button className="block w-full px-4 py-3 text-left text-xs hover:bg-[#f8f5fe]" onClick={()=>void saveTemplate()}>Save as reusable template</button>
            <button className="block w-full px-4 py-3 text-left text-xs hover:bg-[#f8f5fe]" onClick={()=>void duplicate()}>Duplicate as draft</button>
            {!templateMode&&<button className="block w-full px-4 py-3 text-left text-xs hover:bg-[#f8f5fe]" onClick={()=>void copyLink()}>Copy signing link</button>}
            {((templateMode&&record)||record?.status==="draft")&&<button className="block w-full px-4 py-3 text-left text-xs text-red-600 hover:bg-red-50" onClick={()=>void removeDraft()}>{templateMode?"Delete template":"Delete draft"}</button>}
          </div>}
        </div>
        <button disabled={readonly||ownerSignedDraft} onClick={()=>{setDesignOpen(!designOpen);setPreview(false)}} className="hidden px-2 text-xs font-semibold hover:text-[#6337d8] disabled:opacity-40 sm:inline-flex">Edit Design</button>
        {preview&&!readonly&&!ownerSignedDraft&&<button type="button"
          onClick={()=>setPreview(false)} className="px-3 py-2 text-xs font-semibold text-[#6b6270] hover:text-[#6337d8]">
          Edit Contract</button>}
        <button type="button" disabled={busy} onClick={()=>{
          if(templateMode){openClientPreview();return;}
          void previewStudioPublicDraft("documents",async()=>{
            if(record&&!dirty)return record;
            return saveDraft();
          }).catch(e=>toast.error(e instanceof Error?e.message:"Could not open public preview."));
        }} className="inline-flex items-center gap-2 rounded border border-[#e9e2f2] px-3 py-2 text-xs font-semibold text-[#6337d8] hover:bg-[#f8f5fd] disabled:opacity-50">
          <Eye className="size-4"/>Preview</button>
        {!templateMode&&!readonly&&<button type="button" disabled={busy}
          onClick={openClientPreview}
          className="hidden px-2 text-[11px] font-semibold text-[#7054a0] hover:underline xl:inline-flex">
          Sign as Studio Owner</button>}
        {!templateMode&&!readonly&&<button type="button" disabled={busy}
          onClick={()=>void saveDraft()} className={SECONDARY+" h-[42px]"}>
          <Save className="size-4"/>Save Draft</button>}
        {templateMode?<button type="button" onClick={()=>void saveDraft()} disabled={busy} className={PRIMARY+" h-[42px]"}><Save className="hidden size-4 sm:inline"/>Save Template</button>:
        !readonly?<button type="button" onClick={()=>void send()} disabled={busy}
          className={PRIMARY+" h-[42px]"}><Send className="hidden size-4 sm:inline"/>Send Contract</button>:
          <span className="px-3 py-2 text-xs text-[#6e6579]">Sent · Editing locked</span>}
      </div>
    </header>

    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-[285px] shrink-0 overflow-y-auto border-r border-[#ece9ee] bg-white p-6 md:block xl:w-[305px]">
        <h2 className="mb-5 text-sm font-semibold">Signers & parties</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f0edf8] text-[#6337d8]"><UserRound className="size-4"/></span>
            <div className="min-w-0"><p className="truncate text-xs font-semibold">{variables.client_name||"Client signer"}</p><p className="truncate text-[11px] text-[#948e99]">{variables.client_email||"Add client email below"}</p></div>
          </div>
          <label className="block text-xs font-semibold">Client contact
            <select className={FIELD+" mt-2"} disabled={readonly||ownerSignedDraft} value={contactId} onChange={e=>selectContact(e.target.value)}>
              <option value="">Choose a client</option>
              {contactOptions.map(c=><option value={c._id} key={c._id}>{c.title}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold">Signer name<input className={FIELD+" mt-2"} maxLength={180} disabled={readonly||ownerSignedDraft}
            value={variables.client_name||""} onChange={e=>setVar("client_name",e.target.value)}/></label>
          <label className="block text-xs font-semibold">Signer email<input type="email" className={FIELD+" mt-2"} maxLength={180} disabled={readonly||ownerSignedDraft}
            value={variables.client_email||""} onChange={e=>setVar("client_email",e.target.value)}/></label>
          <div className="border-t border-[#eeebf1] pt-5">
            <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#faf1f0] text-[#ab635a]"><UserRound className="size-4"/></span>
              <div><p className="text-xs font-semibold">{variables.photographer_name||"Photographer / Studio"}</p><p className="text-[11px] text-[#948e99]">Studio party</p></div>
            </div>
            <label className="mt-4 block text-xs font-semibold">Photographer / studio name<input className={FIELD+" mt-2"} maxLength={180} disabled={readonly||ownerSignedDraft}
              value={variables.photographer_name||""} onChange={e=>setVar("photographer_name",e.target.value)}/></label>
            <label className="mt-4 block text-xs font-semibold">Studio email<input type="email" className={FIELD+" mt-2"} maxLength={180} disabled={readonly||ownerSignedDraft}
              value={variables.photographer_email||""} onChange={e=>setVar("photographer_email",e.target.value)}/></label>
            {templateMode&&<div className="mt-5 border-t border-[#eee9f1] pt-5"><h3 className="text-xs font-semibold">Default studio signature</h3><p className="mt-1 text-[11px] leading-5 text-[#928a98]">Save your signature once in this template. It will be prefilled in new contracts, and you can approve it for each agreement.</p><div className="mt-3"><StudioSignaturePad key={selectedTemplate} value={defaultStudioSignature} onChange={signature=>{setDefaultStudioSignature(signature);markDirty();}} label="Upload, draw or type your reusable signature"/></div></div>}
          </div>
        </div>
        <div className="mt-9 border-t border-[#eee9f1] pt-6">
          <h3 className="text-sm font-semibold">Contract details</h3>
          <p className="mt-2 text-[11px] leading-5 text-[#98919e]">These values fill placeholders within the contract.</p>
          {!templateMode&&<label className="mt-4 block text-xs font-semibold">Linked project
            <select className={FIELD+" mt-2"} disabled={readonly||ownerSignedDraft} value={projectId} onChange={e=>selectProject(e.target.value)}>
              <option value="">No project selected</option>
              {Array.from(new Map([...(linkedProject?[linkedProject]:[]),...projects].map(p=>[p._id,p])).values())
                .map(p=><option value={p._id} key={p._id}>{p.title}</option>)}
            </select>
          </label>}
          <label className="mt-4 block text-xs font-semibold">Internal summary
            <textarea className={FIELD+" mt-2 min-h-[78px] resize-y p-3"} disabled={readonly||ownerSignedDraft}
              maxLength={12000} value={description} onChange={e=>{setDescription(e.target.value);markDirty();}}
              placeholder="Description or internal context"/>
          </label>
          <label className="mt-4 block text-xs font-semibold">Project fee<input className={FIELD+" mt-2"} maxLength={160} disabled={readonly||ownerSignedDraft}
            value={variables.fee||""} onChange={e=>setVar("fee",e.target.value)} placeholder="e.g. EUR 250.00"/></label>
          <label className="mt-4 block text-xs font-semibold">Event date<input className={FIELD+" mt-2"} maxLength={100} disabled={readonly||ownerSignedDraft}
            value={variables.event_date||""} onChange={e=>setVar("event_date",e.target.value)}/></label>
          <label className="mt-4 block text-xs font-semibold">Location<input className={FIELD+" mt-2"} maxLength={250} disabled={readonly||ownerSignedDraft}
            value={variables.location||""} onChange={e=>setVar("location",e.target.value)}/></label>
        </div>
        <p className="mt-8 border-l-2 border-[#bda9eb] bg-[#f9f7fd] p-3 text-[11px] leading-5 text-[#786e85]">
          A client can record one typed acknowledgement after this contract is emailed.
          Multiple independent signatures, automated reminders and certified e-signatures are not enabled.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[#f3f3f5]">
        <div className="flex min-h-[56px] shrink-0 flex-wrap items-center gap-1 border-b border-[#e6e3ea] bg-white px-3 py-2 sm:px-5">
          <select aria-label="Paragraph style" title="Paragraph style" disabled={toolbarDisabled}
            className="mr-2 h-9 min-w-[125px] border border-[#eeeaf2] bg-white px-2 text-xs"
            value={editor?.isActive("heading",{level:1})?"h1":editor?.isActive("heading",{level:2})?"h2":editor?.isActive("heading",{level:3})?"h3":"p"}
            onChange={e=>{
              const value=e.target.value;
              if(value==="p")editor?.chain().focus().setParagraph().run();
              else editor?.chain().focus().setHeading({level:Number(value.slice(1)) as 1|2|3}).run();
            }}>
            <option value="p">Normal text</option><option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option><option value="h3">Heading 3</option>
          </select>
          {toolbar.map(({icon:Icon,label,active,command})=>
            <ToolbarButton key={label} title={label} active={active} disabled={toolbarDisabled} onClick={command}>
              <Icon className="size-4"/>
            </ToolbarButton>
          )}
          <ToolbarButton title="Insert link" disabled={toolbarDisabled} onClick={setLink}><Link2 className="size-4"/></ToolbarButton>
          <div className="relative ml-2">
            <button type="button" disabled={toolbarDisabled} onClick={()=>setShowVariables(!showVariables)}
              className="flex h-9 items-center gap-1 px-2 text-xs font-semibold hover:bg-[#f6f2fd] disabled:opacity-40">Insert Field <ChevronDown className="size-3"/></button>
            {showVariables&&<div className="absolute left-0 top-10 z-50 w-48 border border-[#eee7f3] bg-white p-1 shadow-xl">
              {VARIABLE_LABELS.map(([key,label])=><button key={key} className="block w-full px-3 py-2 text-left text-xs hover:bg-[#f6f2fd]" onClick={()=>insertVariable(key)}>{label}</button>)}
            </div>}
          </div>
          <div className="relative">
            <button type="button" onClick={()=>setShowTemplates(!showTemplates)}
              className="flex h-9 items-center gap-1 px-3 text-xs font-semibold hover:bg-[#f6f2fd]">
              Templates <ChevronDown className="size-3"/></button>
            {showTemplates&&<div className="absolute left-0 top-10 z-50 max-h-[330px] w-[280px] overflow-y-auto border border-[#eee7f3] bg-white p-1 shadow-xl">
              {presetOptions.map(p=><button key={p.id} type="button" onClick={()=>changeTemplate(p.id)} disabled={readonly}
                className={"block w-full px-3 py-3 text-left hover:bg-[#f7f3ff] disabled:opacity-50 "+(p.id===selectedTemplate?"bg-[#f4effe]":"")}>
                <span className="flex items-center justify-between text-xs font-semibold">{p.title}{p.id===selectedTemplate&&<Check className="size-3.5 text-[#6337d8]"/>}</span>
                <span className="mt-1 block text-[11px] text-[#918a98]">{p.description}</span>
              </button>)}
            </div>}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {error&&<p role="alert" className="mx-auto mb-4 max-w-[850px] border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {designOpen&&!preview&&<div className="mx-auto mb-5 flex max-w-[850px] flex-wrap items-center gap-5 border border-[#e4d9f4] bg-white p-4">
            <Palette className="size-5 text-[#6337d8]"/><span className="text-xs font-semibold">Document design</span>
            <label className="flex items-center gap-2 text-xs">Accent colour
              <input type="color" disabled={readonly||ownerSignedDraft} value={accent} onChange={e=>{setAccent(e.target.value);markDirty();}} className="size-9 cursor-pointer"/></label>
            <button type="button" onClick={()=>setDesignOpen(false)} className="ml-auto text-xs text-[#888]">Done</button>
          </div>}
          <div className={preview||readonly?
            "mx-auto w-full max-w-[1000px]":
            "mx-auto min-h-[830px] w-full max-w-[850px] bg-white px-7 py-10 shadow-[0_1px_15px_rgba(28,24,37,.08)] sm:px-[65px] sm:py-[65px]"}>
            {preview||readonly?
              <StudioPublic key={JSON.stringify(defaultStudioSignature)} kind="contract" token="" ownerPreview
                data={{
                  title,description,content:contractDocPlainText(doc),contentDoc:doc,variables,
                  status:record?.status==="completed"?"completed":"in-progress",
                  signerName:String(record?.details?.signerName||""),
                  signedAt:String(record?.details?.signedAt||""),
                  clientSignature:(record?.details?.clientSignature||null) as StudioSignature|null,
                  photographerName:variables.photographer_name,accentColor:accent,
                  studioSignature:studioSignature||null,
                  studioSignatureDraft:defaultStudioSignature,
                  studioSignerName:String(record?.details?.studioSignerName||variables.photographer_name||""),
                  studioSignedAt:String(record?.details?.studioSignedAt||""),
                }}
                onSaveStudioSignature={!templateMode&&!readonly&&!studioSignature?async signature=>{
                  if(!variables.photographer_name?.trim())
                    throw new Error("Enter the studio / photographer name in the left sidebar before signing.");
                  const saved=await saveDraft(signature);
                  if(!saved)throw new Error("Studio signature was not saved. Review any errors above and try again.");
                  toast.success("Your studio signature is saved on this contract draft.");
                }:undefined}
                onStudioSignerNameChange={!templateMode&&!readonly&&!studioSignature?
                  name=>setVar("photographer_name",name):undefined}
                onRemoveStudioSignature={!templateMode&&!readonly&&studioSignature?async()=>{
                  if(!window.confirm("Remove your studio signature? The contract can then be edited and signed again."))return;
                  const saved=await saveDraft(null);
                  if(!saved)throw new Error("Studio signature could not be removed.");
                  toast.success("Studio signature removed. You can edit the contract again.");
                }:undefined}
              />:
              <div className={CONTRACT_DOC_STYLE}>
                <div className="mb-6 flex items-center justify-between border-b pb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[.15em]" style={{color:accent}}>Agreement Editor · Live Preview available</p>
                  <span className="text-[10px] text-[#aaa]">Fully editable · Click to type</span>
                </div>
                <EditorContent editor={editor}/>
              </div>}
          </div>
          <p className="mx-auto mt-5 max-w-[850px] text-[11px] leading-6 text-[#aaa]">Starter contracts are editable examples, not legal advice. Review terms for your local laws and business needs before sending.</p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e5e0e8] bg-white px-5 py-3">
          <p className="hidden text-[11px] text-[#948e99] sm:block">{record?"Contract linked to Studio Manager":"Draft not yet created"}</p>
          <div className="ml-auto flex items-center gap-3">
            <button type="button" className={SECONDARY} onClick={print}><Printer className="size-4"/> Print preview</button>
            {!readonly&&<button type="button" className={PRIMARY} disabled={busy} onClick={()=>void saveDraft()}>
              {status==="saving"?<Loader2 className="size-4 animate-spin"/>:<Save className="size-4"/>}
              {busy?"Saving…":templateMode?"Save Template":"Save Draft"}
            </button>}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

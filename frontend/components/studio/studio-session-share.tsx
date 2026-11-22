"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Copy, Link2, Mail, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { studioCreate, studioCreateBookingInvite, studioDeleteBookingInvite, studioList, studioSendBookingInviteEmail, studioUpdate, type StudioBookings, type StudioRecord, type StudioSessionType } from "@/actions/studio";

const INPUT="h-11 w-full border border-[#e4e0ea] px-3 text-sm outline-none focus:border-[#6337d8]";
const OUT="inline-flex min-h-10 items-center justify-center gap-2 border border-[#e7e3ed] px-4 text-xs font-semibold hover:bg-[#faf8fc]";
const BTN="inline-flex min-h-10 items-center justify-center gap-2 bg-[#6337d8] px-5 text-xs font-semibold text-white hover:bg-[#5129be] disabled:opacity-50";
function validEmail(value:string){const at=value.indexOf('@');return at>0&&value.indexOf('.',at)>at+1&&!value.includes(' ');}
function bookingSiteUrl(identifier:string){
  const raw=String(process.env.NEXT_PUBLIC_ROOT_DOMAIN||"").trim();
  const host=raw.replace("https://","").replace("http://","").split("/")[0].split(":")[0].toLowerCase();
  if(host&&host!=="localhost"&&host!=="127.0.0.1")return "https://"+identifier+"."+host+"/book/"+encodeURIComponent(identifier);
  return window.location.origin+"/book/"+encodeURIComponent(identifier);
}
export function StudioSessionShare({
  service, data, onClose, onChanged,
}:{
  service:StudioSessionType;data:StudioBookings;
  onClose:()=>void;onChanged:()=>Promise<void>;
}) {
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [expiry,setExpiry]=useState(7);
  const [link,setLink]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [contactSearch,setContactSearch]=useState("");
  const [contactResults,setContactResults]=useState<StudioRecord[]>([]);
  const [contactOpen,setContactOpen]=useState(false);
  const [contactLoading,setContactLoading]=useState(false);
  const [selectedContact,setSelectedContact]=useState<StudioRecord|null>(null);
  const [showNewContact,setShowNewContact]=useState(false);
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [phone,setPhone]=useState("");
  const [contactBusy,setContactBusy]=useState(false);
  const contactArea=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!contactOpen||selectedContact||showNewContact)return;
    let live=true;
    const timer=window.setTimeout(()=>{
      setContactLoading(true);
      void studioList("contacts",{search:contactSearch.trim(),limit:20})
        .then(result=>{if(live)setContactResults(result.items);})
        .catch(()=>{if(live)setError("Could not load Contacts. Please try again.");})
        .finally(()=>{if(live)setContactLoading(false);});
    },220);
    return ()=>{live=false;window.clearTimeout(timer);};
  },[contactOpen,contactSearch,selectedContact,showNewContact]);
  useEffect(()=>{
    if(!contactOpen)return;
    const close=(event:PointerEvent)=>{if(!contactArea.current?.contains(event.target as Node))setContactOpen(false);};
    document.addEventListener("pointerdown",close);
    return ()=>document.removeEventListener("pointerdown",close);
  },[contactOpen]);
  const chooseContact=(contact:StudioRecord)=>{
    setSelectedContact(contact);setName(contact.title||"");setEmail(contact.email||"");
    setContactSearch("");setContactOpen(false);setShowNewContact(false);setError("");
  };
  const beginNewContact=()=>{
    const query=contactSearch.trim();
    const parts=query.includes("@")?[]:query.split(/\s+/);
    setFirstName(parts[0]||"");setLastName(parts.slice(1).join(" "));
    setEmail(query.includes("@")?query:"");setPhone("");setShowNewContact(true);
    setContactOpen(false);setError("");
  };
  const createContact=async(event:FormEvent)=>{
    event.preventDefault();
    if(contactBusy)return;
    const first=firstName.trim();const last=lastName.trim();const normalized=email.trim().toLowerCase();
    if(!first){setError("Enter the client’s first name.");return;}
    if(!validEmail(normalized)){setError("Enter a valid client email address.");return;}
    setContactBusy(true);setError("");
    try{
      const matches=await studioList("contacts",{search:normalized,limit:20});
      const existing=matches.items.find(item=>item.email?.toLowerCase()===normalized);
      if(existing){chooseContact(existing);toast.info("This email already exists in Contacts. We selected that contact.");return;}
      const contact=await studioCreate("contacts",{title:[first,last].filter(Boolean).join(" "),type:"client",status:"client",email:normalized,phone:phone.trim(),details:{firstName:first,lastName:last,source:"booking-invitation"}});
      chooseContact(contact);toast.success("Contact created and selected");
    }catch(e){setError(e instanceof Error?e.message:"Could not create contact");}
    finally{setContactBusy(false);}
  };
  const publicLink=typeof window!=="undefined"?bookingSiteUrl(data.publicIdentifier)+"?service="+encodeURIComponent(service._id):"";
  const invites=(data.shareLinks||[]).filter(item=>item.serviceId===service._id);
  const copy=async(url:string)=>{try{await navigator.clipboard.writeText(url);toast.success("Booking link copied");}catch{setError("Clipboard unavailable — select and copy the URL manually.");}};
  const create=async(sendByEmail=false)=>{
    if(!selectedContact){setError("Choose a client from Contacts or add a new contact first.");return;}
    if(!validEmail(email.trim())){setError("This contact needs a valid email address before you can create an invitation.");return;}
    setBusy(true);setError("");
    try {
      if(!selectedContact.email){
        const matches=await studioList("contacts",{search:email.trim(),limit:20});
        const duplicate=matches.items.find(item=>item._id!==selectedContact._id&&item.email?.toLowerCase()===email.trim().toLowerCase());
        if(duplicate){setError("That email already belongs to "+duplicate.title+". Select that contact instead.");return;}
        const updated=await studioUpdate("contacts",selectedContact._id,{email:email.trim().toLowerCase()});
        setSelectedContact(updated);
      }
      const result=await studioCreateBookingInvite({
        serviceId:service._id,contactId:selectedContact._id,recipientName:name.trim(),recipientEmail:email.trim(),
        sendEmail:sendByEmail,
        expiresAt:new Date(Date.now()+expiry*86400000).toISOString(),
        frontendOrigin:window.location.origin,
      });
      setLink(result.url);
      if(sendByEmail){
        if(result.emailSent)toast.success("Private invitation emailed to "+email.trim());
        else setError(result.emailError==="SMTP_NOT_CONFIGURED"?"The invitation link was created, but email is not configured on the backend. Set SMTP_HOST and SMTP_FROM, then restart the backend.":"The invitation link was created, but the mail server did not accept the email. Check SMTP settings and backend mail logs.");
      }else toast.success("Private booking link created");
      await onChanged();
    }catch(e){setError(e instanceof Error?e.message:"Could not create invitation");}
    finally{setBusy(false);}
  };
  const resend=async(id:string)=>{
    setBusy(true);setError("");
    try{
      const result=await studioSendBookingInviteEmail(id,window.location.origin);
      if(result.emailSent)toast.success("Invitation email sent successfully");
      else setError(result.emailError==="SMTP_NOT_CONFIGURED"?"Email is not configured on the backend. Set SMTP_HOST and SMTP_FROM, then restart the backend.":"The mail server did not accept the email. Check SMTP settings and backend mail logs.");
    }catch(e){setError(e instanceof Error?e.message:"Could not send invitation email");}
    finally{setBusy(false);}
  };
  const revoke=async(id:string)=>{
    if(!window.confirm("Revoke this private booking link?"))return;
    try{await studioDeleteBookingInvite(id);toast.success("Invitation revoked");await onChanged();}
    catch(e){setError(e instanceof Error?e.message:"Could not revoke invitation");}
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#1b1722]/55 p-4" role="dialog" aria-modal="true" aria-label={"Share "+service.name}>
    <div className="w-full max-w-2xl bg-white p-7 shadow-2xl sm:p-10">
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#958c9c]">Studio bookings</p><h2 className="mt-2 text-xl font-semibold">Share {service.name}</h2></div><button onClick={onClose} aria-label="Close"><X className="size-5"/></button></div>
      {service.bookingVisibility!=="private"&&<div className="mt-7 border border-[#ece8f0] bg-[#faf9fc] p-5">
        <h3 className="text-sm font-semibold">Public session link</h3>
        <p className="mt-2 break-all text-xs text-[#777]">{publicLink}</p>
        <button className={OUT+" mt-4"} onClick={()=>void copy(publicLink)}><Copy className="size-4"/> Copy public link</button>
      </div>}
      <div className="mt-7 space-y-5">
        <div><h3 className="text-sm font-semibold">Create private booking invitation</h3><p className="mt-2 text-xs leading-6 text-[#888]">Choose an existing client from Contacts, or add a new client. The invitation will be saved against that contact.</p></div>
        {!selectedContact ? <div ref={contactArea} className="relative space-y-3">
          <label className="block space-y-2 text-xs font-semibold">Choose a client from Contacts
            <input className={INPUT} value={contactSearch} onFocus={()=>setContactOpen(true)} onChange={e=>{setContactSearch(e.target.value);setContactOpen(true);setError("");}} placeholder="Search by client name or email…"/>
          </label>
          {contactOpen&&<div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto border border-[#e7e3ed] bg-white shadow-xl">
            {contactLoading?<p className="p-4 text-xs text-[#888]">Searching contacts…</p>:contactResults.length?contactResults.map(contact=><button type="button" key={contact._id} onClick={()=>chooseContact(contact)} className="flex w-full items-center justify-between gap-3 border-b border-[#f0edf3] px-4 py-3 text-left hover:bg-[#f8f5ff]"><span className="min-w-0"><span className="block truncate text-sm font-medium">{contact.title||"Unnamed contact"}</span><span className="mt-1 block truncate text-xs text-[#888]">{contact.email||"No email saved"}</span></span><span className="text-xs font-semibold text-[#6337d8]">Select</span></button>):<p className="p-4 text-xs text-[#888]">No matching contacts found.</p>}
          </div>}
          <button type="button" className={OUT} onClick={beginNewContact}><Plus className="size-4"/> Add new contact</button>
        </div> : <div className="flex flex-wrap items-center justify-between gap-3 border border-[#e7e3ed] bg-[#faf9fc] p-4">
          <div className="min-w-0"><p className="text-xs font-semibold text-[#6337d8]">Selected client</p><p className="mt-1 truncate text-sm font-semibold">{selectedContact.title}</p><p className="mt-1 truncate text-xs text-[#888]">{selectedContact.email||"No email saved on this contact"}</p></div>
          <button type="button" className={OUT} onClick={()=>{setSelectedContact(null);setName("");setEmail("");setContactSearch("");setContactOpen(true);}}>Change client</button>
        </div>}
        {showNewContact&&<form onSubmit={createContact} className="space-y-3 border border-[#e7e3ed] bg-[#faf9fc] p-4">
          <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Add a new contact</h4><button type="button" onClick={()=>setShowNewContact(false)} className="text-xs text-[#888]">Cancel</button></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2 text-xs font-semibold">First name<input className={INPUT} value={firstName} onChange={e=>setFirstName(e.target.value)} required placeholder="Jane"/></label><label className="block space-y-2 text-xs font-semibold">Last name<input className={INPUT} value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Smith"/></label><label className="block space-y-2 text-xs font-semibold sm:col-span-2">Email address<input className={INPUT} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="jane@example.com"/></label><label className="block space-y-2 text-xs font-semibold sm:col-span-2">Phone number (optional)<input className={INPUT} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 555 123 4567"/></label></div>
          <button type="submit" className={BTN} disabled={contactBusy}>{contactBusy?"Saving contact…":"Save & Select Contact"}</button>
        </form>}
        {selectedContact&&<div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-xs font-semibold">Client name<input className={INPUT} value={name} readOnly/></label>
          <label className="block space-y-2 text-xs font-semibold">Client email{selectedContact.email?<input className={INPUT} type="email" value={email} readOnly/>:<input className={INPUT} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Add an email for this contact"/>}</label>
        </div>}
        <label className="block max-w-xs space-y-2 text-xs font-semibold">Link expiry<select className={INPUT} value={expiry} onChange={e=>setExpiry(Number(e.target.value))}><option value={1}>1 day</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={OUT} disabled={busy||!selectedContact||!validEmail(email.trim())} onClick={()=>void create(false)}><Link2 className="size-4"/> Create link only</button>
          <button type="button" className={BTN} disabled={busy||!selectedContact||!validEmail(email.trim())} onClick={()=>void create(true)}><Mail className="size-4"/>{busy?"Sending…":"Create & Send Email"}</button>
        </div>
      </div>
      {link&&<div className="mt-6 border border-[#d8c8f9] bg-[#f9f6ff] p-5"><p className="text-xs font-semibold">New invitation link</p><p className="mt-2 break-all text-xs leading-6 text-[#655280]">{link}</p><button className={OUT+" mt-4"} onClick={()=>void copy(link)}><Copy className="size-4"/> Copy invitation link</button></div>}
      {invites.length>0&&<div className="mt-9 border-t pt-6"><h3 className="text-sm font-semibold">Existing invitations</h3>
        <div className="mt-4 divide-y">{invites.map(invite=><div key={invite._id} className="flex items-center justify-between gap-3 py-3 text-xs">
          <div><p className="font-medium">{invite.recipientName||invite.recipientEmail||"Private link"}</p><p className="mt-1 text-[#999]">{invite.bookingEventId?"Used":new Date(invite.expiresAt)<new Date()?"Expired":"Active"} · Expires {new Date(invite.expiresAt).toLocaleDateString()}</p></div>
          <div className="flex gap-3"><button onClick={()=>void copy(invite.url)} aria-label="Copy invitation"><Copy className="size-4 text-[#6337d8]"/></button><button disabled={busy||!invite.recipientEmail||Boolean(invite.bookingEventId)||new Date(invite.expiresAt)<new Date()} onClick={()=>void resend(invite._id)} aria-label="Send invitation email" title={invite.recipientEmail?"Send invitation email":"No client email saved"}><Mail className="size-4 text-[#159b86]"/></button><button onClick={()=>void revoke(invite._id)} aria-label="Revoke invitation"><Trash2 className="size-4 text-red-500"/></button></div>
        </div>)}</div>
      </div>}
      {error&&<p role="alert" className="mt-5 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  </div>;
}

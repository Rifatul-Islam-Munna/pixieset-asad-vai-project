"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import type { StudioKind, StudioRecord } from "@/actions/studio";

const INPUT = "h-11 w-full border border-[#e6e5eb] bg-white px-3 text-sm outline-none transition focus:border-[#6337d8]";
const TEXTAREA = "min-h-[110px] w-full resize-y border border-[#e6e5eb] bg-white px-3 py-3 text-sm outline-none focus:border-[#6337d8]";
const PURPLE = "inline-flex min-h-10 items-center justify-center gap-2 bg-[#6337d8] px-5 text-sm font-semibold text-white transition hover:bg-[#5124bf] disabled:opacity-50";
const BUTTON = "inline-flex min-h-10 items-center justify-center gap-2 border border-[#e3e1e8] px-4 text-sm font-medium text-[#31303a] hover:bg-[#f6f4fa]";

type FieldRow = { name: string; label: string; type: string; required: boolean; options?: string };
type InvoiceLine = { name: string; description: string; quantity: number; unitPrice: number };
type EditorProps = {
  kind: StudioKind;
  initial?: StudioRecord | null;
  defaults?: {contactId?:string;projectId?:string;email?:string};
  subtype?: string;
  contacts?: StudioRecord[];
  projects?: StudioRecord[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
};

function F({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <label className="block space-y-2 text-[12px] font-medium text-[#37343e]">
      <span>{label}</span>
      {children}
      {note && <span className="block text-[11px] font-normal text-[#92909a]">{note}</span>}
    </label>
  );
}

function toDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function StudioEditor({ kind, initial, defaults, subtype, contacts = [], projects = [], onSave, onClose }: EditorProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // The editor is shared by different Studio record kinds with distinct field shapes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<Record<string, any>>({});
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([{ name: "", description: "", quantity: 1, unitPrice: 0 }]);
  const [questions, setQuestions] = useState<FieldRow[]>([]);

  useEffect(() => {
    // Reset local editor inputs when switching between saved records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setForm({
      title: initial?.title || "",
      firstName: initial?.details?.firstName || (initial?.title || "").split(/\s+/)[0] || "",
      lastName: initial?.details?.lastName || (initial?.title || "").split(/\s+/).slice(1).join(" ") || "",
      description: initial?.description || "",
      status: initial?.status || "",
      type: initial?.type || subtype || (kind === "contacts" ? "client" : ""),
      email: initial?.email || defaults?.email || "",
      phone: initial?.phone || "",
      currency: initial?.currency || "EUR",
      amount: initial?.amount ?? 0,
      date: toDate(initial?.date),
      dueDate: toDate(initial?.dueDate),
      contactId: initial?.contactId || defaults?.contactId || "",
      projectId: initial?.projectId || defaults?.projectId || "",
      archived: Boolean(initial?.archived),
      company: initial?.details?.company || "",
      address: initial?.details?.address || "",
      address2: initial?.details?.address2 || "",
      state: initial?.details?.state || "",
      city: initial?.details?.city || "",
      country: initial?.details?.country || "",
      postcode: initial?.details?.postcode || "",
      location: initial?.details?.location || "",
      additionalClientIds: initial?.details?.additionalClientIds || [],
      content: initial?.details?.content || "",
      notes: initial?.details?.notes || "",
      discountPercent: initial?.details?.discountPercent || 0,
      taxPercent: initial?.details?.taxPercent || 0,
      buttonLabel: initial?.details?.buttonLabel || "Submit",
      successMessage: initial?.details?.successMessage || "Thank you for contacting us!",
      contactType: initial?.details?.contactType || "lead",
      code: initial?.details?.code || "",
      projectStages: (initial?.details?.projectStages || ["inquiry", "booked", "post-production", "completed"]).join(", "),
    });
    setInvoiceLines(
      initial?.details?.lines?.length ? initial.details.lines.map((x: InvoiceLine) => ({ ...x })) :
      [{ name: "", description: "", quantity: 1, unitPrice: 0 }],
    );
    setQuestions(
      initial?.details?.fields?.length ? initial.details.fields.map((x: FieldRow) => ({ ...x })) : [],
    );
  }, [initial, kind, subtype, defaults?.contactId, defaults?.email, defaults?.projectId]);

  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const total = useMemo(() => {
    const subtotal = invoiceLines.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0) * Math.max(0, Number(row.unitPrice) || 0), 0);
    const discount = subtotal * Math.max(0, Math.min(100, Number(form.discountPercent) || 0)) / 100;
    return Math.round((subtotal - discount) * (1 + Math.max(0, Math.min(100, Number(form.taxPercent) || 0)) / 100) * 100) / 100;
  }, [invoiceLines, form.discountPercent, form.taxPercent]);
  const isDocument = kind === "documents";
  const isQuestionnaire = isDocument && form.type === "questionnaire";
  const isQuote = isDocument && form.type === "quote";
  const isInvoice = kind === "invoices";
  const isForm = kind === "forms";
  const isTemplate = kind === "templates";
  const isSettings = kind === "settings";
  const isContact = kind === "contacts";
  const isProject = kind === "projects";
  const formTitle = kind === "contacts" ? "Contact" : kind === "projects" ? "Project" :
    kind === "forms" ? "Contact Form" : kind === "invoices" ? "Invoice" :
    kind === "documents" ? (form.type === "contract" ? "Contract" : form.type === "quote" ? "Quote" : "Questionnaire") :
    kind === "templates" ? "Template" : kind === "payment-links" ? "Payment Request" :
    kind === "discounts" ? "Discount" : kind === "settings" ? "Settings" : "Record";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: isContact ? [form.firstName, form.lastName].filter(Boolean).join(" ").trim() : form.title,
        description: form.description,
        type: form.type, email: form.email, phone: form.phone,
        contactId: form.contactId, projectId: form.projectId,
        currency: form.currency,
        ...(form.status ? { status: form.status } : {}),
        ...(form.date ? { date: form.date } : {}),
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        ...(kind === "projects" ? { archived: form.archived } : {}),
      };
      if (isContact) {
        if (!form.firstName?.trim()) throw new Error("First name is required");
        if (!form.email?.trim()) throw new Error("Email is required");
        payload.details = {
          firstName: form.firstName, lastName: form.lastName,
          company: form.company, address: form.address, address2: form.address2,
          city: form.city, state: form.state, country: form.country, postcode: form.postcode,
        };
        // Contact type is the first status, reflected in the tabs.
        payload.status = form.type || "client";
      } else if (isProject) {
        payload.details = {
          location: String(form.location || "").trim().slice(0, 240),
          additionalClientIds: (form.additionalClientIds || []).filter((id:string)=>id!==form.contactId),
        };
      } else if (isInvoice) {
        payload.details = {
          lines: invoiceLines.map((row) => ({
            name: row.name || "Service", description: row.description,
            quantity: Math.max(0.01, Number(row.quantity) || 1),
            unitPrice: Math.max(0, Number(row.unitPrice) || 0),
          })),
          discountPercent: Number(form.discountPercent) || 0,
          taxPercent: Number(form.taxPercent) || 0,
          notes: form.notes,
        };
      } else if (isForm) {
        payload.details = {
          buttonLabel: form.buttonLabel,
          successMessage: form.successMessage,
          contactType: form.contactType,
          fields: questions.map((row) => ({ ...row, name: row.name.trim() })),
        };
        // Saving a draft is distinct from publishing it.
        if (!initial) payload.status = "draft";
      } else if (isDocument || isTemplate) {
        payload.details = {
          content: form.content, notes: form.notes,
          ...(isQuestionnaire || (isTemplate && form.type === "questionnaire") ?
            { fields: questions.map((row) => ({ ...row, name: row.name.trim() })) } : {}),
          ...(isTemplate && form.type === "invoice" ? { lines: invoiceLines,
            discountPercent: Number(form.discountPercent) || 0, taxPercent: Number(form.taxPercent) || 0 } : {}),
        };
        if (isQuote || (isTemplate && form.type === "quote")) payload.amount = Number(form.amount) || 0;
      } else if (isSettings) {
        payload.details = {
          projectStageColors: initial?.details?.projectStageColors || {},
          projectStageLabels: initial?.details?.projectStageLabels || {},
          projectStages: String(form.projectStages || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 12),
          currency: form.currency, company: form.company, address: form.address,
          phone: form.phone, email: form.email,
        };
      } else if (kind === "discounts") {
        payload.details = { code: form.code, value: Number(form.amount) || 0, expiry: form.dueDate };
        payload.amount = Number(form.amount) || 0;
      } else if (kind === "payment-links") {
        payload.details = { notes: form.notes, kind: "manual-request" };
        payload.amount = Number(form.amount) || 0;
      }
      await onSave(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const field = (name: string, placeholder = "", type = "text") => (
    <input type={type} className={INPUT} value={form[name] ?? ""} placeholder={placeholder}
      onChange={(e) => set(name, type === "number" ? Number(e.target.value) : e.target.value)} />
  );
  const selection = (name: string, options: Array<[string, string]>) => (
    <select className={INPUT} value={form[name] ?? ""} onChange={(e) => set(name, e.target.value)}>
      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  );
  const contactOptions: Array<[string, string]> = [["", "No linked contact"], ...contacts.map((x) => [x._id, x.title] as [string, string])];
  const projectOptions: Array<[string, string]> = [["", "No linked project"], ...projects.map((x) => [x._id, x.title] as [string, string])];
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[#16141d]/45 px-3 py-8 sm:px-8" role="dialog" aria-modal="true" aria-label={(initial ? "Edit " : "New ") + formTitle}>
      <div className="w-full max-w-[720px] bg-white shadow-[0_25px_100px_rgba(0,0,0,.19)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eee] bg-white px-6 py-5 sm:px-9">
          <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8e8b96]">Studio Manager</p>
            <h2 className="mt-1 text-xl font-semibold">{initial ? "Edit " : "New "}{formTitle}</h2></div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2 text-[#777] hover:bg-[#f5f3f7]"><X className="size-5" /></button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-6 px-6 py-8 sm:px-9">
          {!isSettings&&!isContact && <F label="Title / Name *">{field("title", "Enter a title")}</F>}
          {isContact&&<div className="grid gap-4 sm:grid-cols-2">
            <F label="First name *">{field("firstName", "John")}</F>
            <F label="Last name">{field("lastName", "Smith")}</F>
          </div>}
          {(isContact || isProject || isDocument || isTemplate || isForm || kind === "payment-links") && (
            <F label="Type">{selection("type", isContact ? [["client","Client"],["lead","Lead"],["other","Other"]]
              : isProject ? [["portrait","Portrait"],["wedding","Wedding"],["event","Event"],["commercial","Commercial"],["other","Other"]]
              : isDocument ? [["contract","Contract"],["questionnaire","Questionnaire"],["quote","Quote"]]
              : isTemplate ? [["contract","Contract"],["invoice","Invoice"],["questionnaire","Questionnaire"],["quote","Quote"],["email","Email"]]
              : isForm ? [["lead","Lead"],["client","Client"]] : [["manual","Manual payment request"]])}</F>
          )}
          {(kind === "documents" || isInvoice || kind === "payment-links") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Client">{selection("contactId", contactOptions)}</F>
              <F label="Project">{selection("projectId", projectOptions)}</F>
            </div>
          )}
          {isProject && <F label="Primary client">{selection("contactId", contactOptions)}</F>}
          {(isContact || isInvoice || isDocument || kind === "payment-links") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Email">{field("email", "client@example.com", "email")}</F>
              {isContact ? <F label="Phone">{field("phone", "+1 234 567 890")}</F> : null}
            </div>
          )}
          {isContact && <>
            <F label="Company">{field("company", "Company name (optional)")}</F>
            <F label="Address line 1">{field("address", "Street address")}</F>
            <F label="Address line 2">{field("address2", "Apartment, suite, etc.")}</F>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="City">{field("city")}</F>
              <F label="State / Province">{field("state")}</F>
              <F label="Postcode">{field("postcode")}</F>
              <F label="Country">{field("country")}</F>
            </div>
          </>}
          {(isProject || isDocument || isInvoice || isForm || kind === "payment-links") && (
            <F label={isProject ? "Project description" : isForm ? "Form description" : "Description"}>
              <textarea className={TEXTAREA} value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="Add a description..." />
            </F>
          )}
          {isProject && <div className="grid gap-4 sm:grid-cols-2">
            <F label="Stage">{selection("status", [["","Inquiry"],["inquiry","Inquiry"],["booked","Booked"],["post-production","Post-production"],["completed","Completed"],["cancelled","Cancelled"]])}</F>
            <F label="Project date">{field("date", "", "date")}</F>
          </div>}
          {isProject&&<>
            <F label="Location">{field("location", "Studio or event location")}</F>
            <div className="space-y-3 border-t border-[#eee] pt-5">
              <p className="text-sm font-semibold">Additional clients</p>
              <p className="text-xs text-[#898590]">Choose any other contacts involved in this project.</p>
              <div className="grid max-h-40 gap-3 overflow-y-auto sm:grid-cols-2">
                {contacts.filter(c=>c._id!==form.contactId).map(c=><label key={c._id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={Array.isArray(form.additionalClientIds)&&form.additionalClientIds.includes(c._id)}
                    onChange={e=>set("additionalClientIds",e.target.checked
                      ?[...(form.additionalClientIds||[]),c._id]:(form.additionalClientIds||[]).filter((id:string)=>id!==c._id))}/>
                  {c.title}</label>)}
                {!contacts.length&&<p className="text-xs text-[#999]">No contacts available.</p>}
              </div>
            </div>
          </>}
          {isProject && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.archived)} onChange={(e) => set("archived", e.target.checked)} /> Archive this project</label>}
          {(isInvoice || isSettings || kind === "payment-links") && <F label="Currency">{selection("currency", [["BDT","BDT — Bangladeshi Taka"],["USD","USD — US Dollar"],["EUR","EUR — Euro"],["GBP","GBP — British Pound"],["SGD","SGD — Singapore Dollar"],["INR","INR — Indian Rupee"]])}</F>}
          {isInvoice && <>
            <div className="flex items-center justify-between border-b pb-3"><h3 className="text-lg font-semibold">Items</h3><span className="text-xs text-[#888]">Quantity × Price</span></div>
            {invoiceLines.map((line, index) => (
              <div key={index} className="space-y-3 bg-[#f9f8fa] p-4">
                <div className="flex gap-3">
                  <input className={INPUT} placeholder="Item / service" value={line.name}
                    onChange={(e) => setInvoiceLines((prev) => prev.map((x,i) => i===index ? {...x,name:e.target.value} : x))} />
                  <button type="button" title="Remove item" onClick={() => setInvoiceLines((rows) => rows.length > 1 ? rows.filter((_,i) => i!==index) : rows)}
                    className="p-2 text-[#9a98a0] hover:text-red-600"><Trash2 className="size-4" /></button>
                </div>
                <input className={INPUT} placeholder="Description (optional)" value={line.description}
                  onChange={(e) => setInvoiceLines((prev) => prev.map((x,i) => i===index ? {...x,description:e.target.value} : x))} />
                <div className="grid grid-cols-2 gap-3">
                  <F label="Quantity"><input className={INPUT} type="number" min="0.01" step="0.01" value={line.quantity}
                    onChange={(e) => setInvoiceLines((prev) => prev.map((x,i) => i===index ? {...x,quantity:Number(e.target.value)} : x))}/></F>
                  <F label="Unit price"><input className={INPUT} type="number" min="0" step="0.01" value={line.unitPrice}
                    onChange={(e) => setInvoiceLines((prev) => prev.map((x,i) => i===index ? {...x,unitPrice:Number(e.target.value)} : x))}/></F>
                </div>
              </div>
            ))}
            <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-[#6337d8]" onClick={() => setInvoiceLines((prev) => [...prev,{name:"",description:"",quantity:1,unitPrice:0}])}><Plus className="size-4" /> Add Item</button>
            <div className="grid grid-cols-2 gap-4">
              <F label="Discount %">{field("discountPercent", "0", "number")}</F>
              <F label="Tax %">{field("taxPercent", "0", "number")}</F>
            </div>
            <p className="border-t py-3 text-right text-lg font-semibold">Total: {form.currency} {total.toLocaleString(undefined,{minimumFractionDigits:2})}</p>
            <F label="Notes"><textarea className={TEXTAREA} value={form.notes || ""} onChange={(e)=>set("notes",e.target.value)} /></F>
            <F label="Payment due">{field("dueDate", "", "date")}</F>
          </>}
          {(isDocument || isTemplate) && (form.type !== "invoice" || !isTemplate) && <F label={isDocument ? "Document content" : "Template content"}>
            <textarea className={TEXTAREA+" min-h-[240px]"} value={form.content || ""} placeholder="Write the content of this document..." onChange={(e)=>set("content",e.target.value)}/>
          </F>}
          {isTemplate&&form.type==="invoice"&&<>
            <h3 className="border-t pt-4 font-semibold">Reusable invoice items</h3>
            {invoiceLines.map((line,i)=><div className="grid gap-3 border bg-[#faf9fd] p-3 sm:grid-cols-[1fr_80px_125px_30px]" key={i}>
              <input className={INPUT} placeholder="Service name" value={line.name} onChange={(e)=>setInvoiceLines(prev=>prev.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/>
              <input className={INPUT} aria-label="Quantity" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e)=>setInvoiceLines(prev=>prev.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x))}/>
              <input className={INPUT} aria-label="Unit price" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e)=>setInvoiceLines(prev=>prev.map((x,j)=>j===i?{...x,unitPrice:Number(e.target.value)}:x))}/>
              <button type="button" aria-label="Remove item" onClick={()=>setInvoiceLines(prev=>prev.length>1?prev.filter((_,j)=>i!==j):prev)}><Trash2 className="size-4"/></button>
            </div>)}
            <button type="button" className={BUTTON} onClick={()=>setInvoiceLines(prev=>[...prev,{name:"",description:"",quantity:1,unitPrice:0}])}><Plus className="size-4"/> Add item</button>
            <div className="grid gap-4 sm:grid-cols-2"><F label="Discount %">{field("discountPercent","","number")}</F><F label="Tax %">{field("taxPercent","","number")}</F></div>
          </>}
          {(isQuote || (isTemplate && form.type === "quote")) && <div className="grid gap-4 sm:grid-cols-2">
            <F label="Quoted amount">{field("amount","0","number")}</F>
            <F label="Currency">{selection("currency", [["BDT","BDT"],["USD","USD"],["EUR","EUR"],["GBP","GBP"],["SGD","SGD"]])}</F>
          </div>}
          {(isQuestionnaire || (isTemplate && form.type === "questionnaire")) && <div className="space-y-4 border-t border-[#eee] pt-6">
            <h3 className="text-lg font-semibold">Questionnaire fields</h3>
            <p className="text-xs leading-6 text-[#888]">These questions appear on the client-facing document link.</p>
            {questions.map((q,i)=><div key={i} className="space-y-3 border border-[#e9e7ed] p-4">
              <div className="flex items-center gap-3">
                <input className={INPUT} value={q.label} placeholder="Question label" onChange={(e)=>setQuestions(prev=>prev.map((x,j)=>j===i?{...x,label:e.target.value,name:e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,60)}:x))}/>
                <button type="button" title="Remove field" onClick={()=>setQuestions(prev=>prev.filter((_,j)=>j!==i))}><Trash2 className="size-4"/></button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <select className={INPUT} value={q.type} onChange={(e)=>setQuestions(prev=>prev.map((x,j)=>j===i?{...x,type:e.target.value}:x))}>
                  <option value="text">Short answer</option><option value="textarea">Long answer</option><option value="select">Dropdown</option><option value="date">Date</option>
                </select>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={q.required} onChange={(e)=>setQuestions(prev=>prev.map((x,j)=>j===i?{...x,required:e.target.checked}:x))}/> Required</label>
              </div>
              {q.type==="select"&&<input className={INPUT} placeholder="Options separated by commas" value={q.options||""} onChange={(e)=>setQuestions(prev=>prev.map((x,j)=>j===i?{...x,options:e.target.value}:x))}/>}
            </div>)}
            <button type="button" className={BUTTON} onClick={()=>setQuestions(prev=>[...prev,{name:"question-"+(prev.length+1),label:"",type:"text",required:false}])}><Plus className="size-4"/> Add question</button>
          </div>}
          {isForm && <>
            <div className="border-t pt-5">
              <h3 className="mb-1 text-lg font-semibold">Form fields</h3>
              <p className="mb-4 text-xs text-[#888]">Name, email, and message fields are included automatically.</p>
              {questions.map((q,i) => <div className="mb-3 grid gap-2 border border-[#e9e7ed] p-3 sm:grid-cols-[1fr_150px_28px] sm:items-center" key={i}>
                <input className={INPUT} value={q.label} placeholder="Question label" onChange={(e)=>setQuestions(prev=>prev.map((x,j)=>j===i?{...x,label:e.target.value,name:e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,60)}:x))}/>
                <select className={INPUT} value={q.type} onChange={(e)=>setQuestions(prev=>prev.map((x,j)=>j===i?{...x,type:e.target.value}:x))}>
                  <option value="text">Text</option><option value="textarea">Long text</option><option value="select">Dropdown</option><option value="date">Date</option>
                </select>
                <button type="button" title="Remove field" onClick={()=>setQuestions(prev=>prev.filter((_,j)=>j!==i))}><X className="size-4"/></button>
                {q.type==="select" && <input className={INPUT+" sm:col-span-2"} placeholder="Options separated by commas" value={q.options||""} onChange={(e)=>setQuestions(prev=>prev.map((x,j)=>j===i?{...x,options:e.target.value}:x))}/>}
                <label className="col-span-full flex items-center gap-2 text-xs text-[#777]"><input type="checkbox" checked={q.required} onChange={(e)=>setQuestions(prev=>prev.map((x,j)=>j===i?{...x,required:e.target.checked}:x))}/> Required field</label>
              </div>)}
              <button type="button" className={BUTTON} onClick={()=>setQuestions(prev=>[...prev,{name:"question-"+(prev.length+1),label:"",type:"text",required:false}])}><Plus className="size-4"/> Add field</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="New contact type">{selection("contactType", [["lead","Lead"],["client","Client"],["other","Other"]])}</F>
              <F label="Submit button text">{field("buttonLabel", "Submit")}</F>
            </div>
            <F label="Success message">{field("successMessage", "Thank you for contacting us!")}</F>
          </>}
          {isSettings && <>
            <F label="Studio / Company name">{field("company", "Your photography studio")}</F>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Contact email">{field("email","hello@studio.com","email")}</F>
              <F label="Phone">{field("phone")}</F>
            </div>
            <F label="Business address">{field("address")}</F>
            <F label="Project stages" note="Separate stage names with commas. These appear on the project board.">{field("projectStages","inquiry, booked, post-production, completed")}</F>
          </>}
          {kind === "payment-links" && <>
            <F label="Requested amount">{field("amount","0","number")}</F>
            <F label="Payment request status">{selection("status", [["","Draft"],["draft","Draft"],["active","Active"],["cancelled","Cancelled"]])}</F>
            <F label="Expires on (optional)">{field("dueDate","","date")}</F>
            <F label="Payment instructions / notes"><textarea className={TEXTAREA} value={form.notes||""} onChange={(e)=>set("notes",e.target.value)} /></F>
            <p className="text-xs leading-5 text-[#9a680e]">This is a manual payment request record. It does not process online card payments. Use invoices to track payments you receive.</p>
          </>}
          {kind === "discounts" && <div className="grid gap-4 sm:grid-cols-2">
            <F label="Discount code">{field("code","STUDIO10")}</F>
            <F label="Discount percentage">{field("amount","10","number")}</F>
            <F label="Expires">{field("dueDate","","date")}</F>
            <F label="Status">{selection("status", [["","Active"],["active","Active"],["inactive","Inactive"]])}</F>
          </div>}
          {error && <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-[#eee] pt-6">
            <button type="button" className={BUTTON} onClick={onClose}>Cancel</button>
            <button className={PURPLE} type="submit" disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : initial ? "Save Changes" : "Create " + formTitle}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

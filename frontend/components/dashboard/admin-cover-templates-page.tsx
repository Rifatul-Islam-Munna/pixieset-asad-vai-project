"use client";

import { useMemo, useState, useTransition } from "react";
import { Edit3, Loader2, PlusCircle, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { updateHomeCms, uploadHomeCmsFile } from "@/actions/admin";
import { CoverPreview } from "@/components/dashboard/cover-designs";
import { AdminResourceShell } from "./admin-resource-shell";
import type { CustomCoverElement, CustomCoverTemplate, HomeCmsData } from "@/lib/home-cms";

const blank = (): CustomCoverTemplate => ({
  id: `cover-${Date.now()}`,
  name: "New custom cover",
  backgroundImage: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80",
  overlayOpacity: 24,
  gridOpacity: 0,
  lineOpacity: 70,
  elements: [{ id: `title-${Date.now()}`, type: "title", text: "COLLECTION TITLE", x: 50, y: 48, width: 70, height: 14, fontSize: 34, color: "#ffffff", opacity: 100, align: "center" }],
});

export function AdminCoverTemplatesPage({ initialCms }: { initialCms: HomeCmsData }) {
  const [cms, setCms] = useState(initialCms);
  const [draft, setDraft] = useState<CustomCoverTemplate | null>(null);
  const [pending, startTransition] = useTransition();
  const templates = cms.coverTemplates ?? [];
  const sorted = useMemo(() => [...templates].sort((a, b) => a.name.localeCompare(b.name)), [templates]);

  const persist = (next: CustomCoverTemplate[], success: string) => startTransition(async () => {
    try {
      const saved = await updateHomeCms({ ...cms, coverTemplates: next });
      setCms(saved);
      setDraft(null);
      toast.success(success);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save cover templates"); }
  });
  const save = () => {
    if (!draft?.name.trim()) return toast.error("Template name is required");
    const exists = templates.some((item) => item.id === draft.id);
    persist(exists ? templates.map((item) => item.id === draft.id ? draft : item) : [...templates, draft], exists ? "Cover template updated" : "Cover template created");
  };
  const remove = (template: CustomCoverTemplate) => {
    if (!confirm(`Delete ${template.name}?`)) return;
    persist(templates.filter((item) => item.id !== template.id), "Cover template deleted");
  };
  const patchElement = (id: string, value: Partial<CustomCoverElement>) => setDraft((current) => current ? ({ ...current, elements: current.elements.map((item) => item.id === id ? { ...item, ...value } : item) }) : current);
  const addElement = (type: CustomCoverElement["type"]) => setDraft((current) => current ? ({ ...current, elements: [...current.elements, { id: `${type}-${Date.now()}`, type, text: type === "button" ? "VIEW GALLERY" : type === "date" ? "EVENT DATE" : type === "line" ? "" : type.toUpperCase(), x: 50, y: 55, width: type === "line" ? 55 : 60, height: type === "line" ? 1 : 9, fontSize: type === "title" ? 32 : 14, color: "#ffffff", opacity: 100, align: "center" }] }) : current);

  return (
    <AdminResourceShell active="covers" title="Client gallery cover templates" subtitle="Create templates one by one, then edit or delete them from this table. These templates appear in the collection cover designer only when the user plan includes Custom cover." action={<button onClick={() => setDraft(blank())} className="inline-flex h-11 items-center gap-2 bg-[#111] px-5 text-sm font-bold text-white"><PlusCircle className="size-4" />Add template</button>}>
      <div className="overflow-x-auto bg-white"><table className="w-full min-w-[760px] text-sm"><thead className="border-b bg-[#fafafa] text-left text-xs uppercase tracking-[0.14em] text-[#777]"><tr><th className="px-4 py-4">Preview</th><th className="px-4 py-4">Template</th><th className="px-4 py-4">Layers</th><th className="px-4 py-4">Background</th><th className="px-4 py-4 text-right">Actions</th></tr></thead><tbody>
        {sorted.map((template) => <tr key={template.id} className="border-b"><td className="w-44 px-4 py-4"><div className="aspect-[1.45] overflow-hidden"><CoverPreview design={{ cover: `custom:${template.id}`, customCoverTemplate: template }} compact className="min-h-0" /></div></td><td className="px-4 py-4"><b>{template.name}</b><p className="mt-1 text-xs text-[#777]">{template.id}</p></td><td className="px-4 py-4">{template.elements.length}</td><td className="max-w-52 truncate px-4 py-4 text-xs text-[#666]">{template.backgroundImage}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button onClick={() => setDraft(JSON.parse(JSON.stringify(template)))} className="p-2 hover:bg-[#f2f2f2]" aria-label="Edit template"><Edit3 className="size-4" /></button><button onClick={() => remove(template)} disabled={pending} className="p-2 text-red-600 hover:bg-red-50" aria-label="Delete template"><Trash2 className="size-4" /></button></div></td></tr>)}
        {!sorted.length && <tr><td colSpan={5} className="px-4 py-16 text-center text-[#777]">No cover templates yet. Add the first template.</td></tr>}
      </tbody></table></div>
      {draft && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-4"><div className="mx-auto my-4 w-full max-w-6xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between border-b pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">Cover template editor</p><h2 className="mt-2 text-2xl font-semibold">{draft.name}</h2></div><button onClick={() => setDraft(null)}><X className="size-5" /></button></div>
        <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]"><div><div className="aspect-[1.55] overflow-hidden bg-[#111]"><CoverPreview design={{ cover: `custom:${draft.id}`, customCoverTemplate: draft }} className="min-h-full" /></div><div className="mt-4 flex flex-wrap gap-2">{(["title","subtitle","date","button","brandText","logo","line"] as CustomCoverElement["type"][]).map((type) => <button key={type} onClick={() => addElement(type)} className="border px-3 py-2 text-xs font-bold capitalize">+ {type}</button>)}</div>
<div className="mt-6 grid gap-3">{draft.elements.map((element) => <div key={element.id} className="grid gap-3 border bg-[#fafafa] p-3 sm:grid-cols-6"><label className="grid gap-1 sm:col-span-2"><span className="text-[10px] font-bold uppercase text-[#777]">Text / type</span><input value={element.text} onChange={(e) => patchElement(element.id,{text:e.target.value})} className="h-10 border px-3 text-sm" placeholder={element.type} /></label>{(["x","y","width","fontSize"] as const).map((key) => <label key={key} className="grid gap-1"><span className="text-[10px] font-bold uppercase text-[#777]">{key}</span><input type="number" value={element[key]} onChange={(e) => patchElement(element.id,{[key]:Number(e.target.value)} as any)} className="h-10 border px-2 text-sm" /></label>)}<div className="flex items-end"><button onClick={() => setDraft({...draft,elements:draft.elements.filter((item)=>item.id!==element.id)})} className="h-10 w-full text-red-600"><Trash2 className="mx-auto size-4" /></button></div></div>)}</div>
        </div><div className="grid content-start gap-4"><Field label="Template name" value={draft.name} onChange={(name)=>setDraft({...draft,name})} /><Field label="Background URL" value={draft.backgroundImage} onChange={(backgroundImage)=>setDraft({...draft,backgroundImage})} /><label className="flex h-11 cursor-pointer items-center justify-center gap-2 bg-[#111] text-sm font-bold text-white"><Upload className="size-4" />Upload background<input type="file" accept="image/*" className="hidden" onChange={async(e)=>{const file=e.target.files?.[0]; if(!file)return; try{const url=await uploadHomeCmsFile(file);setDraft({...draft,backgroundImage:url});}catch(error){toast.error(error instanceof Error?error.message:"Upload failed");}}}/></label><Field label="Overlay opacity" value={String(draft.overlayOpacity)} onChange={(value)=>setDraft({...draft,overlayOpacity:Number(value)||0})} type="number" /><Field label="Grid opacity" value={String(draft.gridOpacity)} onChange={(value)=>setDraft({...draft,gridOpacity:Number(value)||0})} type="number" /><button onClick={save} disabled={pending} className="mt-2 inline-flex h-12 items-center justify-center gap-2 bg-[#22bda7] text-sm font-bold text-white disabled:opacity-50">{pending?<Loader2 className="size-4 animate-spin"/>:<Save className="size-4"/>}Save template</button></div></div>
      </div></div>}
    </AdminResourceShell>
  );
}

function Field({label,value,onChange,type="text"}:{label:string;value:string;onChange:(value:string)=>void;type?:string}){return <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#777]">{label}</span><input type={type} value={value} onChange={(e)=>onChange(e.target.value)} className="h-11 border px-3 text-sm outline-none focus:border-[#22bda7]"/></label>}

"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Copy, Loader2, Mail, PlusCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateHomeCms } from "@/actions/admin";
import { AdminResourceShell } from "@/components/dashboard/admin-resource-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_TEMPLATE_CATEGORIES, EMAIL_TEMPLATE_LANGUAGES, type EmailTemplateItem, type HomeCmsData } from "@/lib/home-cms";
import { CLIENT_GALLERY_CATEGORIES } from "@/lib/gallery-categories";

const blankTemplate = (): EmailTemplateItem => ({
  id: `admin-email-${Date.now()}`,
  name: "Untitled Template",
  subject: "",
  previewText: "",
  title: "Your photos are ready",
  message: "",
  buttonText: "View Gallery",
  buttonLink: "Collection URL",
  buttonColor: "#111111",
  footerText: "",
  image: "",
  category: "Gallery Delivery",
  galleryCategory: "Wedding",
  customGalleryCategoryLabel: "",
  language: "English",
  updatedAt: "Draft",
  source: "admin",
});

export function AdminEmailTemplatesPage({ initialCms }: { initialCms: HomeCmsData }) {
  const [cms, setCms] = useState(initialCms);
  const [activeId, setActiveId] = useState(initialCms.emailTemplates[0]?.id ?? "");
  const [draft, setDraft] = useState<EmailTemplateItem | null>(initialCms.emailTemplates[0] ?? null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState("All");
  const [languageFilter, setLanguageFilter] = useState("All");
  const [pending, startTransition] = useTransition();
  const templates = useMemo(() => cms.emailTemplates ?? [], [cms.emailTemplates]);
  const visibleTemplates = useMemo(() => templates.filter((template) =>
    (categoryFilter === "All" || (template.category || "Gallery Delivery") === categoryFilter) &&
    (galleryCategoryFilter === "All" || (template.galleryCategory || "General") === galleryCategoryFilter) &&
    (languageFilter === "All" || (template.language || "English") === languageFilter)), [categoryFilter, galleryCategoryFilter, languageFilter, templates]);

  const select = (template: EmailTemplateItem) => {
    setActiveId(template.id);
    setDraft({ ...template, source: "admin" });
  };
  const create = () => {
    const template = blankTemplate();
    setActiveId(template.id);
    setDraft(template);
  };
  const duplicate = () => {
    if (!draft) return;
    const template = { ...draft, id: `admin-email-${Date.now()}`, name: `${draft.name} Copy`, updatedAt: "Draft" };
    setActiveId(template.id);
    setDraft(template);
  };
  const persist = (nextTemplates: EmailTemplateItem[], success: string) => {
    startTransition(async () => {
      try {
        const saved = await updateHomeCms({ ...cms, emailTemplates: nextTemplates });
        setCms(saved);
        const nextActive = saved.emailTemplates.find((item) => item.id === activeId) ?? saved.emailTemplates[0] ?? null;
        setActiveId(nextActive?.id ?? "");
        setDraft(nextActive);
        toast.success(success);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Template could not be saved");
      }
    });
  };
  const save = () => {
    if (!draft?.name.trim()) return toast.error("Template name is required");
    const savedDraft = {
      ...draft,
      source: "admin" as const,
      updatedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    const exists = templates.some((item) => item.id === savedDraft.id);
    persist(exists ? templates.map((item) => item.id === savedDraft.id ? savedDraft : item) : [savedDraft, ...templates], "Pre-built template saved");
  };
  const remove = () => {
    if (!draft || !templates.some((item) => item.id === draft.id)) return;
    persist(templates.filter((item) => item.id !== draft.id), "Pre-built template deleted");
  };
  const update = (value: Partial<EmailTemplateItem>) => setDraft((current) => current ? { ...current, ...value } : current);

  return (
    <AdminResourceShell
      active="emails"
      title="Pre-built email templates"
      subtitle="Create reusable starter templates for every user. Users can customize one and save it as their own copy."
      action={<Button onClick={create} className="rounded-none bg-[#111] text-white"><PlusCircle className="size-4" />New template</Button>}
    >
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(420px,0.85fr)_minmax(420px,1fr)]">
        <aside className="border bg-white p-3">
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#777]">Templates</p>
          <div className="grid gap-2 px-3 pb-3">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-9 border bg-white px-2 text-xs"><option>All</option>{EMAIL_TEMPLATE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
            <select value={galleryCategoryFilter} onChange={(event) => setGalleryCategoryFilter(event.target.value)} className="h-9 border bg-white px-2 text-xs"><option>All</option><option>General</option>{CLIENT_GALLERY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
            <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} className="h-9 border bg-white px-2 text-xs"><option>All</option>{EMAIL_TEMPLATE_LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select>
          </div>
          <div className="mt-2 grid gap-2">
            {visibleTemplates.map((template) => (
              <button key={template.id} onClick={() => select(template)} className={`border p-4 text-left ${activeId === template.id ? "border-[#111] bg-[#f5f5f2]" : "hover:bg-[#fafafa]"}`}>
                <p className="font-bold">{template.name}</p>
                <p className="mt-1 truncate text-xs text-[#777]">{template.subject || "No subject"}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#9a8f82]">{template.category || "Gallery Delivery"} · {template.galleryCategory || "General"} · {template.language || "English"}</p>
              </button>
            ))}
            {!visibleTemplates.length && <p className="p-5 text-sm text-[#777]">No templates match these filters.</p>}
          </div>
        </aside>

        <section className="border bg-white p-5 sm:p-7">
          {draft ? <div className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#777]">Template editor</p><h2 className="mt-1 text-xl font-semibold">{draft.name}</h2></div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-none" onClick={duplicate}><Copy className="size-4" />Copy</Button>
                <Button className="rounded-none bg-[#111] text-white" disabled={pending} onClick={save}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save</Button>
                {templates.length > 1 && templates.some((item) => item.id === draft.id) && <Button variant="outline" className="rounded-none text-red-600" disabled={pending} onClick={remove}><Trash2 className="size-4" /></Button>}
              </div>
            </div>
            <Field label="Template name"><Input value={draft.name} onChange={(event) => update({ name: event.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Email purpose"><select value={draft.category || "Gallery Delivery"} onChange={(event) => update({ category: event.target.value })} className="h-10 border bg-white px-3 text-sm font-normal normal-case tracking-normal">{EMAIL_TEMPLATE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field>
              <Field label="Gallery category"><select value={draft.galleryCategory || ""} onChange={(event) => update({ galleryCategory: event.target.value || undefined, customGalleryCategoryLabel: event.target.value === "Custom label" ? draft.customGalleryCategoryLabel : "" })} className="h-10 border bg-white px-3 text-sm font-normal normal-case tracking-normal"><option value="">General / all gallery types</option>{CLIENT_GALLERY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field>
              <Field label="Language"><select value={draft.language || "English"} onChange={(event) => update({ language: event.target.value })} className="h-10 border bg-white px-3 text-sm font-normal normal-case tracking-normal">{EMAIL_TEMPLATE_LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select></Field>
            </div>
            {draft.galleryCategory === "Custom label" && <Field label="Custom gallery label"><Input value={draft.customGalleryCategoryLabel || ""} onChange={(event) => update({ customGalleryCategoryLabel: event.target.value })} placeholder="e.g. Newborn, Corporate Gala" /></Field>}
            <Field label="Subject"><Input value={draft.subject} onChange={(event) => update({ subject: event.target.value })} /></Field>
            <Field label="Preview text"><Input value={draft.previewText} onChange={(event) => update({ previewText: event.target.value })} /></Field>
            <Field label="Email title"><Input value={draft.title} onChange={(event) => update({ title: event.target.value })} /></Field>
            <Field label="Hero image URL"><Input value={draft.image} onChange={(event) => update({ image: event.target.value })} placeholder="https://..." /></Field>
            <Field label="Message"><Textarea className="min-h-40" value={draft.message} onChange={(event) => update({ message: event.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Button text"><Input value={draft.buttonText} onChange={(event) => update({ buttonText: event.target.value })} /></Field><Field label="Button link"><Input value={draft.buttonLink} onChange={(event) => update({ buttonLink: event.target.value })} /></Field></div>
            <Field label="Button color"><div className="flex gap-3"><Input type="color" className="w-16 p-1" value={draft.buttonColor} onChange={(event) => update({ buttonColor: event.target.value })} /><Input value={draft.buttonColor} onChange={(event) => update({ buttonColor: event.target.value })} /></div></Field>
            <Field label="Footer"><Textarea value={draft.footerText} onChange={(event) => update({ footerText: event.target.value })} /></Field>
          </div> : <div className="flex min-h-96 flex-col items-center justify-center text-center"><Mail className="size-10 text-[#999]" /><p className="mt-4 font-bold">Create first template</p></div>}
        </section>

        <section className="border bg-[#ecece8] p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#777]">Live preview</p>
          {draft && <div className="mx-auto mt-5 max-w-[640px] overflow-hidden bg-white shadow-xl">
            <div className="bg-[#111] px-8 py-12 text-center text-white"><p className="text-xs uppercase tracking-[0.22em]">Client Gallery</p><h3 className="mt-4 text-3xl font-black uppercase">{draft.title || draft.name}</h3></div>
            {draft.image && <img src={draft.image} alt="" className="aspect-[2/1] w-full object-cover" />}
            <div className="p-8 text-center"><p className="text-xs font-bold uppercase tracking-wide text-[#777]">{draft.subject}</p><p className="mt-3 text-sm text-[#777]">{draft.previewText}</p><p className="mt-7 whitespace-pre-line text-left leading-7">{draft.message}</p><span className="mt-8 inline-flex px-7 py-3 text-sm font-bold text-white" style={{ backgroundColor: draft.buttonColor }}>{draft.buttonText || "View Gallery"}</span><p className="mt-9 whitespace-pre-line text-xs text-[#666]">{draft.footerText}</p></div>
          </div>}
        </section>
      </div>
    </AdminResourceShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-[#666]"><span>{label}</span>{children}</label>;
}

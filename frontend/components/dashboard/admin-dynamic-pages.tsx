"use client";

import Link from "next/link";
import {
  BarChart3,
  Building2,
  Copy,
  ExternalLink,
  Grid3X3,
  Images,
  ListChecks,
  Megaphone,
  MoveDown,
  MoveUp,
  Pencil,
  Plus,
  Quote,
  Rows3,
  Trash2,
  Type,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createAdminDynamicPage,
  deleteAdminDynamicPage,
  type AdminDynamicPage,
  type AdminDynamicPageButton,
  type AdminDynamicPageColumn,
  type AdminDynamicPageSection,
  type AdminDynamicPageSectionItem,
  type AdminDynamicPageSectionType,
  updateAdminDynamicPage,
  uploadHomeCmsFile,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AdminResourceShell } from "./admin-resource-shell";

const SECTION_TYPES: Array<{
  type: AdminDynamicPageSectionType;
  label: string;
  description: string;
  icon: typeof Rows3;
}> = [
  { type: "split", label: "Image + text", description: "Editorial two-column story section.", icon: Rows3 },
  { type: "rich-text", label: "Long-form text", description: "Large heading and detailed copy.", icon: Type },
  { type: "feature-grid", label: "Feature cards", description: "2–4 columns of image/text cards.", icon: Grid3X3 },
  { type: "gallery", label: "Image gallery", description: "Visual grid with optional captions.", icon: Images },
  { type: "stats", label: "Stats / numbers", description: "Metrics, proof points and numbers.", icon: BarChart3 },
  { type: "testimonial", label: "Testimonials", description: "Quotes, people and social proof.", icon: Quote },
  { type: "cta", label: "Call to action", description: "Focused conversion block with buttons.", icon: Megaphone },
  { type: "logo-strip", label: "Logo strip", description: "Partner, publication or client logos.", icon: Building2 },
  { type: "steps", label: "Numbered steps", description: "Process, timeline or how-it-works.", icon: ListChecks },
];

const sectionName = (type: AdminDynamicPageSectionType) =>
  SECTION_TYPES.find((item) => item.type === type)?.label || type;

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `section-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const LINK_PRESETS: Array<[string, string]> = [
  ["", "Choose quick destination"],
  ["/", "Home"],
  ["/register", "Sign up / Register"],
  ["/login", "Login"],
  ["/pricing", "Pricing"],
  ["/plans", "Plans"],
  ["/blog", "Blog"],
  ["/dashboard/client-gallery", "App / Dashboard"],
];

const emptyButton = (): AdminDynamicPageButton => ({
  id: makeId(),
  enabled: true,
  label: "",
  url: "",
  style: "primary",
  newTab: false,
});

const normalizeButtons = (
  buttons?: AdminDynamicPageButton[],
  primaryLabel?: string,
  primaryUrl?: string,
  secondaryLabel?: string,
  secondaryUrl?: string,
) => {
  if (buttons?.length) return buttons.map((button) => ({ ...button, id: button.id || makeId(), enabled: button.enabled ?? true }));
  const migrated: AdminDynamicPageButton[] = [];
  if (primaryLabel && primaryUrl) migrated.push({ ...emptyButton(), label: primaryLabel, url: primaryUrl, style: "primary" });
  if (secondaryLabel && secondaryUrl) migrated.push({ ...emptyButton(), label: secondaryLabel, url: secondaryUrl, style: "secondary" });
  return migrated;
};

const emptyColumn = (): AdminDynamicPageColumn => ({
  eyebrow: "",
  title: "",
  body: "",
  imageUrl: "",
  linkLabel: "",
  linkUrl: "",
});

const emptyItem = (): AdminDynamicPageSectionItem => ({
  id: makeId(),
  eyebrow: "",
  title: "",
  body: "",
  imageUrl: "",
  label: "",
  value: "",
  linkLabel: "",
  linkUrl: "",
});

function newSection(type: AdminDynamicPageSectionType): AdminDynamicPageSection {
  const base: AdminDynamicPageSection = {
    id: makeId(),
    type,
    enabled: true,
    eyebrow: "",
    title: "",
    body: "",
    imageUrl: "",
    layout: type === "split" ? "image-right" : "default",
    tone: type === "cta" || type === "stats" ? "dark" : "light",
    alignment: type === "cta" || type === "testimonial" || type === "logo-strip" ? "center" : "left",
    buttonLabel: "",
    buttonUrl: "",
    secondaryButtonLabel: "",
    secondaryButtonUrl: "",
    buttons: [],
    columns: type === "logo-strip" ? 4 : 3,
    items: [],
  };

  if (["feature-grid", "gallery", "stats", "testimonial", "steps"].includes(type)) {
    base.items = [emptyItem(), emptyItem(), emptyItem()];
  }
  if (type === "logo-strip") {
    base.items = [emptyItem(), emptyItem(), emptyItem(), emptyItem(), emptyItem(), emptyItem()];
  }
  return base;
}

const emptyPage = (): Omit<AdminDynamicPage, "_id"> => ({
  title: "",
  slug: "",
  navLabel: "",
  navDescription: "",
  showInNavbar: true,
  navOrder: 0,
  eyebrow: "",
  heroTitle: "",
  heroDescription: "",
  heroImageUrl: "",
  heroEnabled: true,
  heroLayout: "split",
  heroTone: "soft",
  heroPrimaryLabel: "",
  heroPrimaryUrl: "",
  heroSecondaryLabel: "",
  heroSecondaryUrl: "",
  heroButtons: [],
  columnCount: 3,
  legacyGridEnabled: true,
  columns: [emptyColumn(), emptyColumn(), emptyColumn()],
  sections: [],
  seoTitle: "",
  seoDescription: "",
  seoKeywords: [],
  canonicalUrl: "",
  ogTitle: "",
  ogDescription: "",
  ogImageUrl: "",
  robotsIndex: true,
  robotsFollow: true,
  published: true,
});

type Draft = Omit<AdminDynamicPage, "_id"> & {
  _id?: string;
  keywordsText: string;
};

function toDraft(page?: AdminDynamicPage): Draft {
  const source = page ?? emptyPage();
  return {
    ...source,
    _id: page?._id,
    columns: [...(source.columns ?? [])],
    legacyGridEnabled: source.legacyGridEnabled ?? true,
    heroEnabled: source.heroEnabled ?? true,
    heroButtons: normalizeButtons(
      source.heroButtons,
      source.heroPrimaryLabel,
      source.heroPrimaryUrl,
      source.heroSecondaryLabel,
      source.heroSecondaryUrl,
    ),
    sections: (source.sections ?? []).map((section) => ({
      ...section,
      id: section.id || makeId(),
      enabled: section.enabled ?? true,
      buttons: normalizeButtons(
        section.buttons,
        section.buttonLabel,
        section.buttonUrl,
        section.secondaryButtonLabel,
        section.secondaryButtonUrl,
      ),
      items: (section.items ?? []).map((item) => ({ ...item, id: item.id || makeId() })),
    })),
    heroLayout: source.heroLayout || "split",
    heroTone: source.heroTone || "soft",
    keywordsText: (source.seoKeywords ?? []).join(", "),
  };
}

export function AdminDynamicPages({ initialPages }: { initialPages: AdminDynamicPage[] }) {
  const [pages, setPages] = useState(initialPages);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadingKey, setUploadingKey] = useState("");

  const uploadFile = async (file?: File, key = "") => {
    if (!file) return "";
    setUploadingKey(key);
    try {
      const data = new FormData();
      data.append("file", file);
      const url = await uploadHomeCmsFile(data);
      toast.success("Image uploaded");
      return url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
      return "";
    } finally {
      setUploadingKey("");
    }
  };

  const setColumnCount = (count: number) => {
    if (!draft) return;
    const columnCount = Math.max(3, Math.min(8, count));
    const columns = Array.from({ length: columnCount }, (_, index) => draft.columns[index] ?? emptyColumn());
    setDraft({ ...draft, columnCount, columns });
  };

  const updateColumn = (index: number, patch: Partial<AdminDynamicPageColumn>) => {
    if (!draft) return;
    const columns = draft.columns.map((column, i) => (i === index ? { ...column, ...patch } : column));
    setDraft({ ...draft, columns });
  };

  const updateSection = (index: number, patch: Partial<AdminDynamicPageSection>) => {
    if (!draft) return;
    const sections = (draft.sections ?? []).map((section, i) => (i === index ? { ...section, ...patch } : section));
    setDraft({ ...draft, sections });
  };

  const updateSectionItem = (sectionIndex: number, itemIndex: number, patch: Partial<AdminDynamicPageSectionItem>) => {
    if (!draft) return;
    const sections = [...(draft.sections ?? [])];
    const section = sections[sectionIndex];
    const items = [...(section.items ?? [])];
    items[itemIndex] = { ...items[itemIndex], ...patch };
    sections[sectionIndex] = { ...section, items };
    setDraft({ ...draft, sections });
  };

  const addSectionItem = (sectionIndex: number) => {
    if (!draft) return;
    const section = (draft.sections ?? [])[sectionIndex];
    updateSection(sectionIndex, { items: [...(section.items ?? []), emptyItem()] });
  };

  const removeSectionItem = (sectionIndex: number, itemIndex: number) => {
    if (!draft) return;
    const section = (draft.sections ?? [])[sectionIndex];
    updateSection(sectionIndex, { items: (section.items ?? []).filter((_, index) => index !== itemIndex) });
  };

  const addSection = (type: AdminDynamicPageSectionType) => {
    if (!draft) return;
    setDraft({ ...draft, sections: [...(draft.sections ?? []), newSection(type)] });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const sections = [...(draft.sections ?? [])];
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    setDraft({ ...draft, sections });
  };

  const duplicateSection = (index: number) => {
    if (!draft) return;
    const sections = [...(draft.sections ?? [])];
    const source = sections[index];
    sections.splice(index + 1, 0, {
      ...source,
      id: makeId(),
      title: source.title ? `${source.title} copy` : "",
      items: (source.items ?? []).map((item) => ({ ...item, id: makeId() })),
    });
    setDraft({ ...draft, sections });
  };

  const removeSection = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, sections: (draft.sections ?? []).filter((_, i) => i !== index) });
  };

  const save = () => {
    if (!draft?.title.trim()) return toast.error("Page title is required");
    const payload = {
      ...draft,
      seoKeywords: draft.keywordsText.split(",").map((item) => item.trim()).filter(Boolean),
      columns: draft.columns.slice(0, draft.columnCount),
      sections: draft.sections ?? [],
    };
    startTransition(async () => {
      try {
        const saved = draft._id
          ? await updateAdminDynamicPage(draft._id, payload)
          : await createAdminDynamicPage(payload);
        setPages((items) =>
          draft._id
            ? items.map((item) => (item._id === saved._id ? saved : item))
            : [...items, saved].sort((a, b) => a.navOrder - b.navOrder),
        );
        setDraft(null);
        toast.success(draft._id ? "Page updated" : "Page created");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Save failed");
      }
    });
  };

  const remove = (page: AdminDynamicPage) => {
    if (!window.confirm(`Delete "${page.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteAdminDynamicPage(page._id);
        setPages((items) => items.filter((item) => item._id !== page._id));
        toast.success("Page deleted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Delete failed");
      }
    });
  };

  return (
    <AdminResourceShell
      active="pages"
      title="Dynamic pages"
      subtitle="Build complete landing pages from reusable designed sections, keep them in the navbar, and control SEO from one editor."
      action={<Button onClick={() => setDraft(toDraft())}><Plus />Create page</Button>}
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => (
          <article key={page._id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">
                  {page.showInNavbar ? "Navbar" : "Hidden"} · {(page.sections ?? []).length} designed sections
                </p>
                <h2 className="mt-2 text-xl font-bold">{page.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">/info/{page.slug}</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                {page.published ? "Published" : "Draft"}
              </span>
            </div>
            <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{page.heroDescription}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraft(toDraft(page))}><Pencil />Edit</Button>
              <Button variant="outline" size="sm" asChild><Link href={`/info/${page.slug}`} target="_blank"><ExternalLink />View</Link></Button>
              <Button variant="outline" size="sm" onClick={() => remove(page)}><Trash2 /></Button>
            </div>
          </article>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3 sm:p-7">
          <div className="mx-auto max-w-[1500px] rounded-[24px] bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-[24px] border-b bg-background/95 px-5 py-4 backdrop-blur sm:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Section page builder</p>
                <h2 className="mt-1 text-xl font-bold">{draft._id ? `Edit ${draft.title || "page"}` : "Create a designed page"}</h2>
              </div>
              <div className="flex gap-2">
                {draft.slug && <Button variant="outline" asChild><Link href={`/info/${draft.slug}`} target="_blank"><ExternalLink />Preview</Link></Button>}
                <Button variant="ghost" onClick={() => setDraft(null)}>Close</Button>
                <Button disabled={pending} onClick={save}>{pending ? "Saving..." : "Save page"}</Button>
              </div>
            </div>

            <div className="grid gap-8 p-5 sm:p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-7">
                <EditorCard title="Page & navbar" description="Basic URL, navbar placement and publishing controls.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Page title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
                    <Field label="Slug"><Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="auto-generated" /></Field>
                    <Field label="Navbar label"><Input value={draft.navLabel ?? ""} onChange={(e) => setDraft({ ...draft, navLabel: e.target.value })} /></Field>
                    <Field label="Navbar order"><Input type="number" value={draft.navOrder} onChange={(e) => setDraft({ ...draft, navOrder: Number(e.target.value) })} /></Field>
                  </div>
                  <Field label="Navbar description"><Textarea value={draft.navDescription ?? ""} onChange={(e) => setDraft({ ...draft, navDescription: e.target.value })} /></Field>
                  <div className="flex flex-wrap gap-5 text-sm font-semibold">
                    <CheckField label="Show in navbar" checked={draft.showInNavbar} onChange={(showInNavbar) => setDraft({ ...draft, showInNavbar })} />
                    <CheckField label="Published" checked={draft.published} onChange={(published) => setDraft({ ...draft, published })} />
                  </div>
                </EditorCard>

                <EditorCard title="Hero design" description="Choose how the first screen looks, then add text, image and as many conversion buttons as you need.">
                  <CheckField label="Enable hero section" checked={draft.heroEnabled ?? true} onChange={(heroEnabled) => setDraft({ ...draft, heroEnabled })} />
                  <div className={cn("grid gap-4 md:grid-cols-3", draft.heroEnabled === false && "opacity-50")}>
                    <SelectField label="Hero layout" value={draft.heroLayout || "split"} onChange={(heroLayout) => setDraft({ ...draft, heroLayout })} options={[
                      ["split", "Split image + text"],
                      ["centered", "Centered editorial"],
                      ["image-background", "Full image background"],
                    ]} />
                    <SelectField label="Hero tone" value={draft.heroTone || "soft"} onChange={(heroTone) => setDraft({ ...draft, heroTone })} options={[
                      ["light", "White"],
                      ["soft", "Warm soft"],
                      ["dark", "Dark"],
                      ["brand", "Brand tint"],
                    ]} />
                    <Field label="Eyebrow"><Input value={draft.eyebrow ?? ""} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} /></Field>
                  </div>
                  <Field label="Hero title"><Input value={draft.heroTitle ?? ""} onChange={(e) => setDraft({ ...draft, heroTitle: e.target.value })} /></Field>
                  <Field label="Hero description"><Textarea rows={4} value={draft.heroDescription ?? ""} onChange={(e) => setDraft({ ...draft, heroDescription: e.target.value })} /></Field>
                  <ButtonListEditor
                    title="Hero buttons"
                    description="Add unlimited buttons. Link to Home, Sign up, Login, Pricing, Blog, Dashboard, another dynamic page, a blog post, or any external URL."
                    buttons={draft.heroButtons ?? []}
                    onChange={(heroButtons) => setDraft({ ...draft, heroButtons })}
                  />
                  <UploadField
                    label="Hero image"
                    imageUrl={draft.heroImageUrl}
                    busy={uploadingKey === "hero"}
                    onUpload={async (file) => {
                      const heroImageUrl = await uploadFile(file, "hero");
                      if (heroImageUrl) setDraft({ ...draft, heroImageUrl });
                    }}
                  />
                </EditorCard>

                <EditorCard title="Add designed sections" description="Mix layouts freely. Sections render in the exact order shown below.">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {SECTION_TYPES.map(({ type, label, description, icon: Icon }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addSection(type)}
                        className="group rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                      >
                        <Icon className="size-5 text-primary" />
                        <p className="mt-3 text-sm font-bold">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                      </button>
                    ))}
                  </div>
                </EditorCard>

                {(draft.sections ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed bg-muted/20 p-12 text-center">
                    <p className="font-bold">No designed sections yet</p>
                    <p className="mt-2 text-sm text-muted-foreground">Pick a section type above. You can add as many as you need and reorder them later.</p>
                  </div>
                ) : (
                  <div className="grid gap-5">
                    {(draft.sections ?? []).map((section, sectionIndex) => (
                      <SectionEditor
                        key={section.id || sectionIndex}
                        section={section}
                        index={sectionIndex}
                        total={(draft.sections ?? []).length}
                        uploadingKey={uploadingKey}
                        onPatch={(patch) => updateSection(sectionIndex, patch)}
                        onMove={(direction) => moveSection(sectionIndex, direction)}
                        onDuplicate={() => duplicateSection(sectionIndex)}
                        onRemove={() => removeSection(sectionIndex)}
                        onAddItem={() => addSectionItem(sectionIndex)}
                        onRemoveItem={(itemIndex) => removeSectionItem(sectionIndex, itemIndex)}
                        onPatchItem={(itemIndex, patch) => updateSectionItem(sectionIndex, itemIndex, patch)}
                        onUploadPrimary={async (file) => {
                          const imageUrl = await uploadFile(file, `section-${sectionIndex}`);
                          if (imageUrl) updateSection(sectionIndex, { imageUrl });
                        }}
                        onUploadItem={async (itemIndex, file) => {
                          const imageUrl = await uploadFile(file, `section-${sectionIndex}-item-${itemIndex}`);
                          if (imageUrl) updateSectionItem(sectionIndex, itemIndex, { imageUrl });
                        }}
                      />
                    ))}
                  </div>
                )}

                <EditorCard title="Legacy card grid" description="Existing pages can keep their original 3–8 card grid. Disable it without deleting the saved cards.">
                  <CheckField label="Enable legacy card grid" checked={draft.legacyGridEnabled ?? true} onChange={(legacyGridEnabled) => setDraft({ ...draft, legacyGridEnabled })} />
                  <div className={cn("flex flex-wrap items-end justify-between gap-3", draft.legacyGridEnabled === false && "opacity-50")}>
                    <p className="text-sm text-muted-foreground">Leave these cards empty if you only want the new section builder.</p>
                    <Field label="Cards">
                      <Input type="number" min={3} max={8} value={draft.columnCount} onChange={(e) => setColumnCount(Number(e.target.value))} className="w-24" />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {draft.columns.slice(0, draft.columnCount).map((column, index) => (
                      <div key={index} className="grid gap-3 rounded-xl bg-muted/45 p-4">
                        <p className="text-sm font-bold">Legacy card {index + 1}</p>
                        <Input placeholder="Eyebrow" value={column.eyebrow ?? ""} onChange={(e) => updateColumn(index, { eyebrow: e.target.value })} />
                        <Input placeholder="Title" value={column.title ?? ""} onChange={(e) => updateColumn(index, { title: e.target.value })} />
                        <Textarea placeholder="Body" value={column.body ?? ""} onChange={(e) => updateColumn(index, { body: e.target.value })} />
                        <UploadField
                          label="Card image"
                          imageUrl={column.imageUrl}
                          compact
                          busy={uploadingKey === `legacy-${index}`}
                          onUpload={async (file) => {
                            const imageUrl = await uploadFile(file, `legacy-${index}`);
                            if (imageUrl) updateColumn(index, { imageUrl });
                          }}
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input placeholder="Link label" value={column.linkLabel ?? ""} onChange={(e) => updateColumn(index, { linkLabel: e.target.value })} />
                          <Input placeholder="Link URL" value={column.linkUrl ?? ""} onChange={(e) => updateColumn(index, { linkUrl: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </EditorCard>
              </div>

              <aside className="grid content-start gap-5 xl:sticky xl:top-24 xl:self-start">
                <EditorCard title="Automatic SEO" description="Every hero, legacy card and designed section is included in automatic SEO. These are optional overrides.">
                  <Field label="SEO title override"><Input value={draft.seoTitle ?? ""} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} /></Field>
                  <Field label="Meta description override"><Textarea value={draft.seoDescription ?? ""} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} /></Field>
                  <Field label="Keyword override"><Input value={draft.keywordsText} onChange={(e) => setDraft({ ...draft, keywordsText: e.target.value })} /></Field>
                  <Field label="Canonical URL override"><Input value={draft.canonicalUrl ?? ""} onChange={(e) => setDraft({ ...draft, canonicalUrl: e.target.value })} /></Field>
                  <Field label="Social title override"><Input value={draft.ogTitle ?? ""} onChange={(e) => setDraft({ ...draft, ogTitle: e.target.value })} /></Field>
                  <Field label="Social description override"><Textarea value={draft.ogDescription ?? ""} onChange={(e) => setDraft({ ...draft, ogDescription: e.target.value })} /></Field>
                  <UploadField
                    label="Social image override"
                    imageUrl={draft.ogImageUrl}
                    compact
                    busy={uploadingKey === "og"}
                    onUpload={async (file) => {
                      const ogImageUrl = await uploadFile(file, "og");
                      if (ogImageUrl) setDraft({ ...draft, ogImageUrl });
                    }}
                  />
                </EditorCard>
                <EditorCard title="Search robots" description="Control whether this specific page should be indexed and whether links may be followed.">
                  <CheckField label="Allow indexing" checked={draft.robotsIndex} onChange={(robotsIndex) => setDraft({ ...draft, robotsIndex })} />
                  <CheckField label="Allow following links" checked={draft.robotsFollow} onChange={(robotsFollow) => setDraft({ ...draft, robotsFollow })} />
                </EditorCard>
              </aside>
            </div>
          </div>
        </div>
      )}
    </AdminResourceShell>
  );
}

function SectionEditor({
  section,
  index,
  total,
  uploadingKey,
  onPatch,
  onMove,
  onDuplicate,
  onRemove,
  onAddItem,
  onRemoveItem,
  onPatchItem,
  onUploadPrimary,
  onUploadItem,
}: {
  section: AdminDynamicPageSection;
  index: number;
  total: number;
  uploadingKey: string;
  onPatch: (patch: Partial<AdminDynamicPageSection>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onAddItem: () => void;
  onRemoveItem: (itemIndex: number) => void;
  onPatchItem: (itemIndex: number, patch: Partial<AdminDynamicPageSectionItem>) => void;
  onUploadPrimary: (file?: File) => void;
  onUploadItem: (itemIndex: number, file?: File) => void;
}) {
  const supportsItems = ["feature-grid", "gallery", "stats", "testimonial", "logo-strip", "steps"].includes(section.type);
  const supportsButtons = true;
  const supportsColumns = ["feature-grid", "gallery", "stats", "testimonial", "logo-strip"].includes(section.type);
  const supportsPrimaryImage = section.type === "split";

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Section {index + 1}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h3 className="font-bold">{sectionName(section.type)}</h3>
            <CheckField label={section.enabled === false ? "Disabled" : "Enabled"} checked={section.enabled ?? true} onChange={(enabled) => onPatch({ enabled })} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"><MoveUp /></Button>
          <Button type="button" size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down"><MoveDown /></Button>
          <Button type="button" size="icon" variant="ghost" onClick={onDuplicate} title="Duplicate section"><Copy /></Button>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove} title="Delete section"><Trash2 /></Button>
        </div>
      </div>

      <div className={cn("grid gap-5 p-4 sm:p-5", section.enabled === false && "opacity-50")}>
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Background tone" value={section.tone || "light"} onChange={(tone) => onPatch({ tone })} options={[
            ["light", "White"],
            ["soft", "Warm soft"],
            ["dark", "Dark"],
            ["brand", "Brand tint"],
          ]} />
          <SelectField label="Text alignment" value={section.alignment || "left"} onChange={(alignment) => onPatch({ alignment })} options={[
            ["left", "Left"],
            ["center", "Centered"],
          ]} />
          {supportsColumns ? (
            <SelectField label="Columns" value={String(section.columns || 3)} onChange={(columns) => onPatch({ columns: Number(columns) })} options={[
              ["2", "2 columns"],
              ["3", "3 columns"],
              ["4", "4 columns"],
            ]} />
          ) : section.type === "split" ? (
            <SelectField label="Image position" value={section.layout || "image-right"} onChange={(layout) => onPatch({ layout })} options={[
              ["image-right", "Image right"],
              ["image-left", "Image left"],
            ]} />
          ) : <div />}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow"><Input value={section.eyebrow ?? ""} onChange={(e) => onPatch({ eyebrow: e.target.value })} /></Field>
          <Field label="Section title"><Input value={section.title ?? ""} onChange={(e) => onPatch({ title: e.target.value })} /></Field>
        </div>
        <Field label={section.type === "testimonial" ? "Intro text" : "Section text"}>
          <Textarea rows={4} value={section.body ?? ""} onChange={(e) => onPatch({ body: e.target.value })} />
        </Field>

        {supportsPrimaryImage && (
          <UploadField
            label="Section image"
            imageUrl={section.imageUrl}
            busy={uploadingKey === `section-${index}`}
            onUpload={onUploadPrimary}
          />
        )}

        {supportsButtons && (
          <ButtonListEditor
            title="Section buttons"
            description="Add as many buttons as you need and point them anywhere."
            buttons={section.buttons ?? []}
            onChange={(buttons) => onPatch({ buttons })}
          />
        )}

        {supportsItems && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{itemTitle(section.type)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{itemDescription(section.type)}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onAddItem}><Plus />Add item</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(section.items ?? []).map((item, itemIndex) => (
                <SectionItemEditor
                  key={item.id || itemIndex}
                  type={section.type}
                  item={item}
                  itemIndex={itemIndex}
                  busy={uploadingKey === `section-${index}-item-${itemIndex}`}
                  onPatch={(patch) => onPatchItem(itemIndex, patch)}
                  onRemove={() => onRemoveItem(itemIndex)}
                  onUpload={(file) => onUploadItem(itemIndex, file)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionItemEditor({
  type,
  item,
  itemIndex,
  busy,
  onPatch,
  onRemove,
  onUpload,
}: {
  type: AdminDynamicPageSectionType;
  item: AdminDynamicPageSectionItem;
  itemIndex: number;
  busy: boolean;
  onPatch: (patch: Partial<AdminDynamicPageSectionItem>) => void;
  onRemove: () => void;
  onUpload: (file?: File) => void;
}) {
  const imageType = ["feature-grid", "gallery", "testimonial", "logo-strip"].includes(type);
  return (
    <div className="grid gap-3 rounded-xl border bg-muted/25 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{itemLabel(type, itemIndex)}</p>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove}><Trash2 /></Button>
      </div>

      {type === "stats" ? (
        <>
          <Field label="Big value"><Input value={item.value ?? ""} onChange={(e) => onPatch({ value: e.target.value })} placeholder="98%" /></Field>
          <Field label="Label"><Input value={item.label ?? ""} onChange={(e) => onPatch({ label: e.target.value })} placeholder="Client satisfaction" /></Field>
        </>
      ) : type === "testimonial" ? (
        <>
          <Field label="Quote"><Textarea rows={4} value={item.body ?? ""} onChange={(e) => onPatch({ body: e.target.value })} /></Field>
          <Field label="Person name"><Input value={item.title ?? ""} onChange={(e) => onPatch({ title: e.target.value })} /></Field>
          <Field label="Role / company"><Input value={item.label ?? ""} onChange={(e) => onPatch({ label: e.target.value })} /></Field>
        </>
      ) : type === "logo-strip" ? (
        <Field label="Logo / brand name"><Input value={item.title ?? ""} onChange={(e) => onPatch({ title: e.target.value })} /></Field>
      ) : (
        <>
          {type === "feature-grid" && <Field label="Eyebrow"><Input value={item.eyebrow ?? ""} onChange={(e) => onPatch({ eyebrow: e.target.value })} /></Field>}
          <Field label={type === "gallery" ? "Caption title" : "Title"}><Input value={item.title ?? ""} onChange={(e) => onPatch({ title: e.target.value })} /></Field>
          <Field label={type === "gallery" ? "Caption" : "Text"}><Textarea rows={3} value={item.body ?? ""} onChange={(e) => onPatch({ body: e.target.value })} /></Field>
          {["feature-grid", "steps"].includes(type) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Link label" value={item.linkLabel ?? ""} onChange={(e) => onPatch({ linkLabel: e.target.value })} />
              <Input placeholder="Link URL" value={item.linkUrl ?? ""} onChange={(e) => onPatch({ linkUrl: e.target.value })} />
            </div>
          )}
        </>
      )}

      {imageType && (
        <UploadField label={type === "logo-strip" ? "Logo image" : type === "testimonial" ? "Person photo" : "Item image"} imageUrl={item.imageUrl} busy={busy} compact onUpload={onUpload} />
      )}
    </div>
  );
}

function EditorCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold"><span>{label}</span>{children}</label>;
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm font-normal">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </Field>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function ButtonListEditor({
  title,
  description,
  buttons,
  onChange,
}: {
  title: string;
  description?: string;
  buttons: AdminDynamicPageButton[];
  onChange: (buttons: AdminDynamicPageButton[]) => void;
}) {
  const patch = (index: number, next: Partial<AdminDynamicPageButton>) =>
    onChange(buttons.map((button, i) => (i === index ? { ...button, ...next } : button)));
  const remove = (index: number) => onChange(buttons.filter((_, i) => i !== index));

  return (
    <div className="grid gap-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{title}</p>
          {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...buttons, emptyButton()])}><Plus />Add button</Button>
      </div>
      {buttons.length === 0 && <p className="rounded-lg border border-dashed bg-white p-4 text-xs text-muted-foreground">No buttons yet. Add as many as you need.</p>}
      <div className="grid gap-3">
        {buttons.map((button, index) => (
          <div key={button.id || index} className="grid gap-3 rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <CheckField label={button.enabled === false ? "Disabled" : "Button " + (index + 1)} checked={button.enabled ?? true} onChange={(enabled) => patch(index, { enabled })} />
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)}><Trash2 /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label"><Input value={button.label ?? ""} onChange={(e) => patch(index, { label: e.target.value })} placeholder="Start free" /></Field>
              <Field label="Quick destination">
                <select
                  value={LINK_PRESETS.some(([value]) => value === button.url) ? button.url : ""}
                  onChange={(e) => e.target.value && patch(index, { url: e.target.value })}
                  className="h-10 rounded-md border bg-background px-3 text-sm font-normal"
                >
                  {LINK_PRESETS.map(([value, label]) => <option key={value || "custom"} value={value}>{label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="URL / route">
              <Input value={button.url ?? ""} onChange={(e) => patch(index, { url: e.target.value })} placeholder="/register, /info/my-page, /blog/post-slug, https://..." />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Style" value={button.style || "primary"} onChange={(style) => patch(index, { style })} options={[
                ["primary", "Primary"],
                ["secondary", "Secondary"],
                ["text", "Text link"],
              ]} />
              <div className="flex items-end pb-2">
                <CheckField label="Open in new tab" checked={button.newTab ?? false} onChange={(newTab) => patch(index, { newTab })} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadField({
  label,
  imageUrl,
  busy,
  compact = false,
  onUpload,
}: {
  label: string;
  imageUrl?: string;
  busy: boolean;
  compact?: boolean;
  onUpload: (file?: File) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">{label}</p>
      {imageUrl && <img src={imageUrl} alt="" className={cn("rounded-lg border object-cover", compact ? "h-28 w-full" : "max-h-72 w-full")} />}
      <label className={cn("flex cursor-pointer items-center justify-center rounded-lg border border-dashed bg-muted/25 px-4 text-sm font-semibold transition hover:bg-muted/45", compact ? "min-h-10" : "min-h-14", busy && "pointer-events-none opacity-60")}>
        {busy ? "Uploading image..." : imageUrl ? "Replace image" : "Upload image"}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(event) => onUpload(event.target.files?.[0])} />
      </label>
    </div>
  );
}

function itemTitle(type: AdminDynamicPageSectionType) {
  if (type === "stats") return "Stat blocks";
  if (type === "testimonial") return "Testimonials";
  if (type === "gallery") return "Gallery images";
  if (type === "logo-strip") return "Logos";
  if (type === "steps") return "Steps";
  return "Feature cards";
}

function itemDescription(type: AdminDynamicPageSectionType) {
  if (type === "stats") return "Add a value and label for every metric.";
  if (type === "testimonial") return "Add quote, person, role and optional portrait.";
  if (type === "gallery") return "Add images with optional captions.";
  if (type === "logo-strip") return "Add client, partner or publication logos.";
  if (type === "steps") return "Each item becomes the next numbered step.";
  return "Each item becomes a designed card.";
}

function itemLabel(type: AdminDynamicPageSectionType, index: number) {
  const base = type === "gallery" ? "Image" : type === "logo-strip" ? "Logo" : type === "stats" ? "Stat" : type === "testimonial" ? "Quote" : type === "steps" ? "Step" : "Card";
  return `${base} ${index + 1}`;
}

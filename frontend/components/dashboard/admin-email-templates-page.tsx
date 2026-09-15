"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  Copy,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Mail,
  Palette,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { updateHomeCms } from "@/actions/admin";
import { AdminResourceShell } from "@/components/dashboard/admin-resource-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { buildGalleryEmailHtml } from "@/lib/gallery-email";
import { CLIENT_GALLERY_CATEGORIES } from "@/lib/gallery-categories";
import {
  EMAIL_TEMPLATE_CATEGORIES,
  EMAIL_TEMPLATE_LANGUAGES,
  type EmailTemplateItem,
  type HomeCmsData,
} from "@/lib/home-cms";

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
  eyebrowText: "Client Gallery",
  showImage: true,
  showBranding: true,
  useBrandColor: true,
  category: "Gallery Delivery",
  galleryCategory: "Wedding",
  customGalleryCategoryLabel: "",
  language: "English",
  updatedAt: "Draft",
  source: "admin",
});

export function AdminEmailTemplatesPage({
  initialCms,
}: {
  initialCms: HomeCmsData;
}) {
  const [cms, setCms] = useState(initialCms);
  const [activeId, setActiveId] = useState(
    initialCms.emailTemplates[0]?.id ?? "",
  );
  const [draft, setDraft] = useState<EmailTemplateItem | null>(
    initialCms.emailTemplates[0] ?? null,
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState("All");
  const [languageFilter, setLanguageFilter] = useState("All");
  const [pending, startTransition] = useTransition();

  const templates = useMemo(
    () => cms.emailTemplates ?? [],
    [cms.emailTemplates],
  );
  const visibleTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter(
      (template) =>
        (categoryFilter === "All" ||
          (template.category || "Gallery Delivery") === categoryFilter) &&
        (galleryCategoryFilter === "All" ||
          (template.galleryCategory || "General") === galleryCategoryFilter) &&
        (languageFilter === "All" ||
          (template.language || "English") === languageFilter) &&
        (!term ||
          [
            template.name,
            template.subject,
            template.previewText,
            template.category,
            template.galleryCategory,
            template.language,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [
    categoryFilter,
    galleryCategoryFilter,
    languageFilter,
    search,
    templates,
  ]);

  const previewHtml = useMemo(() => {
    if (!draft) return "";
    const usesBrandColor = draft.useBrandColor !== false;
    return buildGalleryEmailHtml({
      previewText: draft.previewText,
      eyebrowText: draft.eyebrowText || "Client Gallery",
      title: draft.title || "Your photos are ready",
      message: draft.message,
      buttonText: draft.buttonText || "View Gallery",
      buttonLink:
        /^(https?:\/\/|mailto:)/i.test(draft.buttonLink || "")
          ? draft.buttonLink
          : "#",
      buttonColor: usesBrandColor ? "#6d5ce7" : draft.buttonColor,
      footerText: draft.footerText,
      brandText: "YOUR STUDIO",
      imageUrl: draft.image,
      showBranding: draft.showBranding !== false,
      showImage: draft.showImage !== false,
      brandingPosition: draft.brandingPosition,
    });
  }, [draft]);

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
    const template = {
      ...draft,
      id: `admin-email-${Date.now()}`,
      name: `${draft.name} Copy`,
      updatedAt: "Draft",
    };
    setActiveId(template.id);
    setDraft(template);
  };

  const persist = (nextTemplates: EmailTemplateItem[], success: string) => {
    startTransition(async () => {
      try {
        const saved = await updateHomeCms({
          ...cms,
          emailTemplates: nextTemplates,
        });
        setCms(saved);
        const nextActive =
          saved.emailTemplates.find((item) => item.id === activeId) ??
          saved.emailTemplates[0] ??
          null;
        setActiveId(nextActive?.id ?? "");
        setDraft(nextActive);
        toast.success(success);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Template could not be saved",
        );
      }
    });
  };

  const save = () => {
    if (!draft?.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!draft.subject.trim()) {
      toast.error("Email subject is required");
      return;
    }
    const savedDraft = {
      ...draft,
      source: "admin" as const,
      showBranding: draft.showBranding !== false,
      showImage: draft.showImage !== false,
      useBrandColor: draft.useBrandColor !== false,
      updatedAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
    const exists = templates.some((item) => item.id === savedDraft.id);
    persist(
      exists
        ? templates.map((item) =>
            item.id === savedDraft.id ? savedDraft : item,
          )
        : [savedDraft, ...templates],
      "Email template saved",
    );
  };

  const remove = () => {
    if (!draft || !templates.some((item) => item.id === draft.id)) return;
    persist(
      templates.filter((item) => item.id !== draft.id),
      "Email template deleted",
    );
  };

  const update = (value: Partial<EmailTemplateItem>) =>
    setDraft((current) => (current ? { ...current, ...value } : current));

  return (
    <AdminResourceShell
      active="emails"
      title="Email Template Studio"
      subtitle="Build polished gallery emails. Studio branding is applied automatically for each user, and the live preview uses the same layout as the delivered email."
      action={
        <Button
          onClick={create}
          className="h-11 rounded-xl bg-[#171717] px-5 text-white shadow-lg shadow-black/10"
        >
          <Plus className="size-4" />
          New template
        </Button>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={LayoutTemplate}
          label="Templates"
          value={String(templates.length)}
        />
        <SummaryCard
          icon={Sparkles}
          label="Branding"
          value="Automatic"
        />
        <SummaryCard
          icon={Mail}
          label="Delivery preview"
          value="Matched"
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_50px_rgba(20,20,20,0.06)] xl:sticky xl:top-6">
          <div className="border-b border-[#ecece9] p-4">
            <div className="flex items-center gap-2 rounded-xl border border-[#deded9] bg-[#fafaf8] px-3">
              <Search className="size-4 text-[#8b8b84]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search templates"
                className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FilterSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                label="Purpose"
                options={EMAIL_TEMPLATE_CATEGORIES}
              />
              <FilterSelect
                value={languageFilter}
                onChange={setLanguageFilter}
                label="Language"
                options={EMAIL_TEMPLATE_LANGUAGES}
              />
            </div>
            <div className="mt-2">
              <FilterSelect
                value={galleryCategoryFilter}
                onChange={setGalleryCategoryFilter}
                label="Gallery type"
                options={["General", ...CLIENT_GALLERY_CATEGORIES]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 text-xs text-[#777]">
            <span>{visibleTemplates.length} results</span>
            {(search ||
              categoryFilter !== "All" ||
              galleryCategoryFilter !== "All" ||
              languageFilter !== "All") && (
              <button
                type="button"
                className="font-semibold text-[#5f4fd1]"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setGalleryCategoryFilter("All");
                  setLanguageFilter("All");
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="max-h-[calc(100vh-330px)] min-h-72 space-y-2 overflow-y-auto px-3 pb-3">
            {visibleTemplates.map((template) => (
              <button
                type="button"
                key={template.id}
                onClick={() => select(template)}
                className={`w-full rounded-xl border p-4 text-left transition ${activeId === template.id ? "border-[#6d5ce7] bg-[#f5f2ff] shadow-sm" : "border-transparent hover:border-[#e4e1ec] hover:bg-[#faf9fc]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate font-semibold text-[#222]">
                    {template.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#7b6db6]">
                    {template.language || "English"}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-[#777]">
                  {template.subject || "No subject"}
                </p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a958e]">
                  {template.category || "Gallery Delivery"}
                  {" · "}
                  {template.galleryCategory || "General"}
                </p>
              </button>
            ))}
            {!visibleTemplates.length && (
              <div className="grid min-h-52 place-items-center px-6 text-center">
                <div>
                  <Search className="mx-auto size-7 text-[#aaa]" />
                  <p className="mt-3 text-sm font-semibold">
                    No matching templates
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#888]">
                    Try a different keyword or clear the filters.
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <section className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_50px_rgba(20,20,20,0.06)]">
          {draft ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ecece9] px-5 py-4 sm:px-7">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b8782]">
                    Editing template
                  </p>
                  <h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.02em]">
                    {draft.name}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={duplicate}
                  >
                    <Copy className="size-4" />
                    Duplicate
                  </Button>
                  {templates.length > 1 &&
                    templates.some((item) => item.id === draft.id) && (
                      <Button
                        variant="outline"
                        className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={pending}
                        onClick={remove}
                        aria-label="Delete template"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  <Button
                    className="rounded-xl bg-[#171717] text-white"
                    disabled={pending}
                    onClick={save}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save template
                  </Button>
                </div>
              </div>

              <div className="grid 2xl:grid-cols-[minmax(430px,0.92fr)_minmax(460px,1.08fr)]">
                <div className="space-y-5 border-b border-[#ecece9] bg-[#fcfcfb] p-5 sm:p-7 2xl:border-b-0 2xl:border-r">
                  <EditorSection title="Template details">
                    <Field label="Template name">
                      <Input
                        value={draft.name}
                        onChange={(event) =>
                          update({ name: event.target.value })
                        }
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Purpose">
                        <SelectInput
                          value={draft.category || "Gallery Delivery"}
                          onChange={(value) => update({ category: value })}
                          options={EMAIL_TEMPLATE_CATEGORIES}
                        />
                      </Field>
                      <Field label="Gallery">
                        <SelectInput
                          value={draft.galleryCategory || ""}
                          onChange={(value) =>
                            update({
                              galleryCategory: value || undefined,
                              customGalleryCategoryLabel:
                                value === "Custom label"
                                  ? draft.customGalleryCategoryLabel
                                  : "",
                            })
                          }
                          options={CLIENT_GALLERY_CATEGORIES}
                          emptyLabel="All gallery types"
                        />
                      </Field>
                      <Field label="Language">
                        <SelectInput
                          value={draft.language || "English"}
                          onChange={(value) => update({ language: value })}
                          options={EMAIL_TEMPLATE_LANGUAGES}
                        />
                      </Field>
                    </div>
                    {draft.galleryCategory === "Custom label" && (
                      <Field label="Custom gallery label">
                        <Input
                          value={draft.customGalleryCategoryLabel || ""}
                          onChange={(event) =>
                            update({
                              customGalleryCategoryLabel: event.target.value,
                            })
                          }
                          placeholder="e.g. Newborn, Corporate Gala"
                        />
                      </Field>
                    )}
                  </EditorSection>

                  <EditorSection title="Email copy">
                    <Field label="Subject">
                      <Input
                        value={draft.subject}
                        onChange={(event) =>
                          update({ subject: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Preview text">
                      <Input
                        value={draft.previewText}
                        onChange={(event) =>
                          update({ previewText: event.target.value })
                        }
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Eyebrow">
                        <Input
                          value={draft.eyebrowText || ""}
                          onChange={(event) =>
                            update({ eyebrowText: event.target.value })
                          }
                          placeholder="Client Gallery"
                        />
                      </Field>
                      <Field label="Fallback title">
                        <Input
                          value={draft.title}
                          onChange={(event) =>
                            update({ title: event.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Message">
                      <Textarea
                        className="min-h-40 resize-y"
                        value={draft.message}
                        onChange={(event) =>
                          update({ message: event.target.value })
                        }
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Button text">
                        <Input
                          value={draft.buttonText}
                          onChange={(event) =>
                            update({ buttonText: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Button link">
                        <Input
                          value={draft.buttonLink}
                          onChange={(event) =>
                            update({ buttonLink: event.target.value })
                          }
                          placeholder="Collection URL"
                        />
                      </Field>
                    </div>
                    <Field label="Footer">
                      <Textarea
                        value={draft.footerText}
                        onChange={(event) =>
                          update({ footerText: event.target.value })
                        }
                      />
                    </Field>
                  </EditorSection>

                  <EditorSection title="Visual options">
                    <ToggleRow
                      icon={Sparkles}
                      title="Automatic studio branding"
                      description="Insert each user's logo and studio name from Settings → Branding."
                      checked={draft.showBranding !== false}
                      onCheckedChange={(checked) =>
                        update({ showBranding: checked })
                      }
                    />
                    {draft.showBranding !== false && (
                      <Field label="Branding position">
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              { value: "top", label: "Top of email" },
                              { value: "bottom", label: "Bottom of email" },
                            ] as const
                          ).map((option) => {
                            const active =
                              (draft.brandingPosition ?? "top") === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  update({ brandingPosition: option.value })
                                }
                                className={`h-10 rounded-lg border px-3 text-xs font-bold ${
                                  active
                                    ? "border-[#6d5ce7] bg-[#6d5ce7] text-white"
                                    : "border-black/10 bg-white text-[#333]"
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </Field>
                    )}
                    <ToggleRow
                      icon={Palette}
                      title="Use brand accent"
                      description="Use the user's branding color for the call-to-action button."
                      checked={draft.useBrandColor !== false}
                      onCheckedChange={(checked) =>
                        update({ useBrandColor: checked })
                      }
                    />
                    {draft.useBrandColor === false && (
                      <Field label="Custom button color">
                        <div className="flex gap-3">
                          <Input
                            type="color"
                            className="w-16 p-1"
                            value={draft.buttonColor}
                            onChange={(event) =>
                              update({ buttonColor: event.target.value })
                            }
                          />
                          <Input
                            value={draft.buttonColor}
                            onChange={(event) =>
                              update({ buttonColor: event.target.value })
                            }
                          />
                        </div>
                      </Field>
                    )}
                    <ToggleRow
                      icon={ImageIcon}
                      title="Show hero image"
                      description="Use the template image first, then the gallery cover."
                      checked={draft.showImage !== false}
                      onCheckedChange={(checked) =>
                        update({ showImage: checked })
                      }
                    />
                    {draft.showImage !== false && (
                      <Field label="Template image URL">
                        <Input
                          value={draft.image}
                          onChange={(event) =>
                            update({ image: event.target.value })
                          }
                          placeholder="Optional — gallery cover is the fallback"
                        />
                      </Field>
                    )}
                  </EditorSection>
                </div>

                <div className="bg-[#eeece8] p-4 sm:p-7">
                  <div className="2xl:sticky 2xl:top-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#77736e]">
                          Live delivery preview
                        </p>
                        <p className="mt-1 text-xs text-[#827d76]">
                          The sent email uses this same renderer.
                        </p>
                      </div>
                      <span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6558a7]">
                        Exact layout
                      </span>
                    </div>
                    <div
                      className="overflow-hidden rounded-xl bg-white shadow-[0_25px_70px_rgba(50,42,30,0.16)]"
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a")) {
                          event.preventDefault();
                        }
                      }}
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                    <div className="mt-4 rounded-xl border border-black/5 bg-white/75 p-4 text-xs leading-5 text-[#69645e]">
                      <span className="font-semibold text-[#302d29]">
                        Branding preview:
                      </span>{" "}
                      “YOUR STUDIO” and purple are placeholders. Each sender’s
                      saved logo, studio name, and accent color are inserted
                      automatically. Users can turn branding off before sending.
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-[#f1eefc] text-[#6d5ce7]">
                <Mail className="size-6" />
              </span>
              <p className="mt-5 text-lg font-semibold">
                Create your first email template
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#777]">
                Build a reusable layout that automatically adopts each
                photographer’s branding.
              </p>
              <Button
                onClick={create}
                className="mt-5 rounded-xl bg-[#171717] text-white"
              >
                <Plus className="size-4" />
                New template
              </Button>
            </div>
          )}
        </section>
      </div>
    </AdminResourceShell>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/7 bg-white p-4 shadow-[0_10px_30px_rgba(20,20,20,0.04)]">
      <span className="grid size-10 place-items-center rounded-xl bg-[#f1eefc] text-[#6654d6]">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#92908a]">
          {label}
        </p>
        <p className="mt-0.5 font-semibold text-[#242424]">{value}</p>
      </div>
    </div>
  );
}

function EditorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e7e5e0] bg-white p-5">
      <h3 className="mb-5 text-sm font-semibold text-[#272727]">{title}</h3>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#77736e]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: readonly string[];
}) {
  return (
    <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wider text-[#8b8782]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-lg border border-[#deded9] bg-white px-2 text-xs font-normal normal-case tracking-normal text-[#333]"
      >
        <option>All</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  emptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  emptyLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 min-w-0 rounded-lg border border-input bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#333]"
    >
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#eceae5] bg-[#fafaf8] p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#6d5ce7] shadow-sm">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#2c2c2c]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#7b7771]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

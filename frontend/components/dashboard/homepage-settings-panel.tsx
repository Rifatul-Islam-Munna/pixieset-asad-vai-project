"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PlanFeatureLock } from "@/components/dashboard/plan-feature-lock";
import { useCollections } from "@/api-hooks/use-collections";
import {
  type HomepageRecord,
  type HomepageSite,
  type HomepageVisibility,
  useHomepageSettings,
} from "@/api-hooks/use-homepage";

const defaultVisibility: HomepageVisibility = {
  biography: true,
  social: true,
  website: true,
  email: true,
  phone: true,
  address: true,
};

const emptyForm: Omit<HomepageRecord, "_id" | "userId" | "slug" | "publicPath" | "hasPassword" | "sites" | "subdomainLimit" | "subdomainsUsed"> = {
  enabled: true,
  brandName: "",
  logoUrl: "",
  biography: "",
  website: "",
  email: "",
  phone: "",
  address: "",
  socialLinks: {},
  show: defaultVisibility,
  sortOrder: "newest",
  showCategories: true,
  featuredCollectionIds: [],
};

export function HomepageSettingsPanel() {
  const { query, update, createSubdomain, updateSubdomain, deleteSubdomain } = useHomepageSettings();
  const { collectionsQuery } = useCollections();
  const record = query.data?.data;
  const publishedCollections = useMemo(
    () => (collectionsQuery.data?.data ?? []).filter((collection) => collection.status === "published"),
    [collectionsQuery.data],
  );
  const [form, setForm] = useState(emptyForm);
  const [password, setPassword] = useState("");
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [siteDrafts, setSiteDrafts] = useState<Record<string, Pick<HomepageSite, "name" | "slug">>>({});
  const [newSite, setNewSite] = useState({ name: "", slug: "" });

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!record) return;
    setSiteDrafts(Object.fromEntries((record.sites ?? []).map((site) => [site.id, { name: site.name, slug: site.slug }])));
    setForm({
      enabled: record.enabled,
      brandName: record.brandName || "",
      logoUrl: record.logoUrl || "",
      biography: record.biography || "",
      website: record.website || "",
      email: record.email || "",
      phone: record.phone || "",
      address: record.address || "",
      socialLinks: record.socialLinks || {},
      show: { ...defaultVisibility, ...(record.show || {}) },
      sortOrder: record.sortOrder || "newest",
      showCategories: record.showCategories !== false,
      featuredCollectionIds: Array.isArray(record.featuredCollectionIds) ? record.featuredCollectionIds : [],
    });
  }, [record]);

  const publicUrl = useMemo(
    () => record?.slug ? homepageUrl(origin, record.slug) : "Generating your unique URL...",
    [origin, record?.slug],
  );
  const subdomainLimit = Math.max(0, Number(record?.subdomainLimit ?? 1));
  const subdomainsUsed = Number(record?.subdomainsUsed ?? record?.sites?.length ?? 1);
  const canCreateSubdomain = subdomainLimit === 0 || subdomainsUsed < subdomainLimit;

  const save = () => {
    update.mutate(
      {
        ...form,
        ...(passwordDirty ? { password } : {}),
      },
      {
        onSuccess: () => {
          setPassword("");
          setPasswordDirty(false);
          toast.success("Homepage saved");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const createSite = () => {
    const name = newSite.name.trim();
    const slug = newSite.slug.trim().toLowerCase();
    if (!name || !slug) {
      toast.error("Add a name and subdomain");
      return;
    }
    createSubdomain.mutate(
      { name, slug },
      {
        onSuccess: () => {
          setNewSite({ name: "", slug: "" });
          toast.success("Subdomain created");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const saveSite = (site: HomepageSite) => {
    const draft = siteDrafts[site.id];
    if (!draft) return;
    updateSubdomain.mutate(
      {
        siteId: site.id,
        name: draft.name.trim(),
        slug: draft.slug.trim().toLowerCase(),
      },
      {
        onSuccess: () => toast.success(site.isMain ? "Main subdomain updated" : "Subdomain updated"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const removeSite = (site: HomepageSite) => {
    if (site.isMain) return;
    if (!window.confirm(`Delete ${site.slug}? Galleries assigned only to it will move back to the main subdomain.`)) return;
    deleteSubdomain.mutate(site.id, {
      onSuccess: () => toast.success("Subdomain deleted"),
      onError: (error) => toast.error(error.message),
    });
  };

  const copyUrl = async () => {
    if (!record?.slug) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Homepage URL copied");
    window.setTimeout(() => setCopied(false), 1600);
  };

  const generatePassword = () => {
    const value = Math.random().toString(36).slice(2, 10).toUpperCase();
    setPassword(value);
    setPasswordDirty(true);
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    setLogoUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/mobile-gallery/assets", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok || !payload?.data?.url) throw new Error(payload?.message || "Logo upload failed");
      const uploaded = String(payload.data.url);
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
      const logoUrl = uploaded.startsWith("/") ? `${base}${uploaded}` : uploaded;
      setForm((current) => ({ ...current, logoUrl }));
      toast.success("Logo uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo upload failed");
    } finally { setLogoUploading(false); }
  };

  const toggleVisibility = (key: keyof HomepageVisibility) => {
    setForm((current) => ({
      ...current,
      show: { ...current.show, [key]: !current.show[key] },
    }));
  };

  const toggleFeaturedCollection = (collectionId: string) => {
    setForm((current) => {
      const selected = current.featuredCollectionIds.includes(collectionId);
      if (!selected && current.featuredCollectionIds.length >= 12) {
        toast.error("You can feature up to 12 galleries");
        return current;
      }
      return {
        ...current,
        featuredCollectionIds: selected
          ? current.featuredCollectionIds.filter((id) => id !== collectionId)
          : [...current.featuredCollectionIds, collectionId],
      };
    });
  };

  if (query.isLoading) {
    return <div className="flex min-h-[520px] items-center justify-center"><Loader2 className="size-7 animate-spin text-[#6F57D9]" /></div>;
  }

  if (query.isError) {
    return <div className="border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load homepage settings.</div>;
  }

  return (
    <div className="min-h-full bg-transparent pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E5E1] pb-6">
        <div>
          <h1 className="text-2xl font-semibold md:text-[28px]">Homepage</h1>
          <p className="mt-2 text-sm text-[#667085]">Your public portfolio page shows only collections marked as Published.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={!record?.slug}
            onClick={() => record?.slug && window.open(publicUrl, "_blank", "noopener,noreferrer")}
            className="inline-flex h-11 items-center gap-2 border border-[#E8E5E1] bg-white px-5 text-sm font-bold disabled:opacity-50"
          >
            <ExternalLink className="size-4" />View Site
          </button>
          <button
            type="button"
            disabled={update.isPending}
            onClick={save}
            className="inline-flex h-11 items-center gap-2 bg-[#1C1C1C] px-6 text-sm font-bold text-white hover:bg-[#2E2E2E] disabled:opacity-60"
          >
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-10 xl:grid-cols-[minmax(420px,620px)_minmax(420px,1fr)] xl:gap-14">
        <div className="min-w-0">
          <Section title="Homepage Status">
            <label className="inline-flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                className="peer sr-only"
              />
              <span className="relative h-6 w-11 rounded-full bg-[#d8d8d8] transition peer-checked:bg-[#6F57D9] after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
              <span className="text-sm font-medium">{form.enabled ? "On" : "Off"}</span>
            </label>
            <HelpText>Your homepage is public when switched on. Draft collections never appear here.</HelpText>
          </Section>

          <Section title="Homepage URL">
            <div className="flex min-h-14 items-center justify-between gap-3 border border-[#E8E5E1] bg-white px-5 py-3 shadow-[0_12px_34px_rgba(21,21,21,0.03)]">
              <span className="min-w-0 truncate text-sm font-medium">{publicUrl}</span>
              <button type="button" onClick={copyUrl} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[#6F57D9]">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}
              </button>
            </div>
          </Section>

          <Section title="Subdomains">
            <div className="flex items-center justify-between gap-4 border border-[#E8E5E1] bg-[#FAFAF8] px-4 py-3">
              <div>
                <p className="text-sm font-bold">Public sites</p>
                <p className="mt-1 text-xs text-[#667085]">Your current subdomain is the main site. Add more and route galleries to each one.</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-[#6F57D9]">
                {subdomainsUsed} / {subdomainLimit === 0 ? "Unlimited" : subdomainLimit}
              </span>
            </div>

            <div className="grid gap-3">
              {(record?.sites ?? []).map((site) => {
                const draft = siteDrafts[site.id] ?? { name: site.name, slug: site.slug };
                return (
                  <div key={site.id} className="border border-[#E8E5E1] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Globe2 className="size-4 text-[#6F57D9]" />
                        <span className="text-sm font-bold">{site.isMain ? "Main subdomain" : "Subdomain"}</span>
                        {site.isMain && <span className="bg-[#EEE9FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6F57D9]">Default</span>}
                      </div>
                      {!site.isMain && (
                        <button type="button" onClick={() => removeSite(site)} disabled={deleteSubdomain.isPending} className="inline-flex items-center gap-1 text-xs font-bold text-red-600 disabled:opacity-50">
                          <Trash2 className="size-3.5" />Delete
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#667085]">Name</span>
                        <input value={draft.name} onChange={(event) => setSiteDrafts((current) => ({ ...current, [site.id]: { ...draft, name: event.target.value } }))} className="h-11 border border-[#E8E5E1] px-3 text-sm outline-none focus:border-[#6F57D9]" />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#667085]">Subdomain</span>
                        <input value={draft.slug} onChange={(event) => setSiteDrafts((current) => ({ ...current, [site.id]: { ...draft, slug: event.target.value.toLowerCase() } }))} className="h-11 border border-[#E8E5E1] px-3 text-sm outline-none focus:border-[#6F57D9]" />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <button type="button" onClick={() => void navigator.clipboard.writeText(homepageUrl(origin, site.slug)).then(() => toast.success("Subdomain URL copied"))} className="min-w-0 truncate text-left text-xs font-semibold text-[#667085] hover:text-[#6F57D9]">
                        {homepageUrl(origin, site.slug)}
                      </button>
                      <button type="button" onClick={() => saveSite(site)} disabled={updateSubdomain.isPending} className="inline-flex h-9 items-center gap-2 bg-[#1C1C1C] px-4 text-xs font-bold text-white disabled:opacity-50">
                        {updateSubdomain.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}Save
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border border-dashed border-[#CFC9E8] bg-[#FAF9FF] p-4">
              <p className="text-sm font-bold">Add another subdomain</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={newSite.name} onChange={(event) => setNewSite((current) => ({ ...current, name: event.target.value }))} placeholder="Site name" disabled={!canCreateSubdomain} className="h-11 border border-[#E8E5E1] bg-white px-3 text-sm outline-none disabled:opacity-50" />
                <input value={newSite.slug} onChange={(event) => setNewSite((current) => ({ ...current, slug: event.target.value.toLowerCase() }))} placeholder="new-subdomain" disabled={!canCreateSubdomain} className="h-11 border border-[#E8E5E1] bg-white px-3 text-sm outline-none disabled:opacity-50" />
              </div>
              <button type="button" onClick={createSite} disabled={!canCreateSubdomain || createSubdomain.isPending} className="mt-3 inline-flex h-10 items-center gap-2 bg-[#6F57D9] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {createSubdomain.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {canCreateSubdomain ? "Create subdomain" : "Plan limit reached"}
              </button>
            </div>
            <HelpText>Subdomain limits come from the account plan. You can rename a subdomain anytime; gallery assignments use stable IDs so renaming does not move or lose galleries.</HelpText>
          </Section>

          <PlanFeatureLock feature="passwordProtection" label="Password Protection">
            <Section title="Homepage Password">
              <div className="flex min-h-14 items-center gap-3 border px-4">
                <input
                  type="text"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setPasswordDirty(true); }}
                  placeholder={record?.hasPassword && !passwordDirty ? "Password is set" : "Add a password"}
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <button type="button" onClick={generatePassword} className="inline-flex items-center gap-2 text-sm font-bold text-[#6F57D9]"><RefreshCw className="size-4" />Generate</button>
                {record?.hasPassword && (
                  <button type="button" onClick={() => { setPassword(""); setPasswordDirty(true); }} className="text-xs font-bold text-red-600">Remove</button>
                )}
              </div>
              <HelpText>Leave unchanged to keep the current password. Remove clears homepage protection.</HelpText>
            </Section>
          </PlanFeatureLock>

          <Section title="Homepage Identity">
            <Field label="Studio / Brand Name" value={form.brandName} onChange={(brandName) => setForm((current) => ({ ...current, brandName }))} />
            <div className="grid gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#667085]">Homepage Logo</span>
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 border border-dashed border-[#CFC9E8] bg-white px-4 text-sm font-bold text-[#6F57D9] hover:bg-[#FAF9FF]">
                <UploadCloud className="size-4" />{logoUploading ? "Uploading..." : "Upload logo"}
                <input type="file" accept="image/*" disabled={logoUploading} className="sr-only" onChange={(event) => void uploadLogo(event.target.files?.[0])} />
              </label>
              {form.logoUrl && <div className="flex items-center justify-between gap-4 border bg-white p-3"><img src={form.logoUrl} alt="Homepage logo preview" className="max-h-14 max-w-44 object-contain" /><button type="button" onClick={() => setForm((current) => ({ ...current, logoUrl: "" }))} className="inline-flex items-center gap-2 text-xs font-bold text-red-600"><X className="size-4" />Remove</button></div>}
              <Field label="Or paste logo URL" value={form.logoUrl} onChange={(logoUrl) => setForm((current) => ({ ...current, logoUrl }))} placeholder="https://..." />
            </div>
          </Section>

          <Section title="Biography">
            <div className="border border-[#E8E5E1] bg-white">
              <textarea
                value={form.biography}
                onChange={(event) => setForm((current) => ({ ...current, biography: event.target.value.slice(0, 500) }))}
                maxLength={500}
                className="min-h-40 w-full resize-none p-4 text-sm outline-none"
              />
              <p className="px-4 pb-3 text-xs font-semibold text-[#667085]">{form.biography.length} / 500</p>
            </div>
          </Section>

          <Section title="Homepage Info">
            <div className="grid gap-4">
              <Field icon={<Globe2 className="size-4" />} label="Website" value={form.website} onChange={(website) => setForm((current) => ({ ...current, website }))} />
              <Field icon={<Mail className="size-4" />} label="Contact Email" value={form.email} onChange={(email) => setForm((current) => ({ ...current, email }))} />
              <Field icon={<Phone className="size-4" />} label="Phone Number" value={form.phone} onChange={(phone) => setForm((current) => ({ ...current, phone }))} />
              <Field icon={<MapPin className="size-4" />} label="Business Address" value={form.address} onChange={(address) => setForm((current) => ({ ...current, address }))} />
            </div>
          </Section>

          <Section title="Social Links">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field icon={<SocialIcon network="instagram" />} label="Instagram" value={form.socialLinks.instagram || ""} onChange={(instagram) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, instagram } }))} />
              <Field icon={<SocialIcon network="facebook" />} label="Facebook" value={form.socialLinks.facebook || ""} onChange={(facebook) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, facebook } }))} />
              <Field icon={<SocialIcon network="youtube" />} label="YouTube" value={form.socialLinks.youtube || ""} onChange={(youtube) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, youtube } }))} />
              <Field icon={<SocialIcon network="linkedin" />} label="LinkedIn" value={form.socialLinks.linkedin || ""} onChange={(linkedin) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, linkedin } }))} />
            </div>
          </Section>

          <Section title="Show on Homepage">
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["biography", "Biography"],
                ["social", "Social Links"],
                ["website", "Website"],
                ["email", "Contact Email"],
                ["phone", "Phone Number"],
                ["address", "Business Address"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                  <input type="checkbox" checked={form.show[key]} onChange={() => toggleVisibility(key)} className="size-4 accent-[#6F57D9]" />
                  {label}
                </label>
              ))}
            </div>
            <HelpText>Blank information is automatically hidden even when selected.</HelpText>
          </Section>

          <Section title="Featured Galleries & Categories">
            <label className="flex cursor-pointer items-center justify-between gap-4 border bg-white p-4">
              <span><span className="block text-sm font-bold">Show gallery categories</span><span className="mt-1 block text-xs leading-5 text-[#777]">Uses Category Tags from each gallery as filter tabs on your public homepage.</span></span>
              <input type="checkbox" checked={form.showCategories} onChange={(event) => setForm((current) => ({ ...current, showCategories: event.target.checked }))} className="size-4 accent-[#6F57D9]" />
            </label>
            <div>
              <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-bold">Feature galleries first</p><span className="text-xs font-semibold text-[#777]">{form.featuredCollectionIds.length}/12 selected</span></div>
              <div className="max-h-[330px] overflow-y-auto border bg-white">
                {publishedCollections.map((collection) => {
                  const checked = form.featuredCollectionIds.includes(collection._id);
                  return (
                    <label key={collection._id} className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-[#fafafa]">
                      <input type="checkbox" checked={checked} onChange={() => toggleFeaturedCollection(collection._id)} className="size-4 accent-[#6F57D9]" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{collection.name}</span><span className="block truncate text-xs text-[#888]">{collection.tags?.length ? collection.tags.join(" · ") : "No category tags yet"}</span></span>
                    </label>
                  );
                })}
                {!publishedCollections.length && <p className="p-5 text-sm text-[#777]">Publish a gallery first, then it can be featured here.</p>}
              </div>
            </div>
            <HelpText>Featured galleries appear before the rest of your work. Category filters are built from the tags you already add inside each gallery.</HelpText>
          </Section>

          <Section title="Collection Sort Order">
            <select
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value as typeof current.sortOrder }))}
              className="h-14 w-full border border-[#E8E5E1] bg-white px-5 text-sm font-bold outline-none"
            >
              <option value="newest">Date created: New to Old</option>
              <option value="oldest">Date created: Old to New</option>
              <option value="name">Collection name: A to Z</option>
            </select>
          </Section>
        </div>

        <div className="sticky top-8 hidden min-h-[610px] items-center justify-center border border-[#E8E5E1] bg-[#F3F0EA] p-10 shadow-[0_18px_60px_rgba(21,21,21,0.04)] xl:flex">
          <div className="w-full max-w-[520px] bg-white px-8 py-10 shadow-[0_28px_70px_rgba(21,21,21,0.10)]">
            <div className="flex justify-center">
              {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-12 max-w-28 object-contain" /> : <div className="flex size-12 items-center justify-center rounded-full bg-[#111] text-xs font-bold text-white">LOGO</div>}
            </div>
            <div className="mt-6 text-center">
              <p className="text-lg font-bold uppercase tracking-[0.12em]">{form.brandName || "YOUR PHOTOGRAPHY"}</p>
              {form.show.biography && form.biography && <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-[#666]">{form.biography}</p>}
              <div className="mt-4 grid justify-center gap-1 text-[10px] text-[#555]">
                {form.show.website && form.website && <span>{form.website}</span>}
                {form.show.email && form.email && <span>{form.email}</span>}
                {form.show.phone && form.phone && <span>{form.phone}</span>}
                {form.show.address && form.address && <span>{form.address}</span>}
              </div>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index}>
                  <div className="aspect-[1.45] bg-[#d8d8d8]" />
                  <div className="mx-auto mt-3 h-1 w-16 bg-[#d8d8d8]" />
                  <div className="mx-auto mt-2 h-1 w-10 bg-[#e5e5e5]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function homepageUrl(origin: string, slug: string) {
  const configuredRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  const rootDomain = configuredRoot?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!rootDomain) return `${origin}/home/${slug}`;
  const protocol = configuredRoot?.startsWith("http://") || origin.startsWith("http://") ? "http" : "https";
  return `${protocol}://${slug}.${rootDomain}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-12"><p className="mb-4 text-sm font-bold">{title}</p><div className="grid gap-4">{children}</div></section>;
}

function SocialIcon({ network }: { network: "instagram" | "facebook" | "youtube" | "linkedin" }) {
  const labels = { instagram: "IG", facebook: "f", youtube: "▶", linkedin: "in" };
  const colors = { instagram: "bg-[#E4405F]", facebook: "bg-[#1877F2]", youtube: "bg-[#FF0000]", linkedin: "bg-[#0A66C2]" };
  return <span aria-hidden="true" className={`inline-flex size-5 items-center justify-center rounded-[4px] text-[9px] font-black normal-case tracking-[-0.03em] text-white ${colors[network]}`}>{labels[network]}</span>;
}

function HelpText({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-[#667085]">{children}</p>;
}

function Field({ label, value, onChange, placeholder, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; icon?: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#667085]">{icon}{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-12 border border-[#E8E5E1] bg-white px-4 text-sm outline-none focus:border-[#6F57D9]" />
    </label>
  );
}

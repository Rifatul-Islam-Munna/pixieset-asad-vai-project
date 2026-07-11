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
  RefreshCw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  type HomepageRecord,
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

const emptyForm: Omit<HomepageRecord, "_id" | "userId" | "slug" | "publicPath" | "hasPassword"> = {
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
};

export function HomepageSettingsPanel() {
  const { query, update } = useHomepageSettings();
  const record = query.data?.data;
  const [form, setForm] = useState(emptyForm);
  const [password, setPassword] = useState("");
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!record) return;
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
    });
  }, [record]);

  const publicUrl = useMemo(
    () => {
      if (!record?.slug) return "Generating your unique URL...";
      const configuredRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
      const rootDomain = configuredRoot?.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!rootDomain) return `${origin}/home/${record.slug}`;
      const protocol = configuredRoot?.startsWith("http://") || origin.startsWith("http://") ? "http" : "https";
      return `${protocol}://${record.slug}.${rootDomain}`;
    },
    [origin, record?.slug],
  );

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

  const toggleVisibility = (key: keyof HomepageVisibility) => {
    setForm((current) => ({
      ...current,
      show: { ...current.show, [key]: !current.show[key] },
    }));
  };

  if (query.isLoading) {
    return <div className="flex min-h-[520px] items-center justify-center"><Loader2 className="size-7 animate-spin text-[#18b89f]" /></div>;
  }

  if (query.isError) {
    return <div className="border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load homepage settings.</div>;
  }

  return (
    <div className="min-h-full bg-white pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold md:text-[28px]">Homepage</h1>
          <p className="mt-2 text-sm text-[#667085]">Your public portfolio page shows only collections marked as Published.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={!record?.slug}
            onClick={() => record?.slug && window.open(publicUrl, "_blank", "noopener,noreferrer")}
            className="inline-flex h-11 items-center gap-2 border px-5 text-sm font-bold disabled:opacity-50"
          >
            <ExternalLink className="size-4" />View Site
          </button>
          <button
            type="button"
            disabled={update.isPending}
            onClick={save}
            className="inline-flex h-11 items-center gap-2 bg-[#18b89f] px-6 text-sm font-bold text-white disabled:opacity-60"
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
              <span className="relative h-6 w-11 rounded-full bg-[#d8d8d8] transition peer-checked:bg-[#18b89f] after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
              <span className="text-sm font-medium">{form.enabled ? "On" : "Off"}</span>
            </label>
            <HelpText>Your homepage is public when switched on. Draft collections never appear here.</HelpText>
          </Section>

          <Section title="Homepage URL">
            <div className="flex min-h-14 items-center justify-between gap-3 bg-[#f6f6f6] px-5 py-3">
              <span className="min-w-0 truncate text-sm font-medium">{publicUrl}</span>
              <button type="button" onClick={copyUrl} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[#00a997]">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}
              </button>
            </div>
          </Section>

          <Section title="Homepage Password">
            <div className="flex min-h-14 items-center gap-3 border px-4">
              <input
                type="text"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setPasswordDirty(true); }}
                placeholder={record?.hasPassword && !passwordDirty ? "Password is set" : "Add a password"}
                className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button type="button" onClick={generatePassword} className="inline-flex items-center gap-2 text-sm font-bold text-[#00a997]"><RefreshCw className="size-4" />Generate</button>
              {record?.hasPassword && (
                <button type="button" onClick={() => { setPassword(""); setPasswordDirty(true); }} className="text-xs font-bold text-red-600">Remove</button>
              )}
            </div>
            <HelpText>Leave unchanged to keep the current password. Remove clears homepage protection.</HelpText>
          </Section>

          <Section title="Homepage Identity">
            <Field label="Studio / Brand Name" value={form.brandName} onChange={(brandName) => setForm((current) => ({ ...current, brandName }))} />
            <Field label="Logo Image URL" value={form.logoUrl} onChange={(logoUrl) => setForm((current) => ({ ...current, logoUrl }))} placeholder="https://..." />
          </Section>

          <Section title="Biography">
            <div className="border bg-white">
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
              <Field icon={<SocialBadge>IG</SocialBadge>} label="Instagram" value={form.socialLinks.instagram || ""} onChange={(instagram) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, instagram } }))} />
              <Field icon={<SocialBadge>FB</SocialBadge>} label="Facebook" value={form.socialLinks.facebook || ""} onChange={(facebook) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, facebook } }))} />
              <Field icon={<SocialBadge>YT</SocialBadge>} label="YouTube" value={form.socialLinks.youtube || ""} onChange={(youtube) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, youtube } }))} />
              <Field icon={<SocialBadge>IN</SocialBadge>} label="LinkedIn" value={form.socialLinks.linkedin || ""} onChange={(linkedin) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, linkedin } }))} />
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
                  <input type="checkbox" checked={form.show[key]} onChange={() => toggleVisibility(key)} className="size-4 accent-[#18b89f]" />
                  {label}
                </label>
              ))}
            </div>
            <HelpText>Blank information is automatically hidden even when selected.</HelpText>
          </Section>

          <Section title="Collection Sort Order">
            <select
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value as typeof current.sortOrder }))}
              className="h-14 w-full border bg-white px-5 text-sm font-bold outline-none"
            >
              <option value="newest">Date created: New to Old</option>
              <option value="oldest">Date created: Old to New</option>
              <option value="name">Collection name: A to Z</option>
            </select>
          </Section>
        </div>

        <div className="sticky top-8 hidden min-h-[610px] items-center justify-center bg-[#f5f5f5] p-10 xl:flex">
          <div className="w-full max-w-[520px] bg-white px-8 py-10 shadow-[0_28px_70px_rgba(0,0,0,0.12)]">
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

function SocialBadge({ children }: { children: ReactNode }) {
  return <span className="text-[9px] font-black tracking-wide">{children}</span>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-12"><p className="mb-4 text-sm font-bold">{title}</p><div className="grid gap-4">{children}</div></section>;
}

function HelpText({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-[#667085]">{children}</p>;
}

function Field({ label, value, onChange, placeholder, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; icon?: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#667085]">{icon}{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-12 border bg-white px-4 text-sm outline-none focus:border-[#18b89f]" />
    </label>
  );
}

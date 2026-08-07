"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronRight, HardDrive, Images, Info, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { createAdminPlan, updateAdminPlan, type AdminPlan } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PlanEditorForm = {
  name: string;
  storageGb: string;
  galleryLimit: string;
  monthlyEmails: string;
  videoMinutes: string;
  videoQuality: "hd" | "4k";
  priceMonthly: string;
  yearlyEnabled: boolean;
  priceYearly: string;
  features: Record<string, boolean>;
  recommended: boolean;
  active: boolean;
};

const featureGroups = [
  {
    title: "Gallery & delivery",
    description: "Core gallery features your customer can use.",
    features: [
      ["aiFaceSearch", "AI Face Search", "Allows visitors to upload a face/photo and find matching photos. Backend face-search access is checked by the plan."],
      ["downloads", "Downloads", "Allows photo and gallery downloads. When disabled, backend sanitizes download settings and the dashboard controls are locked."],
      ["mobileGallery", "Mobile Gallery", "Allows creation and management of installable mobile gallery apps. Backend blocks creation when disabled."],
      ["beautifulGalleries", "Beautiful Galleries", "Unlocks the premium gallery design controls such as layouts, covers, advanced design and custom covers."],
      ["passwordProtection", "Password Protection", "Allows protected gallery/homepage access and related password/PIN controls. Backend blocks protected settings when unavailable."],
    ],
  },
  {
    title: "Store, search & insights",
    description: "Commerce and higher-tier functionality.",
    features: [
      ["store", "Basic Store", "Allows a gallery store to be enabled and used for selling. Backend disables store settings when this is off."],
      ["multipleGalleryStores", "Multiple Gallery Stores", "Allows Store to be active on more than one gallery. Without it, backend permits only one active gallery store."],
      ["advancedFaceSearch", "Advanced Face Search", "Unlocks the detected-person face browser and selecting an indexed face/person. Backend protects the advanced face endpoints."],
      ["basicAnalytics", "Basic Gallery & Sales Analytics", "Unlocks the dashboard analytics for revenue, orders, views, conversion, gallery activity and sales. Backend protects the overview endpoint."],
      ["advancedBranding", "Advanced Branding", "Unlocks the existing Settings → Branding page: brand text, accent color, brand logo and brand image. Backend blocks branding saves when disabled."],
    ],
  },
  {
    title: "Support & extra controls",
    description: "Service entitlements and lower-level plan controls.",
    features: [
      ["pinSet", "PIN Set", "Allows the existing download PIN control. Password Protection also enables this internally."],
      ["downloadLimit", "Download Limit", "Allows download restriction/limit controls. Downloads also enables this internally for compatible plans."],
      ["marketingEmails", "Marketing Email", "Allows the existing marketing-email capability. Monthly email quantity is controlled separately by Emails / month."],
      ["vipSupport", "VIP Support", "Unlocks the private real-time Support page and live chat with admin. User messages are rate-limited and chat history expires automatically."],
    ],
  },
] as const;

function makeInitial(plan?: AdminPlan | null): PlanEditorForm {
  return {
    name: plan?.name ?? "",
    storageGb: String(plan?.storageGb ?? ""),
    galleryLimit: String(plan?.galleryLimit ?? ""),
    monthlyEmails: String(plan?.monthlyEmails ?? ""),
    videoMinutes: String(plan?.videoMinutes ?? ""),
    videoQuality: plan?.videoQuality === "4k" ? "4k" : "hd",
    priceMonthly: String(plan?.priceMonthly ?? ""),
    yearlyEnabled: Boolean(plan?.yearlyEnabled),
    priceYearly: String(plan?.priceYearly ?? ""),
    features: plan?.features ?? {},
    recommended: Boolean(plan?.recommended),
    active: plan?.active ?? true,
  };
}

export function AdminPlanEditor({ plan }: { plan?: AdminPlan | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<PlanEditorForm>(() => makeInitial(plan));
  const selectedCount = useMemo(() => Object.values(form.features).filter(Boolean).length, [form.features]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      storageGb: Number(form.storageGb || 0),
      galleryLimit: Number(form.galleryLimit || 0),
      monthlyEmails: Number(form.monthlyEmails || 0),
      videoMinutes: Number(form.videoMinutes || 0),
      videoQuality: form.videoQuality,
      priceMonthly: Number(form.priceMonthly || 0),
      yearlyEnabled: form.yearlyEnabled,
      priceYearly: form.yearlyEnabled ? Number(form.priceYearly || 0) : 0,
      features: form.features,
      recommended: form.recommended,
      active: form.active,
    };
    startTransition(async () => {
      try {
        if (plan?._id) await updateAdminPlan(plan._id, payload);
        else await createAdminPlan(payload);
        toast.success(plan?._id ? "Plan updated" : "Plan created");
        router.push("/admin?tab=plans");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save plan");
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#f6f6f3] text-[#151515]">
      <header className="sticky top-0 z-30 border-b border-[#e3e3df] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/admin?tab=plans" className="grid size-10 shrink-0 place-items-center border border-[#ddd] bg-white hover:bg-[#f7f7f5]" aria-label="Back to plans">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">Billing Plan</p>
              <h1 className="truncate text-xl font-semibold sm:text-2xl">{plan ? `Edit ${plan.name}` : "Create Plan"}</h1>
            </div>
          </div>
          <Button form="admin-plan-form" disabled={pending} className="h-11 rounded-none bg-[#111] px-5 text-white">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {plan ? "Save changes" : "Create plan"}
          </Button>
        </div>
      </header>

      <form id="admin-plan-form" onSubmit={submit} className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10 lg:py-8">
        <div className="min-w-0 space-y-6">
          <section className="border border-[#e3e3df] bg-white p-5 sm:p-7">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Plan details</h2>
              <p className="mt-1 text-sm text-[#6d6d68]">Pricing and hard limits are enforced separately from feature checkboxes.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <PlanField label="Plan name" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
              <PlanField label="Monthly price EUR" value={form.priceMonthly} onChange={(priceMonthly) => setForm({ ...form, priceMonthly })} type="number" required />
              <PlanField label="Storage limit GB" value={form.storageGb} onChange={(storageGb) => setForm({ ...form, storageGb })} type="number" required help="Backend upload quota." />
              <PlanField label="Gallery limit" value={form.galleryLimit} onChange={(galleryLimit) => setForm({ ...form, galleryLimit })} type="number" required help="Use 0 for unlimited galleries." />
              <PlanField label="Emails / month" value={form.monthlyEmails} onChange={(monthlyEmails) => setForm({ ...form, monthlyEmails })} type="number" required help="Monthly email usage allowance." />
              <PlanField label="Total video minutes" value={form.videoMinutes} onChange={(videoMinutes) => setForm({ ...form, videoMinutes })} type="number" required />
              <label className="grid gap-2 text-sm font-semibold">
                Video quality
                <select value={form.videoQuality} onChange={(event) => setForm({ ...form, videoQuality: event.target.value as "hd" | "4k" })} className="h-12 border border-[#dcdcd7] bg-white px-3 text-sm font-normal outline-none focus:border-[#111]">
                  <option value="hd">HD only</option>
                  <option value="4k">HD + 4K</option>
                </select>
              </label>
              <label className="flex min-h-12 items-center justify-between gap-4 border border-[#dcdcd7] px-4 text-sm">
                <span><b>Yearly billing</b><small className="mt-0.5 block text-[#777]">Offer a yearly price.</small></span>
                <input type="checkbox" checked={form.yearlyEnabled} onChange={(event) => setForm({ ...form, yearlyEnabled: event.target.checked })} className="size-5 accent-[#111]" />
              </label>
              {form.yearlyEnabled && <PlanField label="Yearly price EUR" value={form.priceYearly} onChange={(priceYearly) => setForm({ ...form, priceYearly })} type="number" required />}
            </div>
          </section>

          {featureGroups.map((group) => (
            <section key={group.title} className="border border-[#e3e3df] bg-white p-5 sm:p-7">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">{group.title}</h2>
                <p className="mt-1 text-sm text-[#6d6d68]">{group.description}</p>
              </div>
              <div className="grid gap-3">
                {group.features.map(([key, label, description]) => {
                  const checked = Boolean(form.features[key]);
                  return (
                    <label key={key} className={cn("group cursor-pointer border p-4 transition", checked ? "border-[#7d63df] bg-[#f8f6ff]" : "border-[#e4e4df] hover:border-[#bbb]")}>
                      <div className="flex items-start gap-4">
                        <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center border", checked ? "border-[#6337d8] bg-[#6337d8] text-white" : "border-[#bbb] bg-white")}>
                          {checked && <Check className="size-4" />}
                        </span>
                        <input type="checkbox" className="sr-only" checked={checked} onChange={(event) => setForm({ ...form, features: { ...form.features, [key]: event.target.checked } })} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 font-bold">{label}{checked && <span className="bg-[#e8e1ff] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#6337d8]">Enabled</span>}</span>
                          <span className="mt-1.5 block text-sm leading-6 text-[#666]">{description}</span>
                        </span>
                        <ChevronRight className={cn("mt-1 size-4 shrink-0 text-[#aaa] transition", checked && "text-[#6337d8]")} />
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-[92px] lg:self-start">
          <section className="border border-[#e3e3df] bg-white p-5">
            <h2 className="font-bold">Plan summary</h2>
            <div className="mt-5 grid gap-3 text-sm">
              <Summary icon={<HardDrive className="size-4" />} label="Storage" value={`${form.storageGb || 0} GB`} />
              <Summary icon={<Images className="size-4" />} label="Galleries" value={Number(form.galleryLimit || 0) === 0 ? "Unlimited" : form.galleryLimit || "0"} />
              <Summary icon={<Check className="size-4" />} label="Enabled capabilities" value={String(selectedCount)} />
            </div>
          </section>
          <section className="border border-[#d9cef8] bg-[#f8f6ff] p-5">
            <div className="flex gap-3"><Info className="mt-0.5 size-5 shrink-0 text-[#6337d8]" /><div><p className="font-bold">How checkboxes work</p><p className="mt-1 text-sm leading-6 text-[#665f78]">Checked capabilities are copied to the user when this plan is assigned or purchased. Features with backend enforcement cannot be bypassed by calling the API directly.</p></div></div>
          </section>
          <label className="flex items-center justify-between border border-[#d9cef8] bg-white p-4 text-sm"><span><b>Recommended</b><small className="block text-[#777]">Highlight this plan.</small></span><input type="checkbox" className="size-5 accent-[#6337d8]" checked={form.recommended} onChange={(event) => setForm({ ...form, recommended: event.target.checked })} /></label>
          <label className="flex items-center justify-between border border-[#e3e3df] bg-white p-4 text-sm"><span><b>Active</b><small className="block text-[#777]">Available for use/purchase.</small></span><input type="checkbox" className="size-5 accent-[#111]" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /></label>
          <Button disabled={pending} className="h-12 w-full rounded-none bg-[#111] text-white">{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{plan ? "Save changes" : "Create plan"}</Button>
        </aside>
      </form>
    </main>
  );
}

function PlanField({ label, value, onChange, type = "text", required, help }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; help?: string }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}<Input type={type} min={type === "number" ? 0 : undefined} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-none border-[#dcdcd7] bg-white shadow-none focus-visible:ring-0" />{help && <small className="font-normal leading-5 text-[#777]">{help}</small>}</label>;
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#eee] pb-3"><span className="flex items-center gap-2 text-[#666]">{icon}{label}</span><b>{value}</b></div>;
}

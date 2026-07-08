"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactSortable } from "react-sortablejs";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  ImagePlus,
  Link2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Share2,
  Smartphone,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  MobileGalleryApp,
  MobileGalleryImage,
  MobileGalleryProfile,
  uploadMobileGalleryAsset,
  useMobileGalleryApp,
  useMobileGalleryApps,
  useMobileGalleryProfile,
} from "@/api-hooks/use-mobile-gallery";
import { MobileGalleryPublic } from "./mobile-gallery-public";

type View = "apps" | "settings" | "editor" | "preview" | "share";
type EditorTab = "photos" | "design" | "app-settings";

export function MobileGalleryDashboard({ view, appId }: { view: View; appId?: string }) {
  if (view === "apps") return <AppsPage />;
  if (view === "settings") return <ProfileSettingsPage />;
  return <AppWorkspace view={view} appId={appId} />;
}

function TopBar({ active }: { active: "apps" | "settings" }) {
  return (
    <header className="border-t-[4px] border-[#252525] bg-white">
      <div className="border-b bg-[#f7f7f7] px-4 sm:px-8">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between">
          <div className="flex items-center gap-3 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-full bg-[#f5c421]"><Smartphone className="size-4" /></span>
            <span>Mobile Gallery App</span><ChevronDown className="size-4" />
          </div>
          <div className="flex items-center gap-3 text-[#777]"><Search className="size-5" /><Settings className="size-5" /></div>
        </div>
      </div>
      <nav className="border-b px-4 sm:px-8">
        <div className="mx-auto flex h-14 max-w-[1180px] items-end gap-8">
          <Link href="/dashboard/mobile-gallery" className={`flex h-full items-center border-b-2 text-sm ${active === "apps" ? "border-[#16bea6] font-semibold" : "border-transparent text-[#777]"}`}>Apps</Link>
          <Link href="/dashboard/mobile-gallery/settings" className={`flex h-full items-center border-b-2 text-sm ${active === "settings" ? "border-[#16bea6] font-semibold" : "border-transparent text-[#777]"}`}>Settings</Link>
        </div>
      </nav>
    </header>
  );
}

function AppsPage() {
  const router = useRouter();
  const { appsQuery, createApp, deleteApp } = useMobileGalleryApps();
  const apps = appsQuery.data?.data ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await createApp.mutateAsync({ name, eventDate });
      setCreateOpen(false);
      router.push(`/dashboard/mobile-gallery/apps/${result.data._id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create app");
    }
  };

  return (
    <main className="min-h-screen bg-white text-[#202020]">
      <TopBar active="apps" />
      <section className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <h1 className="text-3xl font-light">Mobile Gallery Apps</h1>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 bg-[#18bfa6] px-5 py-3 text-sm font-semibold text-white"><Plus className="size-4" /> Create New</button>
        </div>
        {appsQuery.isLoading ? <p className="py-12 text-sm text-[#777]">Loading apps…</p> : null}
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <article key={app._id} className="group">
              <button onClick={() => router.push(`/dashboard/mobile-gallery/apps/${app._id}`)} className="block w-full bg-[#f5f4f3] p-7 text-left">
                <div className="mx-auto size-28 overflow-hidden rounded-[28px] bg-white shadow-sm">
                  {app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Smartphone className="size-8 text-[#aaa]" /></div>}
                </div>
              </button>
              <div className="flex items-center justify-between pt-3">
                <button onClick={() => router.push(`/dashboard/mobile-gallery/apps/${app._id}`)} className="text-sm font-semibold uppercase">{app.name}</button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${app.name}?`)) return;
                    await deleteApp.mutateAsync(app._id).catch((error) => toast.error(error.message));
                  }}
                  className="rounded-full p-2 text-[#18bfa6] hover:bg-[#f4f4f4]"
                ><MoreHorizontal className="size-5" /></button>
              </div>
              <p className="mt-1 text-xs text-[#888]">{app.imageCount || 0} photos · {app.status === "draft" ? "Unpublished" : "Published"}</p>
            </article>
          ))}
        </div>
        {!appsQuery.isLoading && !apps.length && <div className="py-24 text-center text-[#777]">Create your first mobile gallery app.</div>}
      </section>
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={submit} className="w-full max-w-md bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Create Mobile Gallery App</h2><button type="button" onClick={() => setCreateOpen(false)}><X className="size-5" /></button></div>
            <label className="mt-6 block text-sm font-semibold">App Name<input value={name} onChange={(e) => setName(e.target.value)} required className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>
            <label className="mt-5 block text-sm font-semibold">Event Date<input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>
            <button disabled={createApp.isPending} className="mt-7 w-full bg-[#18bfa6] px-5 py-3 font-semibold text-white">{createApp.isPending ? "Creating…" : "Create App"}</button>
          </form>
        </div>
      )}
    </main>
  );
}

function ProfileSettingsPage() {
  const { profileQuery, updateProfile } = useMobileGalleryProfile();
  const [form, setForm] = useState<MobileGalleryProfile>({ socialLinks: {} });
  useEffect(() => { if (profileQuery.data?.data) setForm(profileQuery.data.data); }, [profileQuery.data]);
  const set = (key: keyof MobileGalleryProfile, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    await updateProfile.mutateAsync(form).then(() => toast.success("Settings saved")).catch((error) => toast.error(error.message));
  };
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    try { set("logoUrl", await uploadMobileGalleryAsset(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
  };
  return (
    <main className="min-h-screen bg-white text-[#202020]">
      <TopBar active="settings" />
      <form onSubmit={save} className="mx-auto max-w-[920px] px-4 py-10 sm:px-8">
        <div className="border-b pb-6"><h1 className="text-3xl font-light">Mobile Gallery Settings</h1><p className="mt-2 text-sm text-[#777]">This information appears in the Account tab of every mobile gallery app.</p></div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-semibold">Logo
            <div className="mt-2 flex items-center gap-5 border p-4">{form.logoUrl ? <img src={form.logoUrl} alt="" className="h-16 w-40 object-contain" /> : <div className="flex h-16 w-40 items-center justify-center bg-[#f5f5f5] text-xs text-[#888]">No logo</div>}<span className="relative cursor-pointer bg-[#f3f3f3] px-4 py-2 text-sm"><Upload className="mr-2 inline size-4" />Upload<input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => uploadLogo(e.target.files?.[0])} /></span></div>
          </label>
          <Field label="Contact Email" value={form.contactEmail || ""} onChange={(value) => set("contactEmail", value)} />
          <Field label="Phone Number" value={form.phoneNumber || ""} onChange={(value) => set("phoneNumber", value)} />
          <Field label="Website" value={form.website || ""} onChange={(value) => set("website", value)} />
          <Field label="Business Address" value={form.businessAddress || ""} onChange={(value) => set("businessAddress", value)} />
          <label className="sm:col-span-2 text-sm font-semibold">Biography<textarea value={form.biography || ""} onChange={(e) => set("biography", e.target.value)} rows={5} className="mt-2 w-full border p-4 font-normal outline-none focus:border-[#18bfa6]" /></label>
          {['facebook','instagram','youtube','linkedin'].map((network) => <Field key={network} label={`${network[0].toUpperCase()}${network.slice(1)} URL`} value={form.socialLinks?.[network] || ""} onChange={(value) => set("socialLinks", { ...(form.socialLinks || {}), [network]: value })} />)}
        </div>
        <button disabled={updateProfile.isPending} className="mt-8 bg-[#18bfa6] px-7 py-3 font-semibold text-white">{updateProfile.isPending ? "Saving…" : "Save Settings"}</button>
      </form>
    </main>
  );
}

function AppWorkspace({ view, appId }: { view: View; appId?: string }) {
  const { appQuery, updateApp, uploadImages, reorderImages, deleteImage } = useMobileGalleryApp(appId);
  const { profileQuery } = useMobileGalleryProfile();
  const app = appQuery.data?.data;
  const profile = profileQuery.data?.data || {};
  const [tab, setTab] = useState<EditorTab>("photos");
  const [images, setImages] = useState<MobileGalleryImage[]>([]);
  useEffect(() => setImages(app?.images || []), [app?.images]);
  if (appQuery.isLoading || !app) return <div className="flex min-h-screen items-center justify-center text-sm text-[#777]">Loading mobile gallery…</div>;
  if (view === "preview") return <PreviewScreen app={app} profile={profile} />;
  if (view === "share") return <ShareScreen app={app} />;

  return (
    <main className="min-h-screen bg-white text-[#202020]">
      <TopBar active="apps" />
      <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4"><Link href="/dashboard/mobile-gallery"><ArrowLeft className="size-5" /></Link>{app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="size-16 rounded-2xl object-cover" /> : <div className="flex size-16 items-center justify-center rounded-2xl bg-[#eee]"><Smartphone className="size-6" /></div>}<div><h1 className="text-2xl font-medium">{app.name}</h1><p className="mt-1 text-xs uppercase tracking-wider text-[#888]">{app.status}</p></div></div>
          <div className="flex gap-2"><Link href={`/dashboard/mobile-gallery/apps/${app._id}/preview`} className="border bg-[#f3f3f3] px-5 py-3 text-sm">Preview</Link><Link href={`/dashboard/mobile-gallery/apps/${app._id}/share`} className="flex items-center gap-2 bg-[#18bfa6] px-5 py-3 text-sm font-semibold text-white"><Share2 className="size-4" />Share</Link></div>
        </div>
        <div className="mt-8 flex gap-8 border-b">
          {([['photos','Photos'],['design','Design'],['app-settings','App Settings']] as const).map(([value,label]) => <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-1 pb-4 text-sm ${tab === value ? "border-[#18bfa6] font-semibold" : "border-transparent"}`}>{label}</button>)}
        </div>
        {tab === "photos" && <PhotosEditor app={app} images={images} setImages={setImages} uploadImages={uploadImages} reorderImages={reorderImages} deleteImage={deleteImage} updateApp={updateApp} />}
        {tab === "design" && <DesignEditor app={app} profile={profile} updateApp={updateApp} />}
        {tab === "app-settings" && <AppSettingsEditor app={app} updateApp={updateApp} />}
      </section>
    </main>
  );
}

function PhotosEditor({ app, images, setImages, uploadImages, reorderImages, deleteImage, updateApp }: any) {
  const upload = async (files?: FileList | null) => {
    if (!files?.length) return;
    await uploadImages.mutateAsync(files).then(() => toast.success("Photos uploaded")).catch((error: Error) => toast.error(error.message));
  };
  return (
    <section className="pt-6">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold">{images.length} photos</p><label className="relative flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#18bfa6]"><ImagePlus className="size-4" /> Add Photos<input type="file" accept="image/*" multiple className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => upload(e.target.files)} /></label></div>
      <ReactSortable
        list={images.map((image: MobileGalleryImage) => ({ ...image, id: image._id }))}
        setList={(next: any[]) => setImages(next)}
        animation={180}
        onEnd={() => reorderImages.mutate(images.map((image: MobileGalleryImage) => image._id))}
        className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5"
      >
        {images.map((image: MobileGalleryImage) => (
          <article key={image._id} className="group relative border bg-white p-1 shadow-sm">
            <img src={image.thumbnailUrl || image.url} alt="" className="aspect-square w-full object-cover" />
            <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-0 transition group-hover:opacity-100">
              <button onClick={() => updateApp.mutate({ coverImage: image.url })} className="bg-white/95 px-2 py-1 text-[10px] font-semibold">Set Cover</button>
              <button onClick={() => deleteImage.mutate(image._id)} className="bg-white/95 p-1 text-red-500"><Trash2 className="size-4" /></button>
            </div>
            {app.coverImage === image.url && <span className="absolute left-2 top-2 bg-[#18bfa6] px-2 py-1 text-[9px] font-semibold uppercase text-white">Cover</span>}
          </article>
        ))}
      </ReactSortable>
      {!images.length && <label className="mt-8 flex min-h-72 cursor-pointer flex-col items-center justify-center border border-dashed text-[#888]"><Upload className="size-8" /><span className="mt-3 text-sm">Upload photos to your mobile gallery</span><input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} /></label>}
    </section>
  );
}

function DesignEditor({ app, profile, updateApp }: { app: MobileGalleryApp; profile: MobileGalleryProfile; updateApp: any }) {
  const [draft, setDraft] = useState<MobileGalleryApp>(app);
  useEffect(() => setDraft(app), [app]);
  const design = draft.design || {};
  const patchDesign = (patch: Record<string, any>) => setDraft((current) => ({ ...current, design: { ...(current.design || {}), ...patch } }));
  const uploadIcon = async (file?: File) => {
    if (!file) return;
    try { setDraft((current) => ({ ...current, iconUrl: await uploadMobileGalleryAsset(file) })); } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
  };
  const save = () => updateApp.mutateAsync({ iconUrl: draft.iconUrl, design: draft.design }).then(() => toast.success("Design saved")).catch((error: Error) => toast.error(error.message));
  return (
    <section className="grid gap-8 pt-7 lg:grid-cols-[1fr_430px]">
      <div>
        <Panel title="Cover Style">
          <div className="grid grid-cols-3 gap-3">{(['full','third','none'] as const).map((style) => <button key={style} onClick={() => patchDesign({ coverStyle: style })} className={`border p-4 text-center ${design.coverStyle === style ? "border-[#18bfa6]" : ""}`}><div className={`mx-auto h-28 w-16 rounded-xl bg-[#ddd] ${style === "third" ? "border-t-[38px] border-white" : style === "none" ? "border-t-[75px] border-white" : ""}`} /><p className="mt-3 text-sm capitalize">{style}</p></button>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-4"><label className="text-xs font-semibold">Focal X<input type="range" min="0" max="100" value={design.focal?.x ?? 50} onChange={(e) => patchDesign({ focal: { x: Number(e.target.value), y: design.focal?.y ?? 50 } })} className="mt-2 w-full" /></label><label className="text-xs font-semibold">Focal Y<input type="range" min="0" max="100" value={design.focal?.y ?? 50} onChange={(e) => patchDesign({ focal: { x: design.focal?.x ?? 50, y: Number(e.target.value) } })} className="mt-2 w-full" /></label></div>
        </Panel>
        <Panel title="Theme"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(['echo','spring','lark','sage'] as const).map((theme) => <button key={theme} onClick={() => patchDesign({ theme })} className={`border px-3 py-5 capitalize ${design.theme === theme ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}>{theme}{design.theme === theme && <Check className="mx-auto mt-2 size-4 text-[#18bfa6]" />}</button>)}</div><p className="mt-4 text-xs leading-5 text-[#777]">Each cover theme offers a unique font and layout, giving your cover photo an amazing first impression.</p></Panel>
        <Panel title="Photos Layout & Color">
          <div className="grid grid-cols-2 gap-3">{(['vertical','horizontal'] as const).map((layout) => <button key={layout} onClick={() => patchDesign({ layout })} className={`border p-4 capitalize ${design.layout === layout ? "border-[#18bfa6]" : ""}`}>{layout}</button>)}</div>
          <p className="mt-3 text-xs text-[#777]">Vertical emphasizes portrait photos, and Horizontal emphasizes landscape photos.</p>
          <div className="mt-5 grid grid-cols-2 gap-4"><label className="text-xs font-semibold">Background Color<input type="color" value={design.backgroundColor || "#ffffff"} onChange={(e) => patchDesign({ backgroundColor: e.target.value })} className="mt-2 h-10 w-full" /></label><label className="text-xs font-semibold">Text Color<input type="color" value={design.textColor || "#222222"} onChange={(e) => patchDesign({ textColor: e.target.value })} className="mt-2 h-10 w-full" /></label></div>
        </Panel>
        <Panel title="App Icon"><div className="flex items-center gap-4">{draft.iconUrl ? <img src={draft.iconUrl} alt="" className="size-20 rounded-2xl object-cover" /> : <div className="flex size-20 items-center justify-center rounded-2xl bg-[#eee]"><Smartphone className="size-6" /></div>}<label className="relative cursor-pointer border px-4 py-2 text-sm">Upload Icon<input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => uploadIcon(e.target.files?.[0])} /></label></div></Panel>
        <button onClick={save} disabled={updateApp.isPending} className="mt-6 bg-[#18bfa6] px-7 py-3 font-semibold text-white">{updateApp.isPending ? "Saving…" : "Save Design"}</button>
      </div>
      <div className="lg:sticky lg:top-6 lg:h-fit"><PhonePreview><MobileGalleryPublic app={draft} profile={profile} embedded /></PhonePreview></div>
    </section>
  );
}

function AppSettingsEditor({ app, updateApp }: { app: MobileGalleryApp; updateApp: any }) {
  const [form, setForm] = useState(app);
  useEffect(() => setForm(app), [app]);
  const cta = form.settings?.callToAction || {};
  const save = (event: FormEvent) => { event.preventDefault(); updateApp.mutateAsync({ name: form.name, eventDate: form.eventDate, status: form.status, settings: form.settings }).then(() => toast.success("App settings saved")).catch((error: Error) => toast.error(error.message)); };
  return (
    <form onSubmit={save} className="max-w-[760px] space-y-7 pt-7">
      <Field label="App Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
      <label className="block text-sm font-semibold">Event Date<input type="date" value={form.eventDate ? new Date(form.eventDate).toISOString().slice(0,10) : ""} onChange={(e) => setForm((current) => ({ ...current, eventDate: e.target.value }))} className="mt-2 h-12 w-full border px-4 font-normal outline-none" /></label>
      <Toggle label="Status" description="Unpublished gallery apps can only be seen by you." enabled={form.status !== "draft"} onChange={(enabled) => setForm((current) => ({ ...current, status: enabled ? "published" : "draft" }))} />
      <Toggle label="Call to Action Button" description="Add a button to the end of the photo section." enabled={cta.enabled !== false} onChange={(enabled) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, enabled } } }))} />
      {cta.enabled !== false && <div className="ml-6 grid gap-5 border-l-2 border-dotted pl-6"><Field label="Button Label" value={cta.label || "Visit Website"} onChange={(label) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, label } } }))} /><Field label="Link URL" value={cta.url || ""} onChange={(url) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, url } } }))} /></div>}
      <button disabled={updateApp.isPending} className="bg-[#18bfa6] px-7 py-3 font-semibold text-white">Save Settings</button>
    </form>
  );
}

function PreviewScreen({ app, profile }: { app: MobileGalleryApp; profile: MobileGalleryProfile }) {
  return <main className="min-h-screen bg-[#f8f4f1] p-4"><Link href={`/dashboard/mobile-gallery/apps/${app._id}`} className="fixed left-5 top-5 z-40 flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> Back</Link><div className="mx-auto flex min-h-screen max-w-[430px] items-center py-16"><PhonePreview><MobileGalleryPublic app={app} profile={profile} embedded /></PhonePreview></div></main>;
}

function ShareScreen({ app }: { app: MobileGalleryApp }) {
  const [email, setEmail] = useState("");
  const [template, setTemplate] = useState("Your Mobile Gallery App is Ready");
  const [subject, setSubject] = useState(`Your ${app.name} mobile app is ready!`);
  const link = typeof window === "undefined" ? `/mobile-gallery/${app.slug}` : `${window.location.origin}/mobile-gallery/${app.slug}`;
  const body = `Hi,\n\nTo install your ${app.name} mobile gallery app, open this email on your mobile phone and click the Install App button.\n\n${link}`;
  const send = (event: FormEvent) => { event.preventDefault(); window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
  return (
    <main className="min-h-screen bg-[#f5f5f4] text-[#202020]"><div className="border-b bg-white px-5 py-4"><Link href={`/dashboard/mobile-gallery/apps/${app._id}`} className="flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> Back to {app.name}</Link></div><div className="grid min-h-[calc(100vh-58px)] lg:grid-cols-2"><form onSubmit={send} className="bg-white p-6 sm:p-12"><h1 className="text-2xl font-light">Share by Email</h1><label className="mt-8 block text-sm font-semibold">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-12 w-full border px-4 font-normal" placeholder="e.g. johnsmith@email.com" /></label><label className="mt-5 block text-sm font-semibold">Template<select value={template} onChange={(e) => setTemplate(e.target.value)} className="mt-2 h-12 w-full border px-4 font-normal"><option>Your Mobile Gallery App is Ready</option><option>Wedding Gallery Delivery</option><option>Event Photos Are Ready</option></select></label><label className="mt-5 block text-sm font-semibold">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 h-12 w-full border px-4 font-normal" /></label><textarea readOnly value={body} rows={8} className="mt-5 w-full border p-4 text-sm leading-6 text-[#555]" /><div className="mt-5 flex flex-wrap gap-3"><button className="flex items-center gap-2 bg-[#18bfa6] px-6 py-3 font-semibold text-white"><Mail className="size-4" /> Send Invite</button><button type="button" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied"))} className="flex items-center gap-2 border px-5 py-3"><Copy className="size-4" /> Copy Link</button><a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 border px-5 py-3"><ExternalLink className="size-4" /> Open Link</a></div></form><div className="flex items-center justify-center p-8"><div className="w-full max-w-xl bg-white shadow"><div className="border-b p-10 text-center"><p className="text-xs uppercase tracking-widest text-[#777]">{template}</p><h2 className="mt-6 text-3xl">Your Mobile Gallery App is Ready</h2></div><div className="p-10 text-center">{app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="mx-auto size-36 rounded-[30px] object-cover" /> : null}<h3 className="mt-4 uppercase tracking-widest">{app.name}</h3><a href={link} className="mt-8 inline-block bg-[#18bfa6] px-7 py-3 font-semibold text-white">Install App</a></div></div></div></div></main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b py-7"><h2 className="mb-5 text-lg font-medium">{title}</h2>{children}</section>; }
function PhonePreview({ children }: { children: React.ReactNode }) { return <div className="mx-auto w-full max-w-[390px] rounded-[42px] bg-white p-3 shadow-[0_22px_60px_rgba(0,0,0,0.16)]"><div className="h-[720px] overflow-hidden rounded-[32px] border bg-white">{children}</div></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>; }
function Toggle({ label, description, enabled, onChange }: { label: string; description: string; enabled: boolean; onChange: (enabled: boolean) => void }) { return <div><p className="text-sm font-semibold">{label}</p><button type="button" onClick={() => onChange(!enabled)} className={`mt-2 h-8 w-16 rounded-full p-1 transition ${enabled ? "bg-[#18bfa6]" : "bg-[#ccc]"}`}><span className={`block size-6 rounded-full bg-white transition ${enabled ? "translate-x-8" : ""}`} /></button><span className="ml-3 text-sm text-[#888]">{enabled ? "Enabled" : "Disabled"}</span><p className="mt-2 text-xs text-[#888]">{description}</p></div>; }

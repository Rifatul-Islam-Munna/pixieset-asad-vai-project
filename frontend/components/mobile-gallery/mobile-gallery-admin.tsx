"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactSortable } from "react-sortablejs";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  GripVertical,
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
  type MobileGalleryApp,
  type MobileGalleryImage,
  type MobileGalleryProfile,
  uploadMobileGalleryAsset,
  useMobileGalleryApp,
  useMobileGalleryApps,
  useMobileGalleryProfile,
} from "@/api-hooks/use-mobile-gallery";
import { MobileGalleryPublic } from "./mobile-gallery-public";
import { MobileGalleryDesignEditor } from "./mobile-gallery-design-editor";
import { MobileGalleryShareScreen } from "./mobile-gallery-share-screen";
import { MobileGalleryPreviewScreen } from "./mobile-gallery-preview-screen";

type View = "apps" | "settings" | "editor" | "preview" | "share";
type EditorTab = "photos" | "design" | "app-settings";
type ShareStep = "method" | "templates" | "compose" | "link";

const shareTemplates = [
  {
    id: "ready",
    label: "Mobile App Ready",
    title: "Your Mobile Gallery App is Ready",
    subject: (name: string) => `Your ${name} mobile app is ready!`,
    intro: (name: string) => `To install your ${name} mobile gallery app, open this email on your mobile phone and click the Install App button.`,
  },
  {
    id: "wedding",
    label: "Wedding Delivery",
    title: "Your Wedding Gallery is Ready",
    subject: (name: string) => `${name} wedding gallery is ready`,
    intro: (name: string) => `Your ${name} wedding gallery is ready to view, favorite, download and install on your phone.`,
  },
  {
    id: "event",
    label: "Event Photos",
    title: "Your Event Photos are Ready",
    subject: (name: string) => `${name} event photos are ready`,
    intro: (name: string) => `The photos from ${name} are ready. Open the link below on your phone to view or install the gallery app.`,
  },
] as const;

export function MobileGalleryDashboard({ view, appId }: { view: View; appId?: string }) {
  if (view === "apps") return <AppsPage />;
  if (view === "settings") return <ProfileSettingsPage />;
  return <AppWorkspace view={view} appId={appId} />;
}

function TopBar({ active }: { active: "apps" | "settings" }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  return (
    <header className="border-t-[4px] border-[#252525] bg-white">
      <div className="border-b bg-[#f7f7f7] px-4 sm:px-8">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-3">
          <div className="relative min-w-0">
            <button onClick={() => setSwitcherOpen((value) => !value)} className="flex min-w-0 items-center gap-3 font-semibold">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#f5c421]"><Smartphone className="size-4" /></span>
              <span className="truncate">Mobile Gallery App</span><ChevronDown className="size-4 shrink-0" />
            </button>
            {switcherOpen && (
              <div className="absolute left-0 top-11 z-50 w-[calc(100vw-2rem)] max-w-[340px] border bg-white p-3 shadow-xl">
                <Link href="/dashboard/client-gallery" className="block px-4 py-3 hover:bg-[#f5f5f5]"><b>Client Gallery</b><span className="mt-1 block text-xs text-[#777]">Share and deliver client collections</span></Link>
                <Link href="/dashboard/store-gallery" className="block px-4 py-3 hover:bg-[#f5f5f5]"><b>Store Gallery</b><span className="mt-1 block text-xs text-[#777]">Sell prints and downloads</span></Link>
                <Link href="/dashboard/mobile-gallery" className="block bg-[#f4fffc] px-4 py-3"><b>Mobile Gallery App</b><span className="mt-1 block text-xs text-[#777]">Installable event photo apps</span></Link>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[#777]"><Link href="/dashboard/mobile-gallery#search-apps" aria-label="Search mobile gallery apps" className="rounded p-1.5 hover:bg-white hover:text-[#18bfa6]"><Search className="size-5" /></Link><Link href="/dashboard/mobile-gallery/settings" aria-label="Mobile gallery settings" className="rounded p-1.5 hover:bg-white hover:text-[#18bfa6]"><Settings className="size-5" /></Link></div>
        </div>
      </div>
      <nav className="overflow-x-auto border-b px-4 sm:px-8">
        <div className="mx-auto flex h-14 max-w-[1180px] min-w-max items-end gap-8">
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
  const [query, setQuery] = useState("");
  const visibleApps = useMemo(
    () => apps.filter((app) => app.name.toLowerCase().includes(query.trim().toLowerCase())),
    [apps, query],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await createApp.mutateAsync({ name, eventDate });
      setCreateOpen(false);
      setName("");
      router.push(`/dashboard/mobile-gallery/apps/${result.data._id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create app");
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#202020]">
      <TopBar active="apps" />
      <section className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <h1 className="text-2xl font-light sm:text-3xl">Mobile Gallery Apps</h1>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 bg-[#18bfa6] px-5 py-3 text-sm font-semibold text-white"><Plus className="size-4" /> Create New</button>
        </div>
        <div id="search-apps" className="mt-5 flex scroll-mt-24 justify-end">
          <label className="relative block w-full max-w-[320px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#888]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" className="h-11 w-full border px-10 text-sm outline-none focus:border-[#18bfa6]" />
          </label>
        </div>
        {appsQuery.isLoading && <p className="py-12 text-sm text-[#777]">Loading apps…</p>}
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {visibleApps.map((app) => (
            <article key={app._id}>
              <button onClick={() => router.push(`/dashboard/mobile-gallery/apps/${app._id}`)} className="block w-full bg-[#f5f4f3] p-7">
                <div className="mx-auto size-28 overflow-hidden rounded-[28px] bg-white shadow-sm">
                  {app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Smartphone className="size-8 text-[#aaa]" /></div>}
                </div>
              </button>
              <div className="flex items-center justify-between pt-3">
                <button onClick={() => router.push(`/dashboard/mobile-gallery/apps/${app._id}`)} className="truncate pr-3 text-left text-sm font-semibold uppercase">{app.name}</button>
                <button onClick={async () => { if (confirm(`Delete ${app.name}?`)) await deleteApp.mutateAsync(app._id).catch((error) => toast.error(error.message)); }} className="rounded-full p-2 text-[#18bfa6] hover:bg-[#f4f4f4]"><MoreHorizontal className="size-5" /></button>
              </div>
              <p className="mt-1 text-xs text-[#888]">{app.imageCount || 0} photos · {app.status === "draft" ? "Unpublished" : "Published"}</p>
            </article>
          ))}
        </div>
        {!appsQuery.isLoading && !visibleApps.length && <div className="py-24 text-center text-[#777]">{query ? "No matching mobile gallery apps." : "Create your first mobile gallery app."}</div>}
      </section>
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <form onSubmit={submit} className="w-full max-w-md bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Create Mobile Gallery App</h2><button type="button" onClick={() => setCreateOpen(false)}><X className="size-5" /></button></div>
            <Field label="App Name" value={name} onChange={setName} required />
            <label className="mt-5 block text-sm font-semibold">Event Date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>
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
  const set = (key: keyof MobileGalleryProfile, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  async function uploadLogo(file?: File) {
    if (!file) return;
    try { set("logoUrl", await uploadMobileGalleryAsset(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    await updateProfile.mutateAsync(form).then(() => toast.success("Settings saved")).catch((error) => toast.error(error.message));
  }

  return (
    <main className="min-h-screen bg-white text-[#202020]">
      <TopBar active="settings" />
      <form onSubmit={save} className="mx-auto max-w-[920px] px-4 py-10 sm:px-8">
        <div className="border-b pb-6"><h1 className="text-2xl font-light sm:text-3xl">Mobile Gallery Settings</h1><p className="mt-2 text-sm text-[#777]">This information appears in the Account tab of every mobile gallery app.</p></div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-semibold">Logo
            <div className="mt-2 flex flex-wrap items-center gap-5 border p-4">
              {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-16 w-40 object-contain" /> : <div className="flex h-16 w-40 items-center justify-center bg-[#f5f5f5] text-xs text-[#888]">No logo</div>}
              <span className="relative cursor-pointer bg-[#f3f3f3] px-4 py-2 text-sm"><Upload className="mr-2 inline size-4" />Upload<input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => uploadLogo(event.target.files?.[0])} /></span>
            </div>
          </label>
          <Field label="Contact Email" value={form.contactEmail || ""} onChange={(value) => set("contactEmail", value)} />
          <Field label="Phone Number" value={form.phoneNumber || ""} onChange={(value) => set("phoneNumber", value)} />
          <Field label="Website" value={form.website || ""} onChange={(value) => set("website", value)} />
          <Field label="Business Address" value={form.businessAddress || ""} onChange={(value) => set("businessAddress", value)} />
          <label className="sm:col-span-2 text-sm font-semibold">Biography<textarea value={form.biography || ""} onChange={(event) => set("biography", event.target.value)} rows={5} className="mt-2 w-full border p-4 font-normal outline-none focus:border-[#18bfa6]" /></label>
          {(["facebook", "instagram", "youtube", "linkedin"] as const).map((network) => <Field key={network} label={`${network[0].toUpperCase()}${network.slice(1)} URL`} value={form.socialLinks?.[network] || ""} onChange={(value) => set("socialLinks", { ...(form.socialLinks || {}), [network]: value })} />)}
        </div>
        <button disabled={updateProfile.isPending} className="mt-8 bg-[#18bfa6] px-7 py-3 font-semibold text-white">{updateProfile.isPending ? "Saving…" : "Save Settings"}</button>
      </form>
    </main>
  );
}

function AppWorkspace({ view, appId }: { view: View; appId?: string }) {
  const { appQuery, updateApp, uploadImages, reorderImages, deleteImage, sendInvite } = useMobileGalleryApp(appId);
  const { profileQuery } = useMobileGalleryProfile();
  const app = appQuery.data?.data;
  const profile = profileQuery.data?.data || {};
  const [tab, setTab] = useState<EditorTab>("photos");
  const [images, setImages] = useState<MobileGalleryImage[]>([]);
  useEffect(() => setImages(app?.images || []), [app?.images]);
  if (appQuery.isLoading || !app) return <div className="flex min-h-screen items-center justify-center text-sm text-[#777]">Loading mobile gallery…</div>;
  if (view === "preview") return <MobileGalleryPreviewScreen app={app} profile={profile} />;
  if (view === "share") return <MobileGalleryShareScreen app={app} profile={profile} sendInvite={sendInvite} />;

  return (
    <main className="min-h-screen bg-white text-[#202020]">
      <TopBar active="apps" />
      <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard/mobile-gallery" className="shrink-0"><ArrowLeft className="size-5" /></Link>
            {app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="size-16 shrink-0 rounded-2xl object-cover" /> : <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[#eee]"><Smartphone className="size-6" /></div>}
            <div className="min-w-0"><h1 className="truncate text-xl font-medium sm:text-2xl">{app.name}</h1><p className="mt-1 text-xs uppercase tracking-wider text-[#888]">{app.status}</p></div>
          </div>
          <div className="flex gap-2"><Link href={`/dashboard/mobile-gallery/apps/${app._id}/preview`} className="border bg-[#f3f3f3] px-4 py-3 text-sm sm:px-5">Preview</Link><Link href={`/dashboard/mobile-gallery/apps/${app._id}/share`} className="flex items-center gap-2 bg-[#18bfa6] px-4 py-3 text-sm font-semibold text-white sm:px-5"><Share2 className="size-4" />Share</Link></div>
        </div>
        <div className="mt-8 overflow-x-auto border-b">
          <div className="flex min-w-max gap-8">
            {([['photos','Photos'],['design','Design'],['app-settings','App Settings']] as const).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-1 pb-4 text-sm ${tab === value ? "border-[#18bfa6] font-semibold" : "border-transparent"}`}>{label}</button>)}
          </div>
        </div>
        {tab === "photos" && <PhotosEditor app={app} images={images} setImages={setImages} uploadImages={uploadImages} reorderImages={reorderImages} deleteImage={deleteImage} updateApp={updateApp} />}
        {tab === "design" && <MobileGalleryDesignEditor app={app} profile={profile} updateApp={updateApp} />}
        {tab === "app-settings" && <AppSettingsEditor app={app} updateApp={updateApp} />}
      </section>
    </main>
  );
}

function PhotosEditor({ app, images, setImages, uploadImages, reorderImages, deleteImage, updateApp }: any) {
  async function upload(files?: FileList | null) {
    if (!files?.length) return;
    await uploadImages.mutateAsync(files).then(() => toast.success("Photos uploaded")).catch((error: Error) => toast.error(error.message));
  }
  return (
    <section className="pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold">{images.length} photos</p>
        <div className="flex items-center gap-5 text-sm"><span className="flex items-center gap-2 text-[#888]"><GripVertical className="size-4" /> Drag to sort</span><label className="relative flex cursor-pointer items-center gap-2 font-semibold text-[#18bfa6]"><ImagePlus className="size-4" /> Add Photos<input type="file" accept="image/*" multiple className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => upload(event.target.files)} /></label></div>
      </div>
      <ReactSortable
        list={images.map((image: MobileGalleryImage) => ({ ...image, id: image._id }))}
        setList={(next: Array<MobileGalleryImage & { id: string }>) => {
          const normalized = next.map(({ id: _idAlias, ...image }) => image);
          setImages(normalized);
          if (normalized.length) reorderImages.mutate(normalized.map((image) => image._id));
        }}
        animation={180}
        className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5"
      >
        {images.map((image: MobileGalleryImage) => (
          <article key={image._id} className="group relative cursor-grab border bg-white p-1 shadow-sm active:cursor-grabbing">
            <img src={image.thumbnailUrl || image.url} alt="" className="aspect-square w-full object-cover" />
            <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button onClick={() => updateApp.mutate({ coverImage: image.url })} className="bg-white/95 px-2 py-1 text-[10px] font-semibold">Set Cover</button>
              <button onClick={() => deleteImage.mutate(image._id)} className="bg-white/95 p-1 text-red-500"><Trash2 className="size-4" /></button>
            </div>
            {app.coverImage === image.url && <span className="absolute left-2 top-2 bg-[#18bfa6] px-2 py-1 text-[9px] font-semibold uppercase text-white">Cover</span>}
          </article>
        ))}
      </ReactSortable>
      {!images.length && <label className="mt-8 flex min-h-72 cursor-pointer flex-col items-center justify-center border border-dashed px-5 text-center text-[#888]"><Upload className="size-8" /><span className="mt-3 text-sm">Upload photos to your mobile gallery</span><input type="file" accept="image/*" multiple className="hidden" onChange={(event) => upload(event.target.files)} /></label>}
    </section>
  );
}

function DesignEditor({ app, profile, updateApp }: { app: MobileGalleryApp; profile: MobileGalleryProfile; updateApp: any }) {
  const [draft, setDraft] = useState<MobileGalleryApp>(app);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  useEffect(() => setDraft(app), [app]);
  const design = draft.design || {};
  const patchDesign = (patch: Record<string, unknown>) => setDraft((current) => ({ ...current, design: { ...(current.design || {}), ...patch } }));
  const cover = draft.coverImage || draft.images?.[0]?.url;
  const focal = design.focal || { x: 50, y: 50 };

  async function uploadIcon(file?: File) {
    if (!file) return;
    try {
      const iconUrl = await uploadMobileGalleryAsset(file);
      setDraft((current) => ({ ...current, iconUrl }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  const save = () => updateApp.mutateAsync({ coverImage: draft.coverImage, iconUrl: draft.iconUrl, design: draft.design }).then(() => toast.success("Design saved")).catch((error: Error) => toast.error(error.message));

  return (
    <section className="grid gap-8 pt-7 lg:grid-cols-[minmax(0,1fr)_430px]">
      <div className="min-w-0">
        <Panel title="Cover Style">
          <div className="flex flex-wrap justify-end gap-5 pb-4 text-sm font-semibold text-[#18bfa6]"><button type="button" onClick={() => setCoverPickerOpen(true)} className="flex items-center gap-2"><ImagePlus className="size-4" /> Change photo</button><span>Set focal point below</span></div>
          <div className="grid grid-cols-3 gap-3">{(["full", "third", "none"] as const).map((style) => <button key={style} onClick={() => patchDesign({ coverStyle: style })} className={`border p-3 text-center sm:p-4 ${design.coverStyle === style ? "border-[#18bfa6]" : ""}`}><div className={`mx-auto h-24 w-14 rounded-xl bg-[#ddd] sm:h-28 sm:w-16 ${style === "third" ? "border-t-[34px] border-white sm:border-t-[38px]" : style === "none" ? "border-t-[66px] border-white sm:border-t-[75px]" : ""}`} /><p className="mt-3 text-xs capitalize sm:text-sm">{style}</p></button>)}</div>
          {cover && (
            <div className="mt-6">
              <div className="relative aspect-[4/3] overflow-hidden bg-[#eee]">
                <img src={cover} alt="Cover focal preview" className="h-full w-full object-cover" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
                <span className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#18bfa6] shadow" style={{ left: `${focal.x}%`, top: `${focal.y}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4"><label className="text-xs font-semibold">Horizontal focal<input type="range" min="0" max="100" value={focal.x} onChange={(event) => patchDesign({ focal: { x: Number(event.target.value), y: focal.y } })} className="mt-2 w-full" /></label><label className="text-xs font-semibold">Vertical focal<input type="range" min="0" max="100" value={focal.y} onChange={(event) => patchDesign({ focal: { x: focal.x, y: Number(event.target.value) } })} className="mt-2 w-full" /></label></div>
            </div>
          )}
        </Panel>
        <Panel title="Theme">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["echo", "spring", "lark", "sage"] as const).map((theme) => <button key={theme} onClick={() => patchDesign({ theme })} className={`relative min-h-32 overflow-hidden border px-3 py-5 capitalize ${design.theme === theme ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}><span className={`block text-lg ${theme === "echo" ? "font-serif uppercase tracking-widest" : theme === "spring" ? "font-serif italic" : theme === "sage" ? "font-mono uppercase tracking-wider" : "font-sans font-semibold"}`}>{theme}</span><span className="mt-4 block text-[10px] leading-4 text-[#777]">A unique cover font and layout</span>{design.theme === theme && <Check className="absolute right-2 top-2 size-4 text-[#18bfa6]" />}</button>)}</div>
          <p className="mt-4 text-xs leading-5 text-[#777]">Each cover theme offers a unique font and layout, giving your cover photo an amazing first impression.</p>
        </Panel>
        <Panel title="Photos Layout & Color">
          <div className="grid grid-cols-2 gap-3">{(["vertical", "horizontal"] as const).map((layout) => <button key={layout} onClick={() => patchDesign({ layout })} className={`border p-4 capitalize ${design.layout === layout ? "border-[#18bfa6]" : ""}`}>{layout}</button>)}</div>
          <p className="mt-3 text-xs text-[#777]">Vertical emphasizes portrait photos, and Horizontal emphasizes landscape photos.</p>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#777]">Grid style</p>
          <div className="mt-2 grid grid-cols-2 gap-3">{(["masonry", "grid"] as const).map((gridStyle) => <button key={gridStyle} onClick={() => patchDesign({ gridStyle })} className={`border p-4 capitalize ${design.gridStyle === gridStyle ? "border-[#18bfa6]" : ""}`}>{gridStyle}</button>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-4"><label className="text-xs font-semibold">Background Color<input type="color" value={design.backgroundColor || "#ffffff"} onChange={(event) => patchDesign({ backgroundColor: event.target.value })} className="mt-2 h-10 w-full" /></label><label className="text-xs font-semibold">Text Color<input type="color" value={design.textColor || "#222222"} onChange={(event) => patchDesign({ textColor: event.target.value })} className="mt-2 h-10 w-full" /></label></div>
        </Panel>
        <Panel title="App Icon"><div className="flex flex-wrap items-center gap-4">{draft.iconUrl ? <img src={draft.iconUrl} alt="" className="size-20 rounded-2xl object-cover" /> : <div className="flex size-20 items-center justify-center rounded-2xl bg-[#eee]"><Smartphone className="size-6" /></div>}<label className="relative cursor-pointer border px-4 py-2 text-sm">Upload Icon<input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => uploadIcon(event.target.files?.[0])} /></label></div><p className="mt-3 text-xs text-[#777]">This icon is used by the installable PWA on Android and iPhone home screens.</p></Panel>
        <button onClick={save} disabled={updateApp.isPending} className="mt-6 bg-[#18bfa6] px-7 py-3 font-semibold text-white">{updateApp.isPending ? "Saving…" : "Save Design"}</button>
      </div>
      <div className="lg:sticky lg:top-6 lg:h-fit"><PhonePreview><MobileGalleryPublic app={draft} profile={profile} embedded /></PhonePreview></div>
      {coverPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-4"><div><h3 className="text-xl font-semibold">Change cover photo</h3><p className="mt-1 text-sm text-[#777]">Choose any photo already uploaded to this app.</p></div><button onClick={() => setCoverPickerOpen(false)}><X className="size-5" /></button></div>
            <div className="mt-6 grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
              {(draft.images || []).map((image) => <button key={image._id} onClick={() => { setDraft((current) => ({ ...current, coverImage: image.url })); setCoverPickerOpen(false); }} className={`relative border-2 ${draft.coverImage === image.url ? "border-[#18bfa6]" : "border-transparent"}`}><img src={image.thumbnailUrl || image.url} alt="" className="aspect-square w-full object-cover" />{draft.coverImage === image.url && <span className="absolute right-2 top-2 rounded-full bg-[#18bfa6] p-1 text-white"><Check className="size-4" /></span>}</button>)}
            </div>
            {!draft.images?.length && <p className="py-16 text-center text-sm text-[#777]">Upload photos in the Photos tab first.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function AppSettingsEditor({ app, updateApp }: { app: MobileGalleryApp; updateApp: any }) {
  const [form, setForm] = useState(app);
  useEffect(() => setForm(app), [app]);
  const cta = form.settings?.callToAction || {};
  function save(event: FormEvent) {
    event.preventDefault();
    updateApp.mutateAsync({ name: form.name, eventDate: form.eventDate, status: form.status, settings: form.settings }).then(() => toast.success("App settings saved")).catch((error: Error) => toast.error(error.message));
  }
  return (
    <form onSubmit={save} className="max-w-[760px] space-y-7 pt-7">
      <Field label="App Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
      <label className="block text-sm font-semibold">Event Date<input type="date" value={form.eventDate ? new Date(form.eventDate).toISOString().slice(0, 10) : ""} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>
      <Toggle label="Status" description="You can take the gallery app online or offline quickly. Unpublished gallery apps can only be seen by you." enabled={form.status !== "draft"} onChange={(enabled) => setForm((current) => ({ ...current, status: enabled ? "published" : "draft" }))} enabledText="Published" disabledText="Unpublished" />
      <Toggle label="Call to Action Button" description="Add a call-to-action button to the end of the photo section to bring clients to your website or another page." enabled={cta.enabled !== false} onChange={(enabled) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, enabled } } }))} enabledText="Enabled" disabledText="Disabled" />
      {cta.enabled !== false && <div className="ml-3 grid gap-5 border-l-2 border-dotted pl-5 sm:ml-6 sm:pl-6"><Field label="Button Label" value={cta.label || "Visit Website"} onChange={(label) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, label } } }))} /><Field label="Link URL" value={cta.url || ""} onChange={(url) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, url } } }))} /></div>}
      <button disabled={updateApp.isPending} className="bg-[#18bfa6] px-7 py-3 font-semibold text-white">{updateApp.isPending ? "Saving…" : "Save Settings"}</button>
    </form>
  );
}

function PreviewScreen({ app, profile }: { app: MobileGalleryApp; profile: MobileGalleryProfile }) {
  return <main className="min-h-screen bg-[#f8f4f1] p-4"><Link href={`/dashboard/mobile-gallery/apps/${app._id}`} className="fixed left-4 top-4 z-40 flex items-center gap-2 bg-white/90 px-3 py-2 text-sm shadow-sm sm:left-5 sm:top-5"><ArrowLeft className="size-4" /> Back</Link><div className="mx-auto flex min-h-screen max-w-[430px] items-center py-16"><PhonePreview><MobileGalleryPublic app={app} profile={profile} embedded /></PhonePreview></div></main>;
}

function ShareScreen({ app }: { app: MobileGalleryApp }) {
  const [step, setStep] = useState<ShareStep>("method");
  const [email, setEmail] = useState("");
  const [templateId, setTemplateId] = useState<(typeof shareTemplates)[number]["id"]>("ready");
  const selectedTemplate = shareTemplates.find((template) => template.id === templateId) || shareTemplates[0];
  const [subject, setSubject] = useState(selectedTemplate.subject(app.name));
  const link = typeof window === "undefined" ? `/mobile-gallery/${app.slug}` : `${window.location.origin}/mobile-gallery/${app.slug}`;
  const intro = selectedTemplate.intro(app.name);
  const body = `Hi,\n\n${intro}\n\nInstall App: ${link}\n\nThanks`;

  function chooseTemplate(id: (typeof shareTemplates)[number]["id"]) {
    const template = shareTemplates.find((item) => item.id === id) || shareTemplates[0];
    setTemplateId(id);
    setSubject(template.subject(app.name));
    setStep("compose");
  }

  function send(event: FormEvent) {
    event.preventDefault();
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <main className="min-h-screen bg-[#f5f5f4] text-[#202020]">
      <div className="border-b bg-white px-4 py-4 sm:px-6"><button onClick={() => step === "method" ? history.back() : setStep(step === "compose" ? "templates" : "method")} className="flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> {step === "method" ? `Back to ${app.name}` : "Back"}</button></div>

      {step === "method" && (
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-8">
          <div className="text-center"><h1 className="text-3xl font-light">Share {app.name}</h1><p className="mt-3 text-sm text-[#777]">Choose how you want to share this mobile gallery app.</p></div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <button onClick={() => setStep("templates")} className="border bg-white p-8 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><Mail className="size-8 text-[#18bfa6]" /><h2 className="mt-5 text-xl font-semibold">Share by Email</h2><p className="mt-2 text-sm leading-6 text-[#777]">Select an email template, review the invitation and open it in your email application.</p></button>
            <button onClick={() => setStep("link")} className="border bg-white p-8 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><Link2 className="size-8 text-[#18bfa6]" /><h2 className="mt-5 text-xl font-semibold">Get Direct Link</h2><p className="mt-2 text-sm leading-6 text-[#777]">Copy the public app link or open it in a new tab to test installation.</p></button>
          </div>
        </section>
      )}

      {step === "templates" && (
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
          <div className="text-center"><h1 className="text-3xl font-light">Select Email Template</h1><p className="mt-3 text-sm text-[#777]">The selected template opens the invitation composer on the next page.</p></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {shareTemplates.map((template) => <button key={template.id} onClick={() => chooseTemplate(template.id)} className="overflow-hidden border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="border-b bg-[#fafafa] p-6 text-center"><Mail className="mx-auto size-7 text-[#18bfa6]" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#777]">{template.label}</p></div><div className="p-6"><h2 className="text-lg font-semibold">{template.title}</h2><p className="mt-3 text-sm leading-6 text-[#777]">{template.intro(app.name)}</p><span className="mt-6 inline-block text-sm font-semibold text-[#18bfa6]">Use Template →</span></div></button>)}
          </div>
        </section>
      )}

      {step === "link" && (
        <section className="mx-auto max-w-xl px-4 py-16 sm:px-8">
          <div className="bg-white p-6 shadow-sm sm:p-9"><Link2 className="size-8 text-[#18bfa6]" /><h1 className="mt-5 text-2xl font-light">Direct App Link</h1><p className="mt-2 text-sm leading-6 text-[#777]">Visitors see the app-install popup and can use the public mobile gallery from this link.</p><div className="mt-7 break-all border bg-[#fafafa] p-4 text-sm">{link}</div><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied"))} className="flex items-center gap-2 bg-[#18bfa6] px-5 py-3 font-semibold text-white"><Copy className="size-4" /> Copy Link</button><a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 border px-5 py-3"><ExternalLink className="size-4" /> Open Link</a></div></div>
        </section>
      )}

      {step === "compose" && (
        <div className="grid min-h-[calc(100vh-58px)] lg:grid-cols-2">
          <form onSubmit={send} className="bg-white p-5 sm:p-10 lg:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18bfa6]">{selectedTemplate.label}</p>
            <h1 className="mt-2 text-2xl font-light">Share by Email</h1>
            <Field label="Email" value={email} onChange={setEmail} type="email" required placeholder="e.g. johnsmith@email.com" />
            <Field label="Subject" value={subject} onChange={setSubject} />
            <textarea readOnly value={body} rows={9} className="mt-5 w-full border p-4 text-sm leading-6 text-[#555]" />
            <div className="mt-5 flex flex-wrap gap-3"><button className="flex items-center gap-2 bg-[#18bfa6] px-6 py-3 font-semibold text-white"><Mail className="size-4" /> Open Email Invite</button><button type="button" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied"))} className="flex items-center gap-2 border px-5 py-3"><Copy className="size-4" /> Copy Link</button></div>
            <p className="mt-4 text-xs leading-5 text-[#888]">This opens the prepared invitation in your device’s email application. The public app link is already included.</p>
          </form>
          <div className="flex items-center justify-center p-5 sm:p-8">
            <div className="w-full max-w-xl bg-white shadow">
              <div className="border-b p-8 text-center sm:p-10"><p className="text-xs uppercase tracking-widest text-[#777]">{selectedTemplate.label}</p><h2 className="mt-6 text-2xl sm:text-3xl">{selectedTemplate.title}</h2></div>
              <div className="p-8 text-center sm:p-10">{app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="mx-auto size-32 rounded-[28px] object-cover sm:size-36 sm:rounded-[30px]" /> : <div className="mx-auto flex size-32 items-center justify-center rounded-[28px] bg-[#eee]"><Smartphone className="size-9" /></div>}<h3 className="mt-4 uppercase tracking-widest">{app.name}</h3><p className="mx-auto mt-6 max-w-md text-sm leading-6 text-[#666]">{intro}</p><a href={link} className="mt-8 inline-block bg-[#18bfa6] px-7 py-3 font-semibold text-white">Install App</a></div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-b py-7"><h2 className="mb-5 text-lg font-medium">{title}</h2>{children}</section>;
}

function PhonePreview({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[390px] rounded-[42px] bg-white p-3 shadow-[0_22px_60px_rgba(0,0,0,0.16)]"><div className="h-[min(720px,78vh)] min-h-[560px] overflow-hidden rounded-[32px] border bg-white">{children}</div></div>;
}

function Field({ label, value, onChange, required = false, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="mt-5 block text-sm font-semibold">{label}<input type={type} required={required} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>;
}

function Toggle({ label, description, enabled, onChange, enabledText = "Enabled", disabledText = "Disabled" }: { label: string; description: string; enabled: boolean; onChange: (enabled: boolean) => void; enabledText?: string; disabledText?: string }) {
  return <div><p className="text-sm font-semibold">{label}</p><div className="mt-2 flex items-center"><button type="button" onClick={() => onChange(!enabled)} className={`h-8 w-16 rounded-full p-1 transition ${enabled ? "bg-[#18bfa6]" : "bg-[#ccc]"}`}><span className={`block size-6 rounded-full bg-white transition ${enabled ? "translate-x-8" : ""}`} /></button><span className="ml-3 text-sm text-[#888]">{enabled ? enabledText : disabledText}</span></div><p className="mt-2 text-xs leading-5 text-[#888]">{description}</p></div>;
}

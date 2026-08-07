"use client";

import { type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactSortable } from "react-sortablejs";
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  GripVertical,
  Home,
  ImagePlus,
  LayoutGrid,
  List,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Smartphone,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  type MobileGalleryApp,
  type MobileGalleryImage,
  type MobileGalleryProfile,
  fetchMobileGalleryImagesPage,
  uploadMobileGalleryAsset,
  useMobileGalleryApp,
  useMobileGalleryApps,
  useMobileGalleryProfile,
} from "@/api-hooks/use-mobile-gallery";
import { MobileGalleryDesignEditor } from "./mobile-gallery-design-editor";
import { MobileGalleryShareScreen } from "./mobile-gallery-share-screen";
import { MobileGalleryPreviewScreen } from "./mobile-gallery-preview-screen";
import { PlanFeatureLock } from "@/components/dashboard/plan-feature-lock";

type View = "apps" | "settings" | "editor" | "preview" | "share";
type EditorTab = "photos" | "design" | "app-settings";

const switcherItems = [
  {
    title: "Client Gallery",
    text: "Better way to share, deliver, proof and sell",
    href: "/dashboard/client-gallery",
    accent: "from-[#0dc6b5] to-[#9de7de]",
  },
  {
    title: "Store Gallery",
    text: "Your online store for prints and downloads",
    href: "/dashboard/store-gallery",
    accent: "from-[#ff4f5d] to-[#ffc7cd]",
  },
  {
    title: "Mobile Gallery App",
    text: "Create installable mobile-first photo apps",
    href: "/dashboard/mobile-gallery",
    accent: "from-[#f5c421] to-[#ffe99a]",
  },
];

export function MobileGalleryDashboard({ view, appId }: { view: View; appId?: string }) {
  const content = view === "apps"
    ? <AppsPage />
    : view === "settings"
      ? <ProfileSettingsPage />
      : <AppWorkspace view={view} appId={appId} />;
  return <PlanFeatureLock feature="mobileGallery" label="Mobile Gallery">{content}</PlanFeatureLock>;
}

function TopBar({ active }: { active: "apps" | "settings" }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  return (
    <header className="border-b border-[#eceaf2] bg-white">
      <div className="flex h-[74px] items-center justify-between px-4 sm:px-8 lg:px-10">
        <div className="relative min-w-0">
          <button onClick={() => setSwitcherOpen((value) => !value)} className="flex min-w-0 items-center gap-3 font-semibold text-[#17151f]">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#6337d8] text-white"><Smartphone className="size-4" /></span>
            <span className="truncate">Mobile Gallery App</span><ChevronDown className="size-4 shrink-0" />
          </button>
          {switcherOpen && (
            <div className="absolute left-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-[350px] overflow-hidden rounded-[10px] border border-[#eceaf2] bg-white shadow-[0_22px_60px_rgba(32,20,70,.16)]">
              <div className="p-3">
                {switcherItems.map((item) => {
                  const isActive = item.href === "/dashboard/mobile-gallery";
                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      className={`flex gap-4 rounded-[8px] border px-3 py-4 transition ${isActive ? "border-[#d9cef8] bg-[#f3efff]" : "border-transparent hover:bg-[#f8f6ff]"}`}
                    >
                      <span className={`mt-1 grid size-10 shrink-0 place-items-center rounded-full text-white ${isActive ? "bg-[#6337d8]" : `bg-gradient-to-br ${item.accent}`}`}>
                        {item.title === "Client Gallery" ? <LayoutGrid className="size-5" /> : item.title === "Store Gallery" ? <Store className="size-5" /> : <Smartphone className="size-5" />}
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className={`font-bold ${isActive ? "text-[#6337d8]" : "text-[#151515]"}`}>{item.title}</span>
                        <span className="text-xs leading-5 text-[#777]">{item.text}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              <div className="bg-[#f8f7fb] p-4 text-center"><Link href="/dashboard/client-gallery/dashboard" className="inline-flex items-center gap-2 text-sm text-[#4e3bbd]"><LayoutGrid className="size-4" />View Dashboard</Link></div>
            </div>
          )}
        </div>

      </div>
      <nav className="overflow-x-auto border-t border-[#f1eff5] px-4 sm:px-8 lg:px-10">
        <div className="flex h-14 min-w-max items-end gap-8">
          <Link href="/dashboard/mobile-gallery" className={`flex h-full items-center border-b-2 text-sm ${active === "apps" ? "border-[#6237dc] font-semibold text-[#6237dc]" : "border-transparent text-[#777]"}`}>Apps</Link>
          <Link href="/dashboard/mobile-gallery/settings" className={`flex h-full items-center border-b-2 text-sm ${active === "settings" ? "border-[#6237dc] font-semibold text-[#6237dc]" : "border-transparent text-[#777]"}`}>Settings</Link>
        </div>
      </nav>
    </header>
  );
}
function AppsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const { appsQuery, createApp, updateApp, deleteApp } = useMobileGalleryApps({ search: debouncedQuery, page, limit: pageSize });
  const pageData = appsQuery.data?.data;
  const apps = pageData?.items ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [editTarget, setEditTarget] = useState<MobileGalleryApp | null>(null);
  const [editName, setEditName] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MobileGalleryApp | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

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
    <main className="min-h-screen bg-white text-[#1d1a29]">
      <TopBar active="apps" />
      <section className="px-4 py-7 sm:px-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1280px] bg-white">
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#efedf4] px-5 py-7 sm:px-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-.03em] sm:text-[34px]">Mobile Gallery Apps</h1>
              <p className="mt-3 text-sm text-[#706c79]">Manage and monitor all your mobile gallery applications.</p>
            </div>
            <button onClick={() => setCreateOpen(true)} className="inline-flex h-12 items-center gap-2 rounded-[8px] bg-gradient-to-r from-[#4f24bd] to-[#7536dd] px-6 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(95,53,200,.22)] hover:opacity-95"><Plus className="size-4" /> Create New App</button>
          </div>

          <div className="flex flex-col gap-4 px-5 py-6 sm:px-8 md:flex-row md:items-center md:justify-end">
            <label className="relative block w-full max-w-[330px]"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7d7887]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps..." className="h-12 w-full rounded-[8px] border border-[#dedbe7] bg-white px-11 text-sm outline-none focus:border-[#6337d8] focus:ring-2 focus:ring-[#6337d8]/10" /></label>
            <div className="flex gap-3"><button className="grid size-11 place-items-center rounded-[7px] bg-[#6337d8] text-white"><LayoutGrid className="size-4" /></button><button className="grid size-11 place-items-center rounded-[7px] border border-[#dedbe7] bg-white text-[#5c5865]"><List className="size-4" /></button></div>
          </div>

          {appsQuery.isLoading && <p className="px-8 py-12 text-sm text-[#777]">Loading apps…</p>}
          <div className="grid gap-6 px-5 pb-8 sm:grid-cols-2 sm:px-8 xl:grid-cols-3">
            {apps.map((app) => (
              <article key={app._id} className="overflow-hidden rounded-[12px] border border-[#e9e6ef] bg-white shadow-[0_12px_30px_rgba(35,22,76,.05)]">
                <div className="relative p-7 pb-5">
                  <button className="absolute right-5 top-5 rounded-full p-2 text-[#77727f] hover:bg-[#f6f3fb]"><MoreVertical className="size-5" /></button>
                  <button onClick={() => router.push(`/dashboard/mobile-gallery/apps/${app._id}`)} className="block w-full text-left">
                    <div className="mx-auto size-40 overflow-hidden rounded-[34px] bg-[#f4f2f7] shadow-[0_12px_28px_rgba(20,12,45,.14)]">{app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-[#5e33d4] to-[#8b4bec] text-white"><Smartphone className="size-11" /></div>}</div>
                    <h2 className="mt-7 truncate text-xl font-bold uppercase tracking-[-.02em]">{app.name}</h2>
                    <span className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${app.status === "draft" ? "bg-[#f4f1f7] text-[#6e6877]" : "bg-[#e7f8f1] text-[#16966f]"}`}><span className={`size-2 rounded-full ${app.status === "draft" ? "bg-[#9c96a6]" : "bg-[#19b884]"}`} />{app.status === "draft" ? "Unpublished" : "Published"}</span>
                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#6e6975]"><span className="inline-flex items-center gap-2"><ImagePlus className="size-4" />{app.imageCount || 0} Photos</span><span className="inline-flex items-center gap-2"><Share2 className="size-4" />{app.eventDate ? new Date(app.eventDate).toLocaleDateString() : "No date"}</span></div>
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#efedf4] px-5 py-4">
                  <button onClick={() => router.push(`/dashboard/mobile-gallery/apps/${app._id}`)} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[7px] bg-[#f0ebff] text-sm font-semibold text-[#6337d8]"><Eye className="size-4" /> View Details</button>
                  <button onClick={() => { setEditTarget(app); setEditName(app.name); setEditEventDate(app.eventDate ? new Date(app.eventDate).toISOString().slice(0, 10) : ""); }} className="grid size-11 place-items-center rounded-[7px] border border-[#cfc6f6] text-[#6337d8]" aria-label={`Quick edit ${app.name}`}><Pencil className="size-4" /></button>
                  <button onClick={() => setDeleteTarget(app)} className="grid size-11 place-items-center rounded-[7px] border border-[#f2b9c1] text-[#e03850]" aria-label={`Delete ${app.name}`}><Trash2 className="size-4" /></button>
                </div>
              </article>
            ))}
          </div>

          {!appsQuery.isLoading && !apps.length && <div className="px-6 py-24 text-center text-[#777]">{debouncedQuery ? "No matching mobile gallery apps." : "Create your first mobile gallery app."}</div>}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#efedf4] px-5 py-5 text-sm text-[#6f6a78] sm:px-8">
            <span>{pageData?.total ? `Showing ${(pageData.page - 1) * pageData.limit + 1} to ${Math.min(pageData.page * pageData.limit, pageData.total)} of ${pageData.total} apps` : "Showing 0 apps"}</span>
            <div className="flex gap-3">
              <button disabled={!pageData || pageData.page <= 1 || appsQuery.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-10 place-items-center rounded-[7px] border border-[#dedbe7] disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="size-4" /></button>
              <button className="grid size-10 place-items-center rounded-[7px] bg-[#6337d8] font-semibold text-white">{pageData?.page ?? page}</button>
              <button disabled={!pageData || pageData.page >= pageData.totalPages || appsQuery.isFetching} onClick={() => setPage((value) => value + 1)} className="grid size-10 place-items-center rounded-[7px] border border-[#dedbe7] disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="size-4 rotate-180" /></button>
            </div>
          </div>
        </div>
      </section>

      {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px]"><form onSubmit={submit} className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Create Mobile Gallery App</h2><button type="button" onClick={() => setCreateOpen(false)}><X className="size-5" /></button></div><Field label="App Name" value={name} onChange={setName} required /><label className="mt-5 block text-sm font-semibold">Event Date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="mt-2 h-12 w-full rounded-[7px] border px-4 font-normal outline-none focus:border-[#6337d8]" /></label><button disabled={createApp.isPending} className="mt-7 w-full rounded-[7px] bg-gradient-to-r from-[#4f24bd] to-[#7536dd] px-5 py-3 font-semibold text-white">{createApp.isPending ? "Creating…" : "Create App"}</button></form></div>}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target && !updateApp.isPending) setEditTarget(null); }}>
          <form onSubmit={async (event) => { event.preventDefault(); try { await updateApp.mutateAsync({ id: editTarget._id, payload: { name: editName.trim(), eventDate: editEventDate } }); toast.success("Mobile gallery app updated"); setEditTarget(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update app"); } }} className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6337d8]">Quick edit</p><h2 className="mt-1 text-xl font-semibold">Edit app details</h2></div><button type="button" disabled={updateApp.isPending} onClick={() => setEditTarget(null)}><X className="size-5" /></button></div>
            <Field label="App Name" value={editName} onChange={setEditName} required />
            <label className="mt-5 block text-sm font-semibold">Event Date<input type="date" value={editEventDate} onChange={(event) => setEditEventDate(event.target.value)} className="mt-2 h-12 w-full rounded-[7px] border px-4 font-normal outline-none focus:border-[#6337d8]" /></label>
            <div className="mt-7 flex justify-end gap-3"><button type="button" disabled={updateApp.isPending} onClick={() => setEditTarget(null)} className="rounded-[7px] border px-5 py-3 text-sm font-semibold">Cancel</button><button disabled={updateApp.isPending || !editName.trim()} className="rounded-[7px] bg-gradient-to-r from-[#4f24bd] to-[#7536dd] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{updateApp.isPending ? "Saving…" : "Save changes"}</button></div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target && !deleteApp.isPending) setDeleteTarget(null); }}>
          <div className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">Delete app</p><h2 className="mt-2 text-xl font-semibold">Delete {deleteTarget.name}?</h2></div><button type="button" disabled={deleteApp.isPending} onClick={() => setDeleteTarget(null)} aria-label="Close delete confirmation"><X className="size-5" /></button></div>
            <p className="mt-4 text-sm leading-6 text-[#666]">This permanently removes the mobile gallery app and its uploaded photos. This action cannot be undone.</p>
            <div className="mt-7 flex justify-end gap-3"><button type="button" disabled={deleteApp.isPending} onClick={() => setDeleteTarget(null)} className="rounded-[7px] border px-5 py-3 text-sm font-semibold">Cancel</button><button type="button" disabled={deleteApp.isPending} onClick={async () => { try { await deleteApp.mutateAsync(deleteTarget._id); toast.success("Mobile gallery app deleted"); setDeleteTarget(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete app"); } }} className="flex items-center gap-2 rounded-[7px] bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"><Trash2 className="size-4" />{deleteApp.isPending ? "Deleting…" : "Delete"}</button></div>
          </div>
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
  async function uploadLogo(file?: File) { if (!file) return; try { set("logoUrl", await uploadMobileGalleryAsset(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); } }
  async function save(event: FormEvent) { event.preventDefault(); await updateProfile.mutateAsync(form).then(() => toast.success("Settings saved")).catch((error) => toast.error(error.message)); }

  return (
    <main className="min-h-screen bg-white text-[#202020]">
      <TopBar active="settings" />
      <form onSubmit={save} className="mx-auto max-w-[920px] px-4 py-10 sm:px-8">
        <div className="border-b pb-6"><h1 className="text-2xl font-light sm:text-3xl">Mobile Gallery Settings</h1><p className="mt-2 text-sm text-[#777]">This information appears in the Account tab of every mobile gallery app.</p></div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-semibold">Logo<div className="mt-2 flex flex-wrap items-center gap-5 border p-4">{form.logoUrl ? <img src={form.logoUrl} alt="" className="h-16 w-40 object-contain" /> : <div className="flex h-16 w-40 items-center justify-center bg-[#f5f5f5] text-xs text-[#888]">No logo</div>}<span className="relative cursor-pointer bg-[#f3f3f3] px-4 py-2 text-sm"><Upload className="mr-2 inline size-4" />Upload<input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => uploadLogo(event.target.files?.[0])} /></span></div></label>
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
  const { appQuery, updateApp, uploadImages, reorderImages, deleteImage } = useMobileGalleryApp(appId);
  const { profileQuery } = useMobileGalleryProfile();
  const app = appQuery.data?.data;
  const profile = profileQuery.data?.data || {};
  const [tab, setTab] = useState<EditorTab>("photos");
  const [images, setImages] = useState<MobileGalleryImage[]>([]);
  const [imagesHasMore, setImagesHasMore] = useState(false);
  const [imagesLoadingMore, setImagesLoadingMore] = useState(false);
  useEffect(() => setImages(app?.images || []), [app?.images]);
  useEffect(() => setImagesHasMore(Boolean(app?.imagesPage?.hasMore)), [app?.imagesPage?.hasMore]);
  if (appQuery.isLoading || !app) return <div className="flex min-h-screen items-center justify-center text-sm text-[#777]">Loading mobile gallery…</div>;
  if (view === "preview") return <MobileGalleryPreviewScreen app={app} profile={profile} />;
  if (view === "share") return <MobileGalleryShareScreen app={app} profile={profile} />;

  return (
    <main className="min-h-screen bg-white text-[#202020]">
      <TopBar active="apps" />
      <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-5"><div className="flex min-w-0 items-center gap-4"><Link href="/dashboard/mobile-gallery" className="shrink-0"><ArrowLeft className="size-5" /></Link>{app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="size-16 shrink-0 rounded-2xl object-cover" /> : <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[#eee]"><Smartphone className="size-6" /></div>}<div className="min-w-0"><h1 className="truncate text-xl font-medium sm:text-2xl">{app.name}</h1><p className="mt-1 text-xs uppercase tracking-wider text-[#888]">{app.status}</p></div></div><div className="flex gap-2"><Link href={`/dashboard/mobile-gallery/apps/${app._id}/preview`} className="border bg-[#f3f3f3] px-4 py-3 text-sm sm:px-5">Preview</Link><Link href={`/dashboard/mobile-gallery/apps/${app._id}/share`} className="flex items-center gap-2 bg-[#18bfa6] px-4 py-3 text-sm font-semibold text-white sm:px-5"><Share2 className="size-4" />Share</Link></div></div>
        <div className="mt-8 overflow-x-auto border-b"><div className="flex min-w-max gap-8">{([['photos','Photos'],['design','Design'],['app-settings','App Settings']] as const).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-1 pb-4 text-sm ${tab === value ? "border-[#18bfa6] font-semibold" : "border-transparent"}`}>{label}</button>)}</div></div>
        {tab === "photos" && <PhotosEditor app={app} images={images} setImages={setImages} imagesHasMore={imagesHasMore} setImagesHasMore={setImagesHasMore} imagesLoadingMore={imagesLoadingMore} setImagesLoadingMore={setImagesLoadingMore} uploadImages={uploadImages} reorderImages={reorderImages} deleteImage={deleteImage} updateApp={updateApp} />}
        {tab === "design" && <MobileGalleryDesignEditor app={app} profile={profile} updateApp={updateApp} />}
        {tab === "app-settings" && <AppSettingsEditor app={app} updateApp={updateApp} />}
      </section>
    </main>
  );
}

function PhotosEditor({ app, images, setImages, imagesHasMore, setImagesHasMore, imagesLoadingMore, setImagesLoadingMore, uploadImages, reorderImages, deleteImage, updateApp }: any) {
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ active: false, total: 0, uploaded: 0, currentName: "", currentPercent: 0 });
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const uploading = uploadProgress.active || Boolean(uploadImages.isPending);
  const uploadsLeft = Math.max(0, uploadProgress.total - uploadProgress.uploaded);
  const uploadPercent = uploadProgress.total
    ? Math.round(((uploadProgress.uploaded + uploadProgress.currentPercent / 100) / uploadProgress.total) * 100)
    : 0;
  const dropClass = draggingUpload ? " border-[#18bfa6] bg-[#f2fffd]" : "";
  function isFileDrag(event: DragEvent<HTMLElement>) { return Array.from(event.dataTransfer.types).includes("Files"); }
  function mediaFiles(files: FileList) { return Array.from(files).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/")); }
  async function upload(files?: FileList | File[] | null) {
    if (!files?.length || uploading) return;
    const selectedFiles = Array.from(files);
    setUploadProgress({ active: true, total: selectedFiles.length, uploaded: 0, currentName: selectedFiles[0]?.name ?? "", currentPercent: 0 });
    try {
      for (const [index, file] of selectedFiles.entries()) {
        setUploadProgress((current) => ({ ...current, currentName: file.name, currentPercent: 0 }));
        const response = await uploadImages.mutateAsync({
          files: [file],
          onProgress: (percent: number) => setUploadProgress((current) => ({ ...current, currentPercent: percent })),
        });
        const uploadedImages = Array.isArray(response?.data) ? response.data : [];
        if (uploadedImages.length) {
          setImages((current: MobileGalleryImage[]) => {
            const seen = new Set(current.map((image) => image._id));
            return [...current, ...uploadedImages.filter((image: MobileGalleryImage) => !seen.has(image._id))];
          });
        }
        setUploadProgress((current) => ({ ...current, uploaded: index + 1, currentPercent: 100 }));
      }
      toast.success(`Upload finished: ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadProgress({ active: false, total: 0, uploaded: 0, currentName: "", currentPercent: 0 });
    }
  }
  function onDragOver(event: DragEvent<HTMLElement>) { if (!isFileDrag(event) || uploading) return; event.preventDefault(); setDraggingUpload(true); }
  function onDragLeave(event: DragEvent<HTMLElement>) { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingUpload(false); }
  function onDrop(event: DragEvent<HTMLElement>) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setDraggingUpload(false);
    const files = mediaFiles(event.dataTransfer.files);
    if (!files.length) { toast.error("Drop image or video files only"); return; }
    void upload(files);
  }
  async function loadMoreImages() {
    if (imagesLoadingMore || !imagesHasMore) return;
    setImagesLoadingMore(true);
    try {
      const page = (await fetchMobileGalleryImagesPage(app._id, images.length, 60)).data;
      setImages((current: MobileGalleryImage[]) => {
        const seen = new Set(current.map((image) => image._id));
        return [...current, ...page.items.filter((image) => !seen.has(image._id))];
      });
      setImagesHasMore(page.hasMore);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load photos");
    } finally {
      setImagesLoadingMore(false);
    }
  }
  useEffect(() => {
    if (!imagesHasMore) return;
    const target = loaderRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreImages();
    }, { rootMargin: "700px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [images.length, imagesHasMore, imagesLoadingMore]);
  return (
    <section className={`relative pt-6${dropClass}`} onDragEnter={onDragOver} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {draggingUpload && <div className="pointer-events-none absolute inset-0 z-20 flex min-h-72 items-center justify-center border border-dashed border-[#18bfa6] bg-white/80 text-sm font-semibold text-[#18bfa6]">Drop media to upload</div>}
      <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm font-semibold">{images.length} items</p><div className="flex items-center gap-5 text-sm"><span className="flex items-center gap-2 text-[#888]"><GripVertical className="size-4" /> Drag to sort</span><label className={`relative flex cursor-pointer items-center gap-2 font-semibold text-[#18bfa6] ${uploading ? "pointer-events-none opacity-60" : ""}`}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {uploading ? `${uploadProgress.currentPercent}%` : "Add Media"}<input type="file" accept="image/*,video/*" multiple className="absolute inset-0 cursor-pointer opacity-0" disabled={uploading} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }} /></label></div></div>
      {uploading && (
        <div className="mt-5 border border-[#bdeee8] bg-[#f2fffd] px-4 py-3 text-sm text-[#096f64]">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 shrink-0 animate-spin" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Image {Math.min(uploadProgress.uploaded + 1, uploadProgress.total || 1)} of {uploadProgress.total || "selected"} · {uploadProgress.currentPercent}% uploaded. {uploadsLeft} left.</p>
              <p className="mt-1 truncate text-xs text-[#3f8179]">{uploadProgress.currentName || "Processing photo"}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden bg-[#d3f2ee]">
            <div className="h-full bg-[#18bfa6] transition-all duration-300" style={{ width: `${uploadPercent}%` }} />
          </div>
        </div>
      )}
      <ReactSortable list={images.map((image: MobileGalleryImage) => ({ ...image, id: image._id }))} setList={(next: Array<MobileGalleryImage & { id: string }>) => { const normalized = next.map(({ id: _idAlias, ...image }) => image); setImages(normalized); if (normalized.length) reorderImages.mutate(normalized.map((image) => image._id)); }} animation={180} className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {images.map((image: MobileGalleryImage) => <article key={image._id} className="group relative cursor-grab border bg-white p-1 shadow-sm active:cursor-grabbing">{image.mediaType === "video" ? <video src={image.url} className="aspect-square w-full object-cover" preload="metadata" muted /> : <img src={image.thumbnailUrl || image.url} alt="" className="aspect-square w-full object-cover" />}<div className="absolute inset-x-2 bottom-2 flex justify-between opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">{image.mediaType !== "video" && <button onClick={() => updateApp.mutate({ coverImage: image.url })} className="bg-white/95 px-2 py-1 text-[10px] font-semibold">Set Cover</button>}<button onClick={() => deleteImage.mutate(image._id)} className="ml-auto bg-white/95 p-1 text-red-500"><Trash2 className="size-4" /></button></div>{image.mediaType === "video" && <span className="absolute right-2 top-2 bg-black/75 px-2 py-1 text-[9px] font-semibold uppercase text-white">Video</span>}{app.coverImage === image.url && <span className="absolute left-2 top-2 bg-[#18bfa6] px-2 py-1 text-[9px] font-semibold uppercase text-white">Cover</span>}</article>)}
      </ReactSortable>
      {imagesHasMore && <div ref={loaderRef} className="flex h-20 items-center justify-center text-sm text-[#777]">{imagesLoadingMore ? "Loading photos..." : ""}</div>}
      {!images.length && <label className={`mt-8 flex min-h-72 cursor-pointer flex-col items-center justify-center border border-dashed px-5 text-center text-[#888]${dropClass}`}><Upload className="size-8" /><span className="mt-3 text-sm">{uploading ? `File ${Math.min(uploadProgress.uploaded + 1, uploadProgress.total || 1)} of ${uploadProgress.total || "selected"} · ${uploadProgress.currentPercent}%` : "Drop photos or videos here or browse"}</span><input type="file" accept="image/*,video/*" multiple className="hidden" disabled={uploading} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }} /></label>}
    </section>
  );
}

function AppSettingsEditor({ app, updateApp }: { app: MobileGalleryApp; updateApp: any }) {
  const [form, setForm] = useState(app);
  useEffect(() => setForm(app), [app]);
  const cta = form.settings?.callToAction || {};
  function save(event: FormEvent) { event.preventDefault(); updateApp.mutateAsync({ name: form.name, eventDate: form.eventDate, status: form.status, settings: form.settings }).then(() => toast.success("App settings saved")).catch((error: Error) => toast.error(error.message)); }
  return (
    <form onSubmit={save} className="max-w-[760px] space-y-7 pt-7">
      <Field label="App Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
      <label className="block text-sm font-semibold">Event Date<input type="date" value={form.eventDate ? new Date(form.eventDate).toISOString().slice(0, 10) : ""} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>
      <Toggle label="Status" description="You can take the gallery app online or offline quickly. Unpublished gallery apps can only be seen by you." enabled={form.status !== "draft"} onChange={(enabled) => setForm((current) => ({ ...current, status: enabled ? "published" : "draft" }))} enabledText="Published" disabledText="Unpublished" />
      <Toggle label="Call to Action Button" description="Add a call-to-action button to the end of the photo section to bring clients to your website or another page." enabled={cta.enabled !== false} onChange={(enabled) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, enabled } } }))} />
      {cta.enabled !== false && <div className="ml-3 grid gap-5 border-l-2 border-dotted pl-5 sm:ml-6 sm:pl-6"><Field label="Button Label" value={cta.label || "Visit Website"} onChange={(label) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, label } } }))} /><Field label="Link URL" value={cta.url || ""} onChange={(url) => setForm((current) => ({ ...current, settings: { ...current.settings, callToAction: { ...cta, url } } }))} /></div>}
      <button disabled={updateApp.isPending} className="bg-[#18bfa6] px-7 py-3 font-semibold text-white">{updateApp.isPending ? "Saving…" : "Save Settings"}</button>
    </form>
  );
}

function Field({ label, value, onChange, required = false, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="mt-5 block text-sm font-semibold">{label}<input type={type} required={required} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>;
}

function Toggle({ label, description, enabled, onChange, enabledText = "Enabled", disabledText = "Disabled" }: { label: string; description: string; enabled: boolean; onChange: (enabled: boolean) => void; enabledText?: string; disabledText?: string }) {
  return <div><p className="text-sm font-semibold">{label}</p><div className="mt-2 flex items-center"><button type="button" onClick={() => onChange(!enabled)} className={`h-8 w-16 rounded-full p-1 transition ${enabled ? "bg-[#18bfa6]" : "bg-[#ccc]"}`}><span className={`block size-6 rounded-full bg-white transition ${enabled ? "translate-x-8" : ""}`} /></button><span className="ml-3 text-sm text-[#888]">{enabled ? enabledText : disabledText}</span></div><p className="mt-2 text-xs leading-5 text-[#888]">{description}</p></div>;
}



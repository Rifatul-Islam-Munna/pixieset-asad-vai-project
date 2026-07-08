"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ImagePlus, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import type { MobileGalleryApp, MobileGalleryProfile } from "@/api-hooks/use-mobile-gallery";
import { uploadMobileGalleryAsset } from "@/api-hooks/use-mobile-gallery";
import { MobileGalleryPublic } from "./mobile-gallery-public";
import { MobileGalleryThemePreview } from "./mobile-gallery-cover";

export function MobileGalleryDesignEditor({
  app,
  profile,
  updateApp,
}: {
  app: MobileGalleryApp;
  profile: MobileGalleryProfile;
  updateApp: any;
}) {
  const [draft, setDraft] = useState<MobileGalleryApp>(app);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  useEffect(() => setDraft(app), [app]);

  const design = draft.design || {};
  const patchDesign = (patch: Record<string, unknown>) =>
    setDraft((current) => ({ ...current, design: { ...(current.design || {}), ...patch } }));
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

  const save = () => updateApp
    .mutateAsync({ coverImage: draft.coverImage, iconUrl: draft.iconUrl, design: draft.design })
    .then(() => toast.success("Design saved"))
    .catch((error: Error) => toast.error(error.message));

  return (
    <section className="grid gap-8 pt-7 lg:grid-cols-[minmax(0,1fr)_430px]">
      <div className="min-w-0">
        <Panel title="Cover Style">
          <div className="flex flex-wrap justify-end gap-5 pb-4 text-sm font-semibold text-[#18bfa6]">
            <button type="button" onClick={() => setCoverPickerOpen(true)} className="flex items-center gap-2">
              <ImagePlus className="size-4" /> Change photo
            </button>
            <span className="text-[#777]">Click the preview to set focal point</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["full", "third", "none"] as const).map((style) => (
              <button
                key={style}
                onClick={() => patchDesign({ coverStyle: style })}
                className={`border p-3 text-center sm:p-4 ${design.coverStyle === style ? "border-[#18bfa6]" : ""}`}
              >
                <div className={`mx-auto h-24 w-14 rounded-xl bg-[#ddd] sm:h-28 sm:w-16 ${style === "third" ? "border-t-[34px] border-white sm:border-t-[38px]" : style === "none" ? "border-t-[66px] border-white sm:border-t-[75px]" : ""}`} />
                <p className="mt-3 text-xs capitalize sm:text-sm">{style}</p>
              </button>
            ))}
          </div>
          {cover && (
            <div className="mt-6">
              <div
                className="relative aspect-[4/3] cursor-crosshair overflow-hidden bg-[#eee]"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
                  const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
                  patchDesign({ focal: { x: Math.round(x), y: Math.round(y) } });
                }}
              >
                <img src={cover} alt="Cover focal preview" className="h-full w-full object-cover" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
                <span className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#18bfa6] shadow" style={{ left: `${focal.x}%`, top: `${focal.y}%` }} />
              </div>
              <p className="mt-2 text-xs text-[#777]">Click directly on the photo, or fine-tune the focal point with the sliders.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold">Horizontal focal<input type="range" min="0" max="100" value={focal.x} onChange={(event) => patchDesign({ focal: { x: Number(event.target.value), y: focal.y } })} className="mt-2 w-full" /></label>
                <label className="text-xs font-semibold">Vertical focal<input type="range" min="0" max="100" value={focal.y} onChange={(event) => patchDesign({ focal: { x: focal.x, y: Number(event.target.value) } })} className="mt-2 w-full" /></label>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Theme">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["echo", "spring", "lark", "sage"] as const).map((themeName) => (
              <button
                key={themeName}
                onClick={() => patchDesign({ theme: themeName })}
                className={`relative overflow-hidden border text-left capitalize ${design.theme === themeName ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}
              >
                <MobileGalleryThemePreview theme={themeName} />
                <span className="block px-3 py-3 text-sm font-semibold">{themeName}</span>
                {design.theme === themeName && <Check className="absolute right-2 top-2 size-5 rounded-full bg-white p-0.5 text-[#18bfa6]" />}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#777]">Each cover theme uses its own font, title position, date treatment and visual layout.</p>
        </Panel>

        <Panel title="Photos Layout & Color">
          <div className="grid grid-cols-2 gap-3">
            {(["vertical", "horizontal"] as const).map((layout) => (
              <button key={layout} onClick={() => patchDesign({ layout })} className={`border p-4 capitalize ${design.layout === layout ? "border-[#18bfa6]" : ""}`}>{layout}</button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#777]">Vertical emphasizes portrait photos, and Horizontal emphasizes landscape photos.</p>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#777]">Grid style</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["masonry", "grid"] as const).map((gridStyle) => (
              <button key={gridStyle} onClick={() => patchDesign({ gridStyle })} className={`border p-4 capitalize ${design.gridStyle === gridStyle ? "border-[#18bfa6]" : ""}`}>{gridStyle}</button>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">Background Color<input type="color" value={design.backgroundColor || "#ffffff"} onChange={(event) => patchDesign({ backgroundColor: event.target.value })} className="mt-2 h-10 w-full" /></label>
            <label className="text-xs font-semibold">Text Color<input type="color" value={design.textColor || "#222222"} onChange={(event) => patchDesign({ textColor: event.target.value })} className="mt-2 h-10 w-full" /></label>
          </div>
        </Panel>

        <Panel title="App Icon">
          <div className="flex flex-wrap items-center gap-4">
            {draft.iconUrl ? <img src={draft.iconUrl} alt="" className="size-20 rounded-2xl object-cover" /> : <div className="flex size-20 items-center justify-center rounded-2xl bg-[#eee]"><Smartphone className="size-6" /></div>}
            <label className="relative cursor-pointer border px-4 py-2 text-sm">Upload Icon<input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => uploadIcon(event.target.files?.[0])} /></label>
          </div>
          <p className="mt-3 text-xs text-[#777]">This icon is used by the installable PWA on Android, desktop and iPhone home screens.</p>
        </Panel>

        <button onClick={save} disabled={updateApp.isPending} className="mt-6 bg-[#18bfa6] px-7 py-3 font-semibold text-white disabled:opacity-60">{updateApp.isPending ? "Saving…" : "Save Design"}</button>
      </div>

      <div className="lg:sticky lg:top-6 lg:h-fit"><PhonePreview><MobileGalleryPublic app={draft} profile={profile} embedded /></PhonePreview></div>

      {coverPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div><h3 className="text-xl font-semibold">Change cover photo</h3><p className="mt-1 text-sm text-[#777]">Choose any photo already uploaded to this app.</p></div>
              <button onClick={() => setCoverPickerOpen(false)}><X className="size-5" /></button>
            </div>
            <div className="mt-6 grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
              {(draft.images || []).map((image) => (
                <button key={image._id} onClick={() => { setDraft((current) => ({ ...current, coverImage: image.url })); setCoverPickerOpen(false); }} className={`relative border-2 ${draft.coverImage === image.url ? "border-[#18bfa6]" : "border-transparent"}`}>
                  <img src={image.thumbnailUrl || image.url} alt="" className="aspect-square w-full object-cover" />
                  {draft.coverImage === image.url && <span className="absolute right-2 top-2 rounded-full bg-[#18bfa6] p-1 text-white"><Check className="size-4" /></span>}
                </button>
              ))}
            </div>
            {!draft.images?.length && <p className="py-16 text-center text-sm text-[#777]">Upload photos in the Photos tab first.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-b py-7"><h2 className="mb-5 text-lg font-medium">{title}</h2>{children}</section>;
}

function PhonePreview({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[390px] rounded-[42px] bg-white p-3 shadow-[0_22px_60px_rgba(0,0,0,0.16)]"><div className="h-[min(720px,78vh)] min-h-[560px] overflow-hidden rounded-[32px] border bg-white">{children}</div></div>;
}

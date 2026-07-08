"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ImagePlus,
  Move,
  RotateCcw,
  Smartphone,
  Type,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { MobileGalleryApp, MobileGalleryCoverText, MobileGalleryProfile } from "@/api-hooks/use-mobile-gallery";
import { uploadMobileGalleryAsset } from "@/api-hooks/use-mobile-gallery";
import { MobileGalleryPublic } from "./mobile-gallery-public";
import { getMobileGalleryCoverDefaults, MobileGalleryThemePreview } from "./mobile-gallery-cover";

const coverPresets: Array<{ name: string; description: string; value: MobileGalleryCoverText }> = [
  { name: "Minimal", description: "Clean title and date", value: { eyebrow: "", subtitle: "", alignment: "left", verticalPosition: "bottom", positionX: 8, positionY: 78, fontPreset: "sans", titleSize: 42, letterSpacing: 1, uppercase: false, showDivider: true, showDate: true, contentWidth: 88, overlayColor: "#000000", overlayOpacity: 26, textColor: "#ffffff", shadowStrength: 26 } },
  { name: "Editorial", description: "Elegant serif story cover", value: { eyebrow: "A collection of moments", subtitle: "", alignment: "left", verticalPosition: "bottom", positionX: 8, positionY: 78, fontPreset: "serif", titleSize: 52, letterSpacing: 0, uppercase: false, showDivider: false, showDate: true, contentWidth: 82, overlayColor: "#000000", overlayOpacity: 32, textColor: "#ffffff", shadowStrength: 32 } },
  { name: "Centered", description: "Formal centered composition", value: { eyebrow: "Mobile Gallery", subtitle: "", alignment: "center", verticalPosition: "center", positionX: 50, positionY: 50, fontPreset: "serif", titleSize: 44, letterSpacing: 4, uppercase: true, showDivider: true, showDate: true, contentWidth: 90, overlayColor: "#000000", overlayOpacity: 38, textColor: "#ffffff", shadowStrength: 34 } },
  { name: "Cinematic", description: "Bold image-first cover", value: { eyebrow: "", subtitle: "A story told in photographs", alignment: "center", verticalPosition: "bottom", positionX: 50, positionY: 80, fontPreset: "sans", titleSize: 56, subtitleSize: 15, letterSpacing: 2, uppercase: true, showDivider: false, showDate: false, contentWidth: 94, overlayColor: "#101820", overlayOpacity: 46, textColor: "#ffffff", shadowStrength: 50 } },
];

type DirectMode = "focal" | "text";

export function MobileGalleryDesignEditor({ app, profile, updateApp }: { app: MobileGalleryApp; profile: MobileGalleryProfile; updateApp: any }) {
  const [draft, setDraft] = useState<MobileGalleryApp>(app);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [directMode, setDirectMode] = useState<DirectMode>("focal");
  useEffect(() => setDraft(app), [app]);

  const design = draft.design || {};
  const themeName = design.theme || "lark";
  const coverStyle = design.coverStyle || "none";
  const coverText = getMobileGalleryCoverDefaults(draft, themeName, coverStyle, design.coverText);
  const focal = design.focal || { x: 50, y: 50 };
  const cover = draft.coverImage || draft.images?.[0]?.url;

  const patchDesign = (patch: Record<string, unknown>) => setDraft((current) => ({ ...current, design: { ...(current.design || {}), ...patch } }));
  const patchCoverText = (patch: Partial<MobileGalleryCoverText>) => setDraft((current) => ({ ...current, design: { ...(current.design || {}), coverText: { ...(current.design?.coverText || {}), ...patch } } }));

  async function uploadIcon(file?: File) {
    if (!file) return;
    try {
      const iconUrl = await uploadMobileGalleryAsset(file);
      setDraft((current) => ({ ...current, iconUrl }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  async function uploadFont(file?: File) {
    if (!file) return;
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) {
      toast.error("Upload a WOFF, WOFF2, TTF, or OTF font file");
      return;
    }
    try {
      const customFontUrl = await uploadMobileGalleryAsset(file);
      patchCoverText({ customFontUrl, customFontName: file.name, fontPreset: "custom" });
      toast.success("Custom font uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Font upload failed");
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
            <button type="button" onClick={() => setCoverPickerOpen(true)} className="flex items-center gap-2"><ImagePlus className="size-4" /> Change photo</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["full", "third", "none"] as const).map((style) => (
              <button key={style} onClick={() => { patchDesign({ coverStyle: style }); if (style !== "full") setDirectMode("focal"); }} className={`border p-3 text-center sm:p-4 ${coverStyle === style ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}>
                <div className={`mx-auto h-24 w-14 rounded-xl bg-[#ddd] sm:h-28 sm:w-16 ${style === "third" ? "border-t-[34px] border-white sm:border-t-[38px]" : style === "none" ? "border-t-[66px] border-white sm:border-t-[75px]" : ""}`} />
                <p className="mt-3 text-xs capitalize sm:text-sm">{style}</p>
              </button>
            ))}
          </div>

          {cover && (
            <DirectCoverEditor
              cover={cover}
              mode={directMode}
              setMode={setDirectMode}
              allowTextDrag={coverStyle === "full"}
              focal={focal}
              text={coverText}
              onFocalChange={(next) => patchDesign({ focal: next })}
              onTextPositionChange={(positionX, positionY) => patchCoverText({ positionX, positionY })}
            />
          )}
        </Panel>

        <Panel title="Theme">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["echo", "spring", "lark", "sage"] as const).map((name) => (
              <button key={name} onClick={() => patchDesign({ theme: name, coverText: {} })} className={`relative overflow-hidden border text-left capitalize ${themeName === name ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}>
                <MobileGalleryThemePreview theme={name} />
                <span className="block px-3 py-3 text-sm font-semibold">{name}</span>
                {themeName === name && <Check className="absolute right-2 top-2 size-5 rounded-full bg-white p-0.5 text-[#18bfa6]" />}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#777]">Choose a theme, then use the direct cover editor and simple option buttons below.</p>
        </Panel>

        <Panel title="Cover Maker">
          <div className="grid gap-3 sm:grid-cols-2">
            {coverPresets.map((preset) => (
              <button key={preset.name} type="button" onClick={() => patchCoverText({ ...preset.value, title: coverText.title || draft.name })} className="border p-4 text-left transition hover:border-[#18bfa6] hover:bg-[#f7fffd]">
                <span className="font-semibold">{preset.name}</span>
                <span className="mt-1 block text-xs text-[#777]">{preset.description}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            <TextField label="Eyebrow" value={coverText.eyebrow} placeholder="Mobile Gallery" onChange={(value) => patchCoverText({ eyebrow: value })} />
            <TextField label="Main Title" value={coverText.title} placeholder={draft.name} onChange={(value) => patchCoverText({ title: value })} />
            <label className="text-xs font-semibold">Subtitle<textarea value={coverText.subtitle} onChange={(event) => patchCoverText({ subtitle: event.target.value })} rows={3} placeholder="Optional short story or description" className="mt-2 w-full border p-3 font-normal outline-none focus:border-[#18bfa6]" /></label>
            <TextField label="Custom Date Label" value={coverText.dateLabel} placeholder="Leave empty to use Event Date" onChange={(value) => patchCoverText({ dateLabel: value })} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y py-4">
            <button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="font-semibold text-[#18bfa6]">{advancedOpen ? "Hide" : "Show"} advanced controls</button>
            <button type="button" onClick={() => patchDesign({ coverText: {} })} className="flex items-center gap-2 text-sm text-[#777]"><RotateCcw className="size-4" /> Reset to theme</button>
          </div>

          {advancedOpen && (
            <div className="mt-6 grid gap-6">
              <div>
                <p className="text-xs font-semibold">Text Alignment</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["left", "center", "right"] as const).map((alignment) => (
                    <button key={alignment} type="button" onClick={() => patchCoverText({ alignment, positionX: alignment === "left" ? 8 : alignment === "center" ? 50 : 92 })} className={`flex items-center justify-center border p-3 ${coverText.alignment === alignment ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}>
                      {alignment === "left" ? <AlignLeft className="size-4" /> : alignment === "center" ? <AlignCenter className="size-4" /> : <AlignRight className="size-4" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold">Vertical Position</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["top", "center", "bottom"] as const).map((position) => (
                    <button key={position} type="button" onClick={() => patchCoverText({ verticalPosition: position, positionY: position === "top" ? 18 : position === "center" ? 50 : 80 })} className={`border p-3 text-sm capitalize ${coverText.verticalPosition === position ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}>{position}</button>
                  ))}
                </div>
              </div>

              <label className="text-xs font-semibold">Font Style
                <select value={coverText.fontPreset} onChange={(event) => patchCoverText({ fontPreset: event.target.value as MobileGalleryCoverText["fontPreset"] })} className="mt-2 h-11 w-full border px-3 font-normal">
                  <option value="theme">Theme Default</option>
                  <option value="serif">Serif</option>
                  <option value="sans">Sans Serif</option>
                  <option value="mono">Monospace</option>
                  <option value="script">Script</option>
                  {coverText.customFontUrl && <option value="custom">Custom: {coverText.customFontName || "Uploaded font"}</option>}
                </select>
              </label>

              <div className="rounded border bg-[#fafafa] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold">Custom Font</p><p className="mt-1 text-xs text-[#777]">WOFF, WOFF2, TTF or OTF</p></div>
                  <label className="relative flex cursor-pointer items-center gap-2 border bg-white px-4 py-2 text-sm font-semibold"><Upload className="size-4" /> Upload Font<input type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => uploadFont(event.target.files?.[0])} /></label>
                </div>
                {coverText.customFontUrl && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs"><span className="truncate text-[#555]">{coverText.customFontName || "Custom font uploaded"}</span><button type="button" onClick={() => patchCoverText({ customFontUrl: "", customFontName: "", fontPreset: "theme" })} className="text-red-600">Remove</button></div>}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <OptionPicker label="Title Size" value={coverText.titleSize} values={[32, 42, 56, 72]} suffix="px" onChange={(value) => patchCoverText({ titleSize: value })} />
                <OptionPicker label="Subtitle Size" value={coverText.subtitleSize} values={[12, 15, 18, 24]} suffix="px" onChange={(value) => patchCoverText({ subtitleSize: value })} />
                <OptionPicker label="Letter Spacing" value={coverText.letterSpacing} values={[0, 1, 4, 8]} suffix="px" onChange={(value) => patchCoverText({ letterSpacing: value })} />
                <OptionPicker label="Text Width" value={coverText.contentWidth} values={[55, 72, 88, 100]} suffix="%" onChange={(value) => patchCoverText({ contentWidth: value })} />
                <OptionPicker label="Overlay Opacity" value={coverText.overlayOpacity} values={[0, 25, 40, 60]} suffix="%" onChange={(value) => patchCoverText({ overlayOpacity: value })} />
                <OptionPicker label="Text Shadow" value={coverText.shadowStrength} values={[0, 25, 50, 75]} suffix="%" onChange={(value) => patchCoverText({ shadowStrength: value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold">Cover Text Color<input type="color" value={coverText.textColor || (coverStyle === "full" ? "#ffffff" : design.textColor || "#222222")} onChange={(event) => patchCoverText({ textColor: event.target.value })} className="mt-2 h-10 w-full" /></label>
                <label className="text-xs font-semibold">Overlay Color<input type="color" value={coverText.overlayColor} onChange={(event) => patchCoverText({ overlayColor: event.target.value })} className="mt-2 h-10 w-full" /></label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Toggle label="Show date" checked={coverText.showDate} onChange={(checked) => patchCoverText({ showDate: checked })} />
                <Toggle label="Show divider" checked={coverText.showDivider} onChange={(checked) => patchCoverText({ showDivider: checked })} />
                <Toggle label="Uppercase title" checked={coverText.uppercase} onChange={(checked) => patchCoverText({ uppercase: checked })} />
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Photos Layout & Color">
          <div className="grid grid-cols-2 gap-3">{(["vertical", "horizontal"] as const).map((layout) => <button key={layout} onClick={() => patchDesign({ layout })} className={`border p-4 capitalize ${design.layout === layout ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}>{layout}</button>)}</div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#777]">Grid style</p>
          <div className="mt-2 grid grid-cols-2 gap-3">{(["masonry", "grid"] as const).map((gridStyle) => <button key={gridStyle} onClick={() => patchDesign({ gridStyle })} className={`border p-4 capitalize ${design.gridStyle === gridStyle ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}>{gridStyle}</button>)}</div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Background Color<input type="color" value={design.backgroundColor || "#ffffff"} onChange={(event) => patchDesign({ backgroundColor: event.target.value })} className="mt-2 h-10 w-full" /></label><label className="text-xs font-semibold">Text Color<input type="color" value={design.textColor || "#222222"} onChange={(event) => patchDesign({ textColor: event.target.value })} className="mt-2 h-10 w-full" /></label></div>
        </Panel>

        <Panel title="App Icon">
          <div className="flex flex-wrap items-center gap-4">{draft.iconUrl ? <img src={draft.iconUrl} alt="" className="size-20 rounded-2xl object-cover" /> : <div className="flex size-20 items-center justify-center rounded-2xl bg-[#eee]"><Smartphone className="size-6" /></div>}<label className="relative cursor-pointer border px-4 py-2 text-sm">Upload Icon<input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => uploadIcon(event.target.files?.[0])} /></label></div>
        </Panel>

        <button onClick={save} disabled={updateApp.isPending} className="mt-6 bg-[#18bfa6] px-7 py-3 font-semibold text-white disabled:opacity-60">{updateApp.isPending ? "Saving…" : "Save Design"}</button>
      </div>

      <div className="lg:sticky lg:top-6 lg:h-fit"><PhonePreview><MobileGalleryPublic app={draft} profile={profile} embedded /></PhonePreview></div>

      {coverPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-4"><div><h3 className="text-xl font-semibold">Change cover photo</h3><p className="mt-1 text-sm text-[#777]">Choose any uploaded photo.</p></div><button onClick={() => setCoverPickerOpen(false)}><X className="size-5" /></button></div>
            <div className="mt-6 grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">{(draft.images || []).map((image) => <button key={image._id} onClick={() => { setDraft((current) => ({ ...current, coverImage: image.url })); setCoverPickerOpen(false); }} className={`relative border-2 ${draft.coverImage === image.url ? "border-[#18bfa6]" : "border-transparent"}`}><img src={image.thumbnailUrl || image.url} alt="" className="aspect-square w-full object-cover" />{draft.coverImage === image.url && <span className="absolute right-2 top-2 rounded-full bg-[#18bfa6] p-1 text-white"><Check className="size-4" /></span>}</button>)}</div>
          </div>
        </div>
      )}
    </section>
  );
}

function DirectCoverEditor({ cover, mode, setMode, allowTextDrag, focal, text, onFocalChange, onTextPositionChange }: { cover: string; mode: DirectMode; setMode: (mode: DirectMode) => void; allowTextDrag: boolean; focal: { x: number; y: number }; text: Required<MobileGalleryCoverText>; onFocalChange: (value: { x: number; y: number }) => void; onTextPositionChange: (x: number, y: number) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  function update(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    if (mode === "focal") onFocalChange({ x: Math.round(x), y: Math.round(y) });
    else if (allowTextDrag) onTextPositionChange(Math.round(Math.max(3, Math.min(97, x))), Math.round(Math.max(8, Math.min(92, y))));
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    update(event);
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("focal")} className={`flex items-center gap-2 border px-3 py-2 text-sm ${mode === "focal" ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}><Move className="size-4" /> Move Photo Focal</button>
        <button type="button" disabled={!allowTextDrag} onClick={() => setMode("text")} className={`flex items-center gap-2 border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${mode === "text" ? "border-[#18bfa6] bg-[#f4fffc]" : ""}`}><Type className="size-4" /> Move Cover Text</button>
        <button type="button" onClick={() => mode === "focal" ? onFocalChange({ x: 50, y: 50 }) : onTextPositionChange(50, 50)} className="ml-auto border px-3 py-2 text-xs text-[#777]">Center</button>
      </div>
      <div
        ref={canvasRef}
        onPointerDown={pointerDown}
        onPointerMove={(event) => { if (dragging) update(event); }}
        onPointerUp={(event) => { setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => setDragging(false)}
        className={`relative aspect-[4/3] touch-none overflow-hidden bg-[#eee] ${mode === "focal" ? "cursor-crosshair" : "cursor-move"}`}
      >
        <img src={cover} alt="Cover editor" className="pointer-events-none h-full w-full select-none object-cover" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: toRgba(text.overlayColor, text.overlayOpacity / 100) }} />
        {mode === "focal" ? (
          <span className="pointer-events-none absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#18bfa6] text-white shadow-lg" style={{ left: `${focal.x}%`, top: `${focal.y}%` }}><Move className="size-4" /></span>
        ) : (
          <div className="pointer-events-none absolute max-w-[86%] -translate-x-1/2 -translate-y-1/2 rounded border border-dashed border-white/90 bg-black/25 px-4 py-3 text-center text-white shadow-lg" style={{ left: `${text.positionX}%`, top: `${text.positionY}%`, width: `${Math.min(92, text.contentWidth)}%` }}>
            <p className="truncate text-[10px] uppercase tracking-widest opacity-80">{text.eyebrow}</p>
            <p className="mt-1 truncate text-lg font-semibold">{text.title}</p>
            <span className="mt-2 block text-[9px] opacity-70">Drag anywhere to reposition</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-[#777]">{mode === "focal" ? `Drag the green point directly on the photo · ${focal.x}, ${focal.y}` : `Drag the text box directly · ${text.positionX}, ${text.positionY}`}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="border-b py-7"><h2 className="mb-5 text-lg font-medium">{title}</h2>{children}</section>; }
function PhonePreview({ children }: { children: ReactNode }) { return <div className="mx-auto w-full max-w-[390px] rounded-[42px] bg-white p-3 shadow-[0_22px_60px_rgba(0,0,0,0.16)]"><div className="h-[min(720px,78vh)] min-h-[560px] overflow-hidden rounded-[32px] border bg-white">{children}</div></div>; }
function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) { return <label className="text-xs font-semibold">{label}<input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full border px-3 font-normal outline-none focus:border-[#18bfa6]" /></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex cursor-pointer items-center gap-2 border p-3 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }

function OptionPicker({ label, value, values, suffix, onChange }: { label: string; value: number; values: number[]; suffix: string; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{label}</p><label className="flex items-center border bg-white"><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-8 w-16 px-2 text-right text-xs outline-none" /><span className="pr-2 text-[10px] text-[#777]">{suffix}</span></label></div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">{values.map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={`border px-2 py-2 text-xs ${value === option ? "border-[#18bfa6] bg-[#f4fffc] font-semibold" : ""}`}>{option}{suffix}</button>)}</div>
    </div>
  );
}

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((part) => part + part).join("") : normalized;
  const number = Number.parseInt(value || "000000", 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

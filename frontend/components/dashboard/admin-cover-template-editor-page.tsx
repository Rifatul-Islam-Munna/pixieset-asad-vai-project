"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Grip,
  ImagePlus,
  Layers3,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { updateHomeCms, uploadHomeCmsFile } from "@/actions/admin";
import { AdminResourceShell } from "./admin-resource-shell";
import type { CustomCoverElement, CustomCoverTemplate, HomeCmsData } from "@/lib/home-cms";
import { cn } from "@/lib/utils";

type ElementType = CustomCoverElement["type"];
type DragState = { id: string; offsetX: number; offsetY: number } | null;

const elementTypes: Array<{ type: ElementType; label: string }> = [
  { type: "title", label: "Title" },
  { type: "subtitle", label: "Subtitle" },
  { type: "date", label: "Date" },
  { type: "button", label: "Button" },
  { type: "brandText", label: "Brand text" },
  { type: "logo", label: "Logo" },
  { type: "line", label: "Line" },
];

function uid(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function blankTemplate(): CustomCoverTemplate {
  return {
    id: uid("cover"),
    name: "New custom cover",
    backgroundImage: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=85",
    overlayOpacity: 24,
    gridOpacity: 0,
    lineOpacity: 70,
    elements: [
      {
        id: uid("subtitle"),
        type: "subtitle",
        text: "YOUR STUDIO",
        x: 50,
        y: 39,
        width: 45,
        height: 8,
        fontSize: 13,
        color: "#ffffff",
        opacity: 100,
        align: "center",
      },
      {
        id: uid("title"),
        type: "title",
        text: "COLLECTION TITLE",
        x: 50,
        y: 50,
        width: 72,
        height: 16,
        fontSize: 40,
        color: "#ffffff",
        opacity: 100,
        align: "center",
      },
      {
        id: uid("date"),
        type: "date",
        text: "EVENT DATE",
        x: 50,
        y: 61,
        width: 38,
        height: 7,
        fontSize: 12,
        color: "#ffffff",
        opacity: 100,
        align: "center",
      },
    ],
  };
}

function newElement(type: ElementType): CustomCoverElement {
  const isLine = type === "line";
  const isLogo = type === "logo";
  return {
    id: uid(type),
    type,
    text: type === "button" ? "VIEW GALLERY" : type === "date" ? "EVENT DATE" : type === "brandText" ? "BRAND NAME" : isLine || isLogo ? "" : type.toUpperCase(),
    x: 50,
    y: 55,
    width: isLine ? 48 : isLogo ? 20 : type === "title" ? 70 : 48,
    height: isLine ? 1 : isLogo ? 14 : type === "title" ? 14 : 8,
    fontSize: type === "title" ? 38 : type === "button" ? 12 : 14,
    color: "#ffffff",
    opacity: 100,
    align: "center",
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function AdminCoverTemplateEditorPage({ initialCms, template }: { initialCms: HomeCmsData; template?: CustomCoverTemplate }) {
  const router = useRouter();
  const [cms, setCms] = useState(initialCms);
  const [draft, setDraft] = useState<CustomCoverTemplate>(() => template ? JSON.parse(JSON.stringify(template)) : blankTemplate());
  const [selectedId, setSelectedId] = useState(() => draft.elements[0]?.id ?? "");
  const [drag, setDrag] = useState<DragState>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [pending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => draft.elements.find((element) => element.id === selectedId) ?? null, [draft.elements, selectedId]);
  const isExisting = cms.coverTemplates.some((item) => item.id === draft.id);

  const patchElement = (id: string, patch: Partial<CustomCoverElement>) => setDraft((current) => ({
    ...current,
    elements: current.elements.map((element) => element.id === id ? { ...element, ...patch } : element),
  }));

  const selectAndAdd = (type: ElementType) => {
    const element = newElement(type);
    setDraft((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    const next = draft.elements.filter((element) => element.id !== selected.id);
    setDraft({ ...draft, elements: next });
    setSelectedId(next[0]?.id ?? "");
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: uid(selected.type), x: clamp(selected.x + 3, 0, 100), y: clamp(selected.y + 3, 0, 100) };
    setDraft({ ...draft, elements: [...draft.elements, copy] });
    setSelectedId(copy.id);
  };

  const moveLayer = (direction: -1 | 1) => {
    if (!selected) return;
    setDraft((current) => {
      const elements = [...current.elements];
      const index = elements.findIndex((element) => element.id === selected.id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= elements.length) return current;
      [elements[index], elements[target]] = [elements[target], elements[index]];
      return { ...current, elements };
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>, element: CustomCoverElement) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    setDrag({ id: element.id, offsetX: element.x - pointerX, offsetY: element.y - pointerY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * 100 + drag.offsetX;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100 + drag.offsetY;
    const step = snapToGrid ? 1 : 0.1;
    const x = Math.round(clamp(rawX, 0, 100) / step) * step;
    const y = Math.round(clamp(rawY, 0, 100) / step) * step;
    patchElement(drag.id, { x, y });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selected || ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      const amount = event.shiftKey ? 5 : 1;
      const patch: Partial<CustomCoverElement> = {};
      if (event.key === "ArrowLeft") patch.x = clamp(selected.x - amount, 0, 100);
      if (event.key === "ArrowRight") patch.x = clamp(selected.x + amount, 0, 100);
      if (event.key === "ArrowUp") patch.y = clamp(selected.y - amount, 0, 100);
      if (event.key === "ArrowDown") patch.y = clamp(selected.y + amount, 0, 100);
      if (!Object.keys(patch).length) return;
      event.preventDefault();
      patchElement(selected.id, patch);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const uploadBackground = async (file?: File) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = await uploadHomeCmsFile(formData);
      setDraft((current) => ({ ...current, backgroundImage: url }));
      toast.success("Background uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const save = () => {
    if (!draft.name.trim()) return toast.error("Template name is required");
    if (!draft.elements.length) return toast.error("Add at least one cover layer");
    startTransition(async () => {
      try {
        const normalized: CustomCoverTemplate = {
          ...draft,
          name: draft.name.trim(),
          overlayOpacity: clamp(Number(draft.overlayOpacity) || 0, 0, 100),
          gridOpacity: clamp(Number(draft.gridOpacity) || 0, 0, 100),
          lineOpacity: clamp(Number(draft.lineOpacity) || 0, 0, 100),
          elements: draft.elements.map((element) => ({
            ...element,
            x: clamp(Number(element.x) || 0, 0, 100),
            y: clamp(Number(element.y) || 0, 0, 100),
            width: clamp(Number(element.width) || 1, 1, 100),
            height: clamp(Number(element.height) || 1, 1, 100),
            fontSize: clamp(Number(element.fontSize) || 8, 6, 160),
            opacity: clamp(Number(element.opacity) || 0, 0, 100),
          })),
        };
        const nextTemplates = isExisting
          ? cms.coverTemplates.map((item) => item.id === normalized.id ? normalized : item)
          : [...cms.coverTemplates, normalized];
        const saved = await updateHomeCms({ ...cms, coverTemplates: nextTemplates });
        setCms(saved);
        toast.success(isExisting ? "Cover template updated" : "Cover template created");
        router.push("/admin/cover-templates");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save cover template");
      }
    });
  };

  return (
    <AdminResourceShell
      active="covers"
      title={isExisting ? `Edit: ${draft.name}` : "New custom cover"}
      subtitle="Drag any text, button, logo or line directly on the cover. Select a layer to fine-tune its size, color, alignment and exact position."
      action={(
        <div className="flex gap-2">
          <Link href="/admin/cover-templates" className="inline-flex h-11 items-center gap-2 border bg-white px-4 text-sm font-bold"><ArrowLeft className="size-4" />Back</Link>
          <button onClick={save} disabled={pending} className="inline-flex h-11 items-center gap-2 bg-[#22bda7] px-5 text-sm font-bold text-white disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save cover</button>
        </div>
      )}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {elementTypes.map((item) => (
                <button key={item.type} onClick={() => selectAndAdd(item.type)} className="inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold hover:bg-[#f5f5f3]"><Plus className="size-3.5" />{item.label}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={snapToGrid} onChange={(event) => setSnapToGrid(event.target.checked)} className="size-4 accent-[#22bda7]" />Snap to grid</label>
          </div>

          <div className="rounded-sm bg-[#e9e9e6] p-3 sm:p-6">
            <div
              ref={canvasRef}
              className="relative mx-auto aspect-[1.55] w-full max-w-[1180px] select-none overflow-hidden bg-[#111] text-white shadow-[0_30px_80px_rgba(0,0,0,0.2)]"
              onPointerMove={moveDrag}
              onPointerUp={() => setDrag(null)}
              onPointerCancel={() => setDrag(null)}
              onPointerLeave={(event) => { if (!event.buttons) setDrag(null); }}
              onPointerDown={() => setSelectedId("")}
            >
              <img src={draft.backgroundImage} alt="Cover background" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
              <div className="absolute inset-0 bg-black" style={{ opacity: draft.overlayOpacity / 100 }} />
              {draft.gridOpacity > 0 && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    opacity: draft.gridOpacity / 100,
                    backgroundImage: "linear-gradient(to right, rgba(255,255,255,.48) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.48) 1px, transparent 1px)",
                    backgroundSize: "10% 10%",
                  }}
                />
              )}
              {draft.elements.map((element) => (
                <CoverEditorElement
                  key={element.id}
                  element={element}
                  selected={selectedId === element.id}
                  logoUrl={cms.brand.logoUrl}
                  lineOpacity={draft.lineOpacity}
                  onPointerDown={(event) => startDrag(event, element)}
                />
              ))}
              {!draft.elements.length && <div className="absolute inset-0 flex items-center justify-center"><div className="border border-white/40 bg-black/30 px-6 py-4 text-center"><Layers3 className="mx-auto size-6" /><p className="mt-2 text-sm font-semibold">Add a layer to begin</p></div></div>}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#777]"><Grip className="size-4" />Drag layers on the cover. Use arrow keys for 1% movement or Shift + arrow for 5%.</div>
        </section>

        <aside className="grid content-start gap-5">
          <Panel title="Template">
            <Field label="Template name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
            <Field label="Background image URL" value={draft.backgroundImage} onChange={(backgroundImage) => setDraft({ ...draft, backgroundImage })} />
            <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 bg-[#111] px-4 text-sm font-bold text-white"><Upload className="size-4" />Upload background<input type="file" accept="image/*" className="hidden" onChange={(event) => void uploadBackground(event.target.files?.[0])} /></label>
            <NumberField label="Overlay opacity" value={draft.overlayOpacity} onChange={(overlayOpacity) => setDraft({ ...draft, overlayOpacity })} min={0} max={100} />
            <NumberField label="Grid opacity" value={draft.gridOpacity} onChange={(gridOpacity) => setDraft({ ...draft, gridOpacity })} min={0} max={100} />
            <NumberField label="Line opacity" value={draft.lineOpacity} onChange={(lineOpacity) => setDraft({ ...draft, lineOpacity })} min={0} max={100} />
          </Panel>

          <Panel title="Layers">
            <div className="grid gap-2">
              {[...draft.elements].reverse().map((element) => (
                <button key={element.id} onClick={() => setSelectedId(element.id)} className={cn("flex items-center justify-between gap-3 border px-3 py-3 text-left", selectedId === element.id ? "border-[#22bda7] bg-[#effbf8]" : "bg-white")}>
                  <span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#777]">{element.type}</span><span className="mt-1 block truncate text-sm font-semibold">{element.text || element.type}</span></span>
                  <Grip className="size-4 shrink-0 text-[#888]" />
                </button>
              ))}
            </div>
          </Panel>

          {selected ? (
            <Panel title="Selected layer">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => moveLayer(1)} className="inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold"><ArrowUp className="size-3.5" />Forward</button>
                <button onClick={() => moveLayer(-1)} className="inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold"><ArrowDown className="size-3.5" />Backward</button>
                <button onClick={duplicateSelected} className="inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold"><Copy className="size-3.5" />Duplicate</button>
                <button onClick={removeSelected} className="inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold text-red-600"><Trash2 className="size-3.5" />Delete</button>
              </div>
              {selected.type !== "line" && selected.type !== "logo" && <Field label="Text" value={selected.text} onChange={(text) => patchElement(selected.id, { text })} />}
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="X position" value={selected.x} onChange={(x) => patchElement(selected.id, { x })} min={0} max={100} />
                <NumberField label="Y position" value={selected.y} onChange={(y) => patchElement(selected.id, { y })} min={0} max={100} />
                <NumberField label="Width" value={selected.width} onChange={(width) => patchElement(selected.id, { width })} min={1} max={100} />
                <NumberField label="Height" value={selected.height} onChange={(height) => patchElement(selected.id, { height })} min={1} max={100} />
                {selected.type !== "line" && selected.type !== "logo" && <NumberField label="Font size" value={selected.fontSize} onChange={(fontSize) => patchElement(selected.id, { fontSize })} min={6} max={160} />}
                <NumberField label="Opacity" value={selected.opacity} onChange={(opacity) => patchElement(selected.id, { opacity })} min={0} max={100} />
              </div>
              <label className="grid gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#777]">Color</span><div className="flex gap-2"><input type="color" value={selected.color} onChange={(event) => patchElement(selected.id, { color: event.target.value })} className="h-11 w-14 border bg-white p-1" /><input value={selected.color} onChange={(event) => patchElement(selected.id, { color: event.target.value })} className="h-11 min-w-0 flex-1 border px-3 text-sm" /></div></label>
              {selected.type !== "line" && selected.type !== "logo" && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#777]">Alignment</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {([[
                      "left", AlignLeft,
                    ], ["center", AlignCenter], ["right", AlignRight]] as const).map(([align, Icon]) => (
                      <button key={align} onClick={() => patchElement(selected.id, { align })} className={cn("flex h-10 items-center justify-center border", selected.align === align && "border-[#22bda7] bg-[#effbf8]")} aria-label={`Align ${align}`}><Icon className="size-4" /></button>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          ) : (
            <div className="border border-dashed bg-white p-8 text-center"><ImagePlus className="mx-auto size-6 text-[#999]" /><p className="mt-3 text-sm font-semibold">Select a layer on the cover</p><p className="mt-1 text-xs leading-5 text-[#777]">Its detailed controls will appear here.</p></div>
          )}
        </aside>
      </div>
    </AdminResourceShell>
  );
}

function CoverEditorElement({ element, selected, logoUrl, lineOpacity, onPointerDown }: { element: CustomCoverElement; selected: boolean; logoUrl?: string; lineOpacity: number; onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void }) {
  const style = {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    opacity: element.opacity / 100,
    color: element.color,
    transform: "translate(-50%, -50%)",
    touchAction: "none" as const,
  };
  const selectionClass = selected ? "outline outline-2 outline-offset-2 outline-[#22bda7]" : "hover:outline hover:outline-1 hover:outline-white/60";

  if (element.type === "logo") {
    return (
      <button type="button" className={cn("absolute cursor-grab active:cursor-grabbing", selectionClass)} style={style} onPointerDown={onPointerDown}>
        {logoUrl ? <img src={logoUrl} alt="Brand logo" className="h-full w-full object-contain" draggable={false} /> : <span className="flex h-full w-full items-center justify-center border border-dashed border-current text-xs font-bold">LOGO</span>}
      </button>
    );
  }
  if (element.type === "line") {
    return <button type="button" className={cn("absolute cursor-grab border-t active:cursor-grabbing", selectionClass)} style={{ ...style, borderColor: element.color, opacity: (element.opacity * lineOpacity) / 10000 }} onPointerDown={onPointerDown} aria-label="Line layer" />;
  }
  return (
    <button
      type="button"
      className={cn("absolute flex cursor-grab items-center leading-tight active:cursor-grabbing", element.type === "button" && "justify-center border px-3 font-semibold uppercase tracking-[0.18em]", selectionClass)}
      style={{
        ...style,
        fontSize: element.fontSize,
        textAlign: element.align ?? "center",
        justifyContent: element.align === "left" ? "flex-start" : element.align === "right" ? "flex-end" : "center",
        borderColor: element.color,
      }}
      onPointerDown={onPointerDown}
    >
      {element.text || element.type}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border bg-white p-5"><div className="mb-4 flex items-center gap-2"><Layers3 className="size-4" /><h2 className="font-bold">{title}</h2></div><div className="grid gap-4">{children}</div></section>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#777]">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 border px-3 text-sm outline-none focus:border-[#22bda7]" /></label>;
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number }) {
  return <label className="grid gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#777]">{label}</span><input type="number" min={min} max={max} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(clamp(Number(event.target.value) || 0, min, max))} className="h-11 border px-3 text-sm outline-none focus:border-[#22bda7]" /></label>;
}

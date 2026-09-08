"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookHeart, BookOpen, Download, Image as ImageIcon, Loader2, Plus, Save, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useCollections, useCollectionActivity, useCollectionDetail, type CollectionImageRecord } from "@/api-hooks/use-collections";
import { useDashboardSettings } from "@/api-hooks/use-dashboard-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AlbumLayout = "full" | "split" | "triptych" | "grid";
type AlbumImage = { id: string; url: string; thumbnailUrl?: string; name?: string };
type AlbumSpread = { id: string; layout: AlbumLayout; images: AlbumImage[]; caption?: string };

type AlbumProject = {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  size: "12x12" | "10x10" | "8x8" | "12x8";
  coverStyle: "photo" | "minimal" | "linen";
  coverTitle: string;
  coverSubtitle: string;
  coverImage?: string;
  sourceFavoriteUserId?: string;
  sourceFavoriteEmail?: string;
  spreads: AlbumSpread[];
  updatedAt?: string;
};
const layouts: Array<{ value: AlbumLayout; label: string }> = [
  { value: "full", label: "Full bleed" },
  { value: "split", label: "Two up" },
  { value: "triptych", label: "Three up" },
  { value: "grid", label: "Four grid" },
];

const slotsFor = (layout: AlbumLayout) => layout === "full" ? 1 : layout === "split" ? 2 : layout === "triptych" ? 3 : 4;
const toAlbumImage = (image: CollectionImageRecord): AlbumImage => ({
  id: image._id,
  url: image.url,
  thumbnailUrl: image.thumbnailUrl,
  name: image.originalName,
});

export function AlbumDesigner() {
  const searchParams = useSearchParams();
  const requestedCollectionId = searchParams.get("collectionId") || "";
  const requestedFavoriteUserId = searchParams.get("favoriteUserId") || "";
  const albumSettings = useDashboardSettings<AlbumProject>("album-design");
  const { collectionsQuery } = useCollections();
  const projects = useMemo(() => albumSettings.query.data?.data ?? [], [albumSettings.query.data]);
  const collections = useMemo(() => collectionsQuery.data?.data ?? [], [collectionsQuery.data]);
  const [draft, setDraft] = useState<AlbumProject | null>(null);
  const [activeSpread, setActiveSpread] = useState(0);
  const activityCollectionId = draft?.collectionId || requestedCollectionId;
  const activity = useCollectionActivity(activityCollectionId);
  const favoriteLists = useMemo(
    () => Array.isArray(activity.data?.data?.favoriteLists) ? activity.data.data.favoriteLists : [],
    [activity.data],
  );
  const contextCollection = collections.find((item) => item._id === requestedCollectionId);
  const contextFavorite = favoriteLists.find((item) => item.id === requestedFavoriteUserId);
  const detail = useCollectionDetail(draft?.collectionId);
  const galleryImages = useMemo(
    () => (detail.collectionQuery.data?.data.images ?? []).filter((image) => image.mediaType !== "video"),
    [detail.collectionQuery.data],
  );
  const createProject = (collectionId = requestedCollectionId, favoriteUserId = requestedFavoriteUserId) => {
    const collection = collections.find((item) => item._id === collectionId) ?? collections[0];
    const favorite = collection?._id === activityCollectionId
      ? favoriteLists.find((item) => item.id === favoriteUserId)
      : undefined;
    const id = `album-${crypto.randomUUID()}`;
    setDraft({
      id,
      name: collection ? `${collection.name} Album` : "Untitled Album",
      collectionId: collection?._id ?? "",
      collectionName: collection?.name ?? "",
      size: "10x10",
      coverStyle: "photo",
      coverTitle: collection?.name ?? "Our Story",
      coverSubtitle: collection?.eventDate ? new Date(collection.eventDate).toLocaleDateString() : "",
      coverImage: collection?.coverImage ?? "",
      sourceFavoriteUserId: favorite?.id,
      sourceFavoriteEmail: favorite?.email,
      spreads: [],
      updatedAt: "Draft",
    });
    setActiveSpread(0);
  };

  const selectProject = (project: AlbumProject) => {
    setDraft({ ...project });
    setActiveSpread(0);
  };
  const chooseCollection = (collectionId: string) => {
    const collection = collections.find((item) => item._id === collectionId);
    setDraft((current) => current ? {
      ...current,
      collectionId,
      collectionName: collection?.name ?? "",
      coverTitle: current.coverTitle || collection?.name || "Our Story",
      coverImage: collection?.coverImage || current.coverImage,
      sourceFavoriteUserId: undefined,
      sourceFavoriteEmail: undefined,
      spreads: [],
    } : current);
    setActiveSpread(0);
  };
  const chooseFavoriteSource = (favoriteUserId: string) => {
    const favorite = favoriteLists.find((item) => item.id === favoriteUserId);
    setDraft((current) => current ? {
      ...current,
      sourceFavoriteUserId: favorite?.id,
      sourceFavoriteEmail: favorite?.email,
      spreads: [],
    } : current);
    setActiveSpread(0);
  };
  const selectedFavorite = favoriteLists.find((item) => item.id === draft?.sourceFavoriteUserId);
  const sourceImages = useMemo(() => {
    if (!selectedFavorite) return galleryImages.map(toAlbumImage);
    const byId = new Map(galleryImages.map((image) => [image._id, image] as const));
    const byName = new Map(galleryImages.filter((image) => image.originalName).map((image) => [image.originalName!.toLowerCase(), image] as const));
    const entries = selectedFavorite.images?.length
      ? selectedFavorite.images
      : selectedFavorite.filenames.map((name) => ({ imageId: "", name, url: "" }));
    return entries.map((entry, index) => {
      const matched = (entry.imageId ? byId.get(entry.imageId) : undefined) ?? byName.get(entry.name.toLowerCase());
      if (matched) return toAlbumImage(matched);
      if (!entry.url) return null;
      return { id: entry.imageId || `favorite-${index}-${entry.name}`, url: entry.url, name: entry.name } satisfies AlbumImage;
    }).filter((image): image is AlbumImage => Boolean(image));
  }, [galleryImages, selectedFavorite]);

  const autoDesign = () => {
    if (!draft) return;
    if (!sourceImages.length) return toast.error(selectedFavorite ? "This client favorite list has no usable photos" : "This gallery has no photos to design with");
    const images = sourceImages.slice(0, 40);
    const pattern: AlbumLayout[] = ["full", "split", "triptych", "grid", "split"];
    const spreads: AlbumSpread[] = [];
    let cursor = 0;
    while (cursor < images.length && spreads.length < 20) {
      const layout = pattern[spreads.length % pattern.length];
      const count = slotsFor(layout);
      spreads.push({ id: `spread-${crypto.randomUUID()}`, layout, images: images.slice(cursor, cursor + count) });
      cursor += count;
    }
    setDraft({ ...draft, spreads, coverImage: draft.coverImage || images[0]?.thumbnailUrl || images[0]?.url });
    setActiveSpread(0);
    toast.success(`${spreads.length} spreads designed automatically`);
  };
  const addSpread = () => {
    setDraft((current) => current ? {
      ...current,
      spreads: [...current.spreads, { id: `spread-${crypto.randomUUID()}`, layout: "split", images: [] }],
    } : current);
    setActiveSpread(draft?.spreads.length ?? 0);
  };

  const updateSpread = (index: number, patch: Partial<AlbumSpread>) => {
    setDraft((current) => current ? {
      ...current,
      spreads: current.spreads.map((spread, spreadIndex) => spreadIndex === index ? { ...spread, ...patch } : spread),
    } : current);
  };

  const addImageToSpread = (image: AlbumImage) => {
    if (!draft) return;
    const spread = draft.spreads[activeSpread];
    if (!spread) return toast.error("Add a spread first");
    if (spread.images.some((item) => item.id === image.id)) return;
    const max = slotsFor(spread.layout);
    if (spread.images.length >= max) return toast.error(`This layout supports ${max} photo${max === 1 ? "" : "s"}`);
    updateSpread(activeSpread, { images: [...spread.images, image] });
  };

  const removeSpread = (index: number) => {
    setDraft((current) => current ? { ...current, spreads: current.spreads.filter((_, i) => i !== index) } : current);
    setActiveSpread((current) => Math.max(0, Math.min(current, (draft?.spreads.length ?? 1) - 2)));
  };
  const saveProject = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error("Album name is required");
    if (!draft.collectionId) return toast.error("Choose a client gallery");
    const next = { ...draft, updatedAt: new Date().toISOString() };
    try {
      await albumSettings.saveSetting.mutateAsync({
        localId: next.id,
        name: next.name,
        collectionId: next.collectionId,
        data: next,
      });
      setDraft(next);
      toast.success("Album design saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Album could not be saved");
    }
  };

  const deleteProject = async () => {
    if (!draft || !projects.some((item) => item.localId === draft.id)) return;
    if (!window.confirm(`Delete "${draft.name}"?`)) return;
    try {
      await albumSettings.deleteSetting.mutateAsync(draft.id);
      setDraft(null);
      setActiveSpread(0);
      toast.success("Album design deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Album could not be deleted");
    }
  };
  const exportPlan = () => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "album"}-layout.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (albumSettings.query.isLoading || collectionsQuery.isLoading) {
    return <div className="grid min-h-[520px] place-items-center"><Loader2 className="size-7 animate-spin text-[#6337d8]" /></div>;
  }

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#6337d8]">Client products</p>
          <h1 className="mt-2 text-3xl font-semibold">Album Designer</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666]">Turn a client gallery into a polished album. Auto-design spreads, refine layouts, and save multiple album projects.</p>
        </div>
        <Button onClick={() => createProject()} className="rounded-none bg-[#6337d8] text-white"><Plus className="size-4" />New album</Button>
      </div>
      <div className="mt-7 flex gap-3 overflow-x-auto pb-2">
        {projects.map((setting) => (
          <button
            key={setting.localId}
            type="button"
            onClick={() => selectProject({ ...setting.data, id: setting.data.id || setting.localId })}
            className={cn("min-w-[210px] border bg-white p-4 text-left transition", draft?.id === setting.localId ? "border-[#6337d8] ring-1 ring-[#6337d8]" : "hover:border-[#aaa]")}
          >
            <p className="truncate font-bold">{setting.name}</p>
            <p className="mt-1 truncate text-xs text-[#777]">{setting.data.collectionName || "No gallery"}</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#999]">{setting.data.spreads?.length ?? 0} spreads · {setting.data.size || "10x10"}</p>
          </button>
        ))}
        {!projects.length && <div className="border border-dashed bg-[#fafafa] px-5 py-4 text-sm text-[#777]">No saved albums yet.</div>}
      </div>

      {!draft ? (
        <div className="mt-10 flex min-h-[460px] flex-col items-center justify-center border border-dashed bg-white px-6 text-center">
          {contextFavorite ? <BookHeart className="size-12 text-[#6337d8]" /> : <BookOpen className="size-12 text-[#6337d8]" />}
          <h2 className="mt-5 text-xl font-bold">{contextFavorite ? "Turn this client selection into an album" : contextCollection ? `Design an album for ${contextCollection.name}` : "Start an album design"}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#666]">{contextFavorite ? `${contextFavorite.email} selected ${contextFavorite.photos} favorite photo${contextFavorite.photos === 1 ? "" : "s"}. Start from exactly that proofing selection, then refine the spreads before production.` : "Start from a delivered client gallery, or jump here directly from a client's Favorite Activity to design from their approved selection."}</p>
          <Button onClick={() => createProject()} disabled={Boolean(requestedFavoriteUserId && activity.isLoading)} className="mt-6 rounded-none bg-[#111] text-white">{requestedFavoriteUserId && activity.isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{contextFavorite ? "Create from client favorites" : "Create album"}</Button>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-7 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="grid gap-5 border bg-white p-5">
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Album name<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="h-11 rounded-none normal-case" /></label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Client gallery
              <select value={draft.collectionId} onChange={(event) => chooseCollection(event.target.value)} className="h-11 border bg-white px-3 text-sm font-normal normal-case">
                <option value="">Choose gallery</option>
                {collections.map((collection) => <option key={collection._id} value={collection._id}>{collection.name}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Photo source
              <select value={draft.sourceFavoriteUserId || ""} onChange={(event) => chooseFavoriteSource(event.target.value)} disabled={activity.isLoading || !draft.collectionId} className="h-11 border bg-white px-3 text-sm font-normal normal-case">
                <option value="">Full gallery</option>
                {favoriteLists.map((favorite) => <option key={favorite.id} value={favorite.id}>{favorite.email} · {favorite.photos} favorites</option>)}
              </select>
              <span className="text-[10px] font-normal normal-case leading-4 text-[#999]">Use client Favorites as the proofing/approval source, or design from the full gallery.</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Size
                <select value={draft.size} onChange={(event) => setDraft({ ...draft, size: event.target.value as AlbumProject["size"] })} className="h-11 border bg-white px-3 text-sm font-normal normal-case"><option>12x12</option><option>10x10</option><option>8x8</option><option>12x8</option></select>
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Cover
                <select value={draft.coverStyle} onChange={(event) => setDraft({ ...draft, coverStyle: event.target.value as AlbumProject["coverStyle"] })} className="h-11 border bg-white px-3 text-sm font-normal normal-case"><option value="photo">Photo</option><option value="minimal">Minimal</option><option value="linen">Linen</option></select>
              </label>
            </div>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Cover title<Input value={draft.coverTitle} onChange={(event) => setDraft({ ...draft, coverTitle: event.target.value })} className="h-11 rounded-none normal-case" /></label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Cover subtitle<Input value={draft.coverSubtitle} onChange={(event) => setDraft({ ...draft, coverSubtitle: event.target.value })} className="h-11 rounded-none normal-case" /></label>
            <Button onClick={autoDesign} disabled={detail.collectionQuery.isLoading || activity.isLoading || !draft.collectionId || !sourceImages.length} className="h-11 rounded-none bg-[#111] text-white"><WandSparkles className="size-4" />{selectedFavorite ? `Design ${selectedFavorite.photos} favorites` : "Auto design gallery"}</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => void saveProject()} disabled={albumSettings.saveSetting.isPending} className="rounded-none"><Save className="size-4" />Save</Button>
              <Button variant="outline" onClick={exportPlan} className="rounded-none"><Download className="size-4" />Export plan</Button>
            </div>
            {projects.some((item) => item.localId === draft.id) && <button type="button" onClick={() => void deleteProject()} className="inline-flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-600"><Trash2 className="size-4" />Delete album</button>}
          </aside>

          <section className="min-w-0">
            <div className="overflow-hidden border bg-[#e8e4dc] p-5 sm:p-8">
              <div className="mx-auto max-w-[920px] bg-white shadow-[0_28px_70px_rgba(0,0,0,.16)]">
                <AlbumCover project={draft} />
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-bold">Album spreads</h2><p className="mt-1 text-sm text-[#777]">Click a spread to edit it. Click gallery photos below to place them.</p></div>
              <Button variant="outline" onClick={addSpread} className="rounded-none"><Plus className="size-4" />Add spread</Button>
            </div>

            <div className="mt-5 grid gap-5">
              {draft.spreads.map((spread, index) => (
                <div key={spread.id} className={cn("border bg-white p-4 transition", activeSpread === index ? "border-[#6337d8] ring-1 ring-[#6337d8]" : "hover:border-[#bbb]")}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={() => setActiveSpread(index)} className="text-left"><span className="text-xs font-bold uppercase tracking-wider text-[#777]">Spread {index + 1}</span><span className="ml-3 text-xs text-[#999]">{spread.images.length}/{slotsFor(spread.layout)} photos</span></button>
                    <div className="flex items-center gap-2">
                      <select value={spread.layout} onChange={(event) => { const layout = event.target.value as AlbumLayout; updateSpread(index, { layout, images: spread.images.slice(0, slotsFor(layout)) }); }} className="h-9 border bg-white px-2 text-xs font-bold">
                        {layouts.map((layout) => <option key={layout.value} value={layout.value}>{layout.label}</option>)}
                      </select>
                      <button type="button" onClick={() => removeSpread(index)} className="grid size-9 place-items-center border text-red-600" aria-label={`Delete spread ${index + 1}`}><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  <button type="button" onClick={() => setActiveSpread(index)} className="block w-full text-left">
                    <SpreadPreview spread={spread} />
                  </button>
                  <Input value={spread.caption || ""} onChange={(event) => updateSpread(index, { caption: event.target.value })} placeholder="Optional spread caption" className="mt-3 h-10 rounded-none" />
                </div>
              ))}
              {!draft.spreads.length && <div className="grid min-h-[260px] place-items-center border border-dashed bg-white text-center"><div><ImageIcon className="mx-auto size-9 text-[#999]" /><p className="mt-3 font-bold">No spreads yet</p><p className="mt-2 text-sm text-[#777]">Use Auto design or add your first spread manually.</p></div></div>}
            </div>
            {draft.spreads[activeSpread]?.images.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {draft.spreads[activeSpread].images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => updateSpread(activeSpread, { images: draft.spreads[activeSpread].images.filter((item) => item.id !== image.id) })}
                    className="inline-flex items-center gap-2 border bg-white px-3 py-2 text-xs font-semibold text-[#555] hover:border-red-300 hover:text-red-600"
                    title="Remove photo from active spread"
                  >
                    <span className="max-w-[150px] truncate">{image.name || "Photo"}</span>
                    <X className="size-3.5" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-8 border bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="font-bold">{selectedFavorite ? `${selectedFavorite.email} · approved favorites` : "Gallery photos"}</h3><p className="mt-1 text-xs leading-5 text-[#777]">{selectedFavorite ? "Only this client's proofed favorites are shown here. Select a spread, then click a favorite to place it." : "Select a spread, then click photos to add them to that layout."}</p></div>
                {draft.spreads.length > 0 && <span className="text-xs font-bold text-[#6337d8]">Editing spread {activeSpread + 1}</span>}
              </div>
              {detail.collectionQuery.isLoading || activity.isLoading ? (
                <div className="grid min-h-40 place-items-center"><Loader2 className="size-5 animate-spin text-[#6337d8]" /></div>
              ) : sourceImages.length ? (
                <div className="mt-4 grid max-h-[430px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-5">
                  {sourceImages.map((image) => {
                    const used = draft.spreads[activeSpread]?.images.some((item) => item.id === image.id) ?? false;
                    return (
                      <button key={image.id} type="button" disabled={!draft.spreads.length} onClick={() => addImageToSpread(image)} className={cn("group relative overflow-hidden border-2 bg-[#eee] disabled:cursor-not-allowed disabled:opacity-45", used ? "border-[#6337d8]" : "border-transparent hover:border-[#aaa]")}>
                        <img src={imageSrc(image.thumbnailUrl || image.url)} alt={image.name || "Album source photo"} className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                        {used && <span className="absolute right-1.5 top-1.5 rounded-full bg-[#6337d8] px-2 py-1 text-[9px] font-bold uppercase text-white">Added</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 border border-dashed p-8 text-center text-sm text-[#777]">{selectedFavorite ? "This favorite list has no usable photos." : "Choose a gallery with photos."}</div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function AlbumCover({ project }: { project: AlbumProject }) {
  const photo = project.coverStyle === "photo" && project.coverImage;
  return (
    <div className={cn("relative aspect-[2/1] overflow-hidden", project.coverStyle === "linen" ? "bg-[#c9bda9]" : "bg-[#f5f1e9]")}>
      {photo && <img src={imageSrc(project.coverImage || "")} alt="Album cover" className="absolute inset-0 h-full w-full object-cover" />}
      {photo && <div className="absolute inset-0 bg-black/25" />}
      <div className={cn("absolute inset-0 flex flex-col items-center justify-center px-10 text-center", photo ? "text-white" : "text-[#2c2925]")}>
        <p className="max-w-[80%] text-2xl font-semibold tracking-[.08em] sm:text-4xl">{project.coverTitle || "Our Story"}</p>
        {project.coverSubtitle && <p className="mt-4 text-xs font-semibold uppercase tracking-[.25em] opacity-80 sm:text-sm">{project.coverSubtitle}</p>}
        <span className="mt-7 h-px w-14 bg-current opacity-60" />
      </div>
      <span className="absolute bottom-3 right-4 text-[9px] font-bold uppercase tracking-[.18em] opacity-60">{project.size}</span>
    </div>
  );
}

function SpreadPreview({ spread }: { spread: AlbumSpread }) {
  const slotCount = slotsFor(spread.layout);
  const slots = Array.from({ length: slotCount }, (_, index) => spread.images[index]);
  return (
    <div className={cn("grid aspect-[2/1] gap-1 bg-[#e8e4dc] p-1", spread.layout === "full" && "grid-cols-1", spread.layout === "split" && "grid-cols-2", spread.layout === "triptych" && "grid-cols-3", spread.layout === "grid" && "grid-cols-2 grid-rows-2")}>
      {slots.map((image, index) => <AlbumPhoto key={image?.id || `slot-${index}`} image={image} />)}
    </div>
  );
}
function AlbumPhoto({ image }: { image?: AlbumImage }) {
  return image ? (
    <div className="min-h-0 overflow-hidden bg-[#ddd]">
      <img src={imageSrc(image.thumbnailUrl || image.url)} alt={image.name || "Album photo"} className="h-full w-full object-cover" />
    </div>
  ) : (
    <div className="grid min-h-0 place-items-center bg-white text-[#bbb]"><ImageIcon className="size-6" /></div>
  );
}

function imageSrc(value: string) {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return value.startsWith("/") ? `${base}${value}` : value;
}

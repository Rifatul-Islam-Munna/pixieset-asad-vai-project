"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Database,
  Grid2X2,
  Heart,
  Images,
  LayoutList,
  Loader2,
  LogOut,
  PanelTop,
  Search,
  Settings,
  Star,
} from "lucide-react";
import { logOutUser } from "@/actions/auth";
import { useCollections, type CollectionRecord } from "@/api-hooks/use-collections";
import { cn } from "@/lib/utils";

type EventFilter = "all" | "upcoming" | "past" | "none";
type ExpiryFilter = "all" | "active" | "expired" | "none";
type StarFilter = "all" | "starred" | "not-starred";
type SortValue = "newest" | "oldest" | "name-asc" | "name-desc";

const sidebar = [
  ["Collections", Images, "/dashboard/client-gallery"],
  ["Library", Grid2X2, "/dashboard/client-gallery/library"],
  ["Favorite", Heart, "/dashboard/client-gallery/favorites"],
  ["Starred", Star, "/dashboard/client-gallery/starred"],
  ["Homepage", PanelTop, "/dashboard/client-gallery/homepage"],
  ["Settings", Settings, "/dashboard/client-gallery/settings"],
] as const;

export function ClientGalleryCollectionsPage() {
  const router = useRouter();
  const { collectionsQuery } = useCollections();
  const collections = collectionsQuery.data?.data ?? [];
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [starFilter, setStarFilter] = useState<StarFilter>("all");
  const [sort, setSort] = useState<SortValue>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [logoutPending, startLogout] = useTransition();

  const statuses = useMemo(
    () => [...new Set(collections.map((item) => item.status).filter(Boolean) as string[])].sort(),
    [collections],
  );
  const tags = useMemo(
    () => [...new Set(collections.flatMap((item) => item.tags ?? []))].sort(),
    [collections],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const result = collections.filter((collection) => {
      const text = [collection.name, collection.status, ...(collection.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (query && !text.includes(query)) return false;
      if (status !== "all" && collection.status !== status) return false;
      if (tag !== "all" && !(collection.tags ?? []).includes(tag)) return false;

      const eventDate = collection.eventDate ? new Date(collection.eventDate) : null;
      if (eventFilter === "none" && eventDate) return false;
      if (eventFilter === "upcoming" && (!eventDate || eventDate < startOfToday(now))) return false;
      if (eventFilter === "past" && (!eventDate || eventDate >= startOfToday(now))) return false;

      const expiresAt = collection.expiresAt ? new Date(collection.expiresAt) : null;
      if (expiryFilter === "none" && expiresAt) return false;
      if (expiryFilter === "active" && (!expiresAt || expiresAt < now)) return false;
      if (expiryFilter === "expired" && (!expiresAt || expiresAt >= now)) return false;

      const starred = collection.status === "starred" || collection.settings?.starred === true;
      if (starFilter === "starred" && !starred) return false;
      if (starFilter === "not-starred" && starred) return false;
      return true;
    });

    return result.sort((left, right) => {
      if (sort === "name-asc") return left.name.localeCompare(right.name);
      if (sort === "name-desc") return right.name.localeCompare(left.name);
      const leftDate = new Date(left.createdAt ?? left.eventDate ?? 0).getTime();
      const rightDate = new Date(right.createdAt ?? right.eventDate ?? 0).getTime();
      return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
    });
  }, [collections, eventFilter, expiryFilter, search, sort, starFilter, status, tag]);

  const hasFilters = Boolean(
    search || status !== "all" || tag !== "all" || eventFilter !== "all" ||
    expiryFilter !== "all" || starFilter !== "all" || sort !== "newest",
  );

  const clear = () => {
    setSearch("");
    setStatus("all");
    setTag("all");
    setEventFilter("all");
    setExpiryFilter("all");
    setStarFilter("all");
    setSort("newest");
  };

  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <aside className="fixed inset-y-0 left-0 hidden w-[292px] flex-col border-r bg-white md:flex">
        <div className="flex h-[62px] items-center gap-3 border-b px-5 text-sm font-semibold">
          <span className="size-5 rounded-full bg-[#0dc6b5]" />
          Client Gallery
          <ChevronDown className="size-3 text-[#777]" />
        </div>
        <nav className="flex flex-1 flex-col px-5 py-8">
          <div className="grid gap-7">
            {sidebar.map(([label, Icon, href]) => (
              <Link key={label} href={href} className={cn("flex items-center gap-4 text-base", label === "Collections" && "font-semibold text-[#00a997]") }>
                <Icon className={cn("size-5", label === "Collections" && "text-[#00a997]")} />
                {label}
              </Link>
            ))}
          </div>
          <Link href="/dashboard/client-gallery/storage" className="mt-auto flex items-center gap-3 bg-[#f3faf6] p-4 text-sm font-medium text-[#00a997]">
            <Database className="size-5" /> Storage
          </Link>
          <button
            className="mt-5 flex items-center gap-3 text-sm font-semibold text-[#555] disabled:opacity-50"
            disabled={logoutPending}
            onClick={() => startLogout(async () => {
              await logOutUser();
              router.push("/login");
            })}
          >
            <LogOut className="size-5" /> Logout
          </button>
        </nav>
      </aside>

      <section className="min-h-screen px-4 py-10 md:pl-[332px] md:pr-10 md:py-20">
        <div className="mx-auto max-w-[1500px]">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-7">
              <h1 className="text-[28px] font-medium">Collections</h1>
              <label className="flex h-10 min-w-[260px] items-center gap-3 border-b text-[#777]">
                <Search className="size-5" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search collections"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/dashboard/client-gallery/settings/presets" className="text-sm font-semibold">View Presets</Link>
              <Link href="/dashboard/client-gallery/collection-new" className="inline-flex h-10 items-center bg-[#22bda7] px-7 text-sm font-bold text-white">New Collection</Link>
            </div>
          </header>

          <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <Filter value={status} onChange={setStatus} label="Status" options={statuses.map((value) => [value, titleCase(value)])} />
              <Filter value={tag} onChange={setTag} label="Category Tag" options={tags.map((value) => [value, value])} />
              <Filter value={eventFilter} onChange={(value) => setEventFilter(value as EventFilter)} label="Event Date" options={[["upcoming", "Upcoming"], ["past", "Past"], ["none", "No event date"]]} />
              <Filter value={expiryFilter} onChange={(value) => setExpiryFilter(value as ExpiryFilter)} label="Expiry Date" options={[["active", "Not expired"], ["expired", "Expired"], ["none", "No expiry"]]} />
              <Filter value={starFilter} onChange={(value) => setStarFilter(value as StarFilter)} label="Starred" options={[["starred", "Starred only"], ["not-starred", "Not starred"]]} />
              <Filter value={sort} onChange={(value) => setSort(value as SortValue)} label="Sort" options={[["newest", "Newest"], ["oldest", "Oldest"], ["name-asc", "Name A-Z"], ["name-desc", "Name Z-A"]]} hideAll />
              {hasFilters && <button className="h-9 px-3 text-xs font-semibold text-[#00a997]" onClick={clear}>Clear filters</button>}
            </div>
            <div className="flex items-center gap-2">
              <button className={cn("flex size-9 items-center justify-center border", view === "grid" && "bg-[#222] text-white")} onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 className="size-4" /></button>
              <button className={cn("flex size-9 items-center justify-center border", view === "list" && "bg-[#222] text-white")} onClick={() => setView("list")} aria-label="List view"><LayoutList className="size-4" /></button>
            </div>
          </div>

          <p className="mt-6 text-xs text-[#777]">Showing {filtered.length} of {collections.length} collections</p>

          {collectionsQuery.isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="size-7 animate-spin" /></div>
          ) : !filtered.length ? (
            <div className="mt-8 flex min-h-[360px] flex-col items-center justify-center border bg-[#fafafa] text-center">
              <Images className="size-10 text-[#aaa]" />
              <p className="mt-4 font-semibold">No matching collections</p>
              <button className="mt-4 text-sm font-semibold text-[#00a997]" onClick={clear}>Show all collections</button>
            </div>
          ) : view === "grid" ? (
            <div className="mt-8 grid gap-x-7 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((collection) => <CollectionCard key={collection._id} collection={collection} />)}
            </div>
          ) : (
            <div className="mt-8 divide-y border">
              {filtered.map((collection) => <CollectionRow key={collection._id} collection={collection} />)}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Filter({ value, onChange, label, options, hideAll = false }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Array<[string, string]>;
  hideAll?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-full border-0 bg-[#f5f5f5] px-4 text-xs font-medium outline-none"
      aria-label={label}
    >
      {!hideAll && <option value="all">{label}: All</option>}
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>{label}: {optionLabel}</option>
      ))}
    </select>
  );
}

function CollectionCard({ collection }: { collection: CollectionRecord }) {
  return (
    <article className="group">
      <Link href={`/dashboard/client-gallery/collections/${collection._id}`} className="block overflow-hidden bg-[#f2f2f2]">
        {collection.coverImage ? (
          <img src={imageSrc(collection.coverImage)} alt="" className="aspect-[1.33] w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex aspect-[1.33] items-center justify-center"><Images className="size-10 text-[#ccc]" /></span>
        )}
      </Link>
      <div className="pt-3">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/dashboard/client-gallery/collections/${collection._id}`} className="min-w-0 flex-1 truncate font-semibold">{collection.name}</Link>
          <a href={publicPath(collection)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#00a997] opacity-0 group-hover:opacity-100">Preview</a>
        </div>
        <CollectionMeta collection={collection} />
      </div>
    </article>
  );
}

function CollectionRow({ collection }: { collection: CollectionRecord }) {
  return (
    <article className="grid items-center gap-4 p-4 sm:grid-cols-[110px_1fr_auto]">
      <Link href={`/dashboard/client-gallery/collections/${collection._id}`} className="overflow-hidden bg-[#eee]">
        {collection.coverImage ? <img src={imageSrc(collection.coverImage)} alt="" className="aspect-[1.4] w-full object-cover" /> : <span className="flex aspect-[1.4] items-center justify-center"><Images className="size-7 text-[#bbb]" /></span>}
      </Link>
      <div className="min-w-0"><Link href={`/dashboard/client-gallery/collections/${collection._id}`} className="font-semibold">{collection.name}</Link><CollectionMeta collection={collection} /></div>
      <a href={publicPath(collection)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#00a997]">Preview</a>
    </article>
  );
}

function CollectionMeta({ collection }: { collection: CollectionRecord }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#777]">
      <span className="size-2 rounded-full bg-[#22bda7]" />
      <span>{collection.imageCount ?? 0} items</span>
      {collection.status && <><span>•</span><span>{titleCase(collection.status)}</span></>}
      {collection.eventDate && <><span>•</span><span>{new Date(collection.eventDate).toLocaleDateString()}</span></>}
    </p>
  );
}

function publicPath(collection: CollectionRecord) {
  return `/collection/${encodeURIComponent(collection.name)}/${encodeURIComponent(collection.slug ?? collection._id)}`;
}

function imageSrc(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return url.startsWith("/") ? `${base}${url}` : url;
}

function titleCase(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

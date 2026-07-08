"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Grid2X2,
  Images,
  LayoutList,
  Loader2,
  PanelTop,
  Search,
  Settings,
  Star,
} from "lucide-react";
import { useCollections, type CollectionRecord } from "@/api-hooks/use-collections";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

const navigation = [
  ["Collections", Images, "/dashboard/client-gallery"],
  ["Library", Grid2X2, "/dashboard/client-gallery/library"],
  ["Starred", Star, "/dashboard/client-gallery/starred"],
  ["Homepage", PanelTop, "/dashboard/client-gallery/homepage"],
  ["Settings", Settings, "/dashboard/client-gallery/settings"],
] as const;

export function ClientGalleryCollectionsPage() {
  const { collectionsQuery } = useCollections();
  const collections = collectionsQuery.data?.data ?? [];
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [eventDate, setEventDate] = useState("all");
  const [expiryDate, setExpiryDate] = useState("all");
  const [starred, setStarred] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<ViewMode>("grid");

  const statuses = useMemo(
    () => [...new Set(collections.map((item) => item.status).filter((value): value is string => Boolean(value)))].sort(),
    [collections],
  );
  const tags = useMemo(
    () => [...new Set(collections.flatMap((item) => item.tags ?? []))].sort(),
    [collections],
  );

  const visibleCollections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const matches = collections.filter((collection) => {
      const searchable = [collection.name, collection.status, ...(collection.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (status !== "all" && collection.status !== status) return false;
      if (tag !== "all" && !(collection.tags ?? []).includes(tag)) return false;

      const event = collection.eventDate ? new Date(collection.eventDate) : null;
      if (eventDate === "upcoming" && (!event || event < today)) return false;
      if (eventDate === "past" && (!event || event >= today)) return false;
      if (eventDate === "none" && event) return false;

      const expiry = collection.expiresAt ? new Date(collection.expiresAt) : null;
      if (expiryDate === "active" && (!expiry || expiry < now)) return false;
      if (expiryDate === "expired" && (!expiry || expiry >= now)) return false;
      if (expiryDate === "none" && expiry) return false;

      const isStarred = collection.status === "starred" || collection.settings?.starred === true;
      if (starred === "yes" && !isStarred) return false;
      if (starred === "no" && isStarred) return false;
      return true;
    });

    return [...matches].sort((left, right) => {
      if (sort === "name-asc") return left.name.localeCompare(right.name);
      if (sort === "name-desc") return right.name.localeCompare(left.name);
      const leftTime = new Date(left.createdAt ?? left.eventDate ?? 0).getTime();
      const rightTime = new Date(right.createdAt ?? right.eventDate ?? 0).getTime();
      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [collections, eventDate, expiryDate, search, sort, starred, status, tag]);

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setTag("all");
    setEventDate("all");
    setExpiryDate("all");
    setStarred("all");
    setSort("newest");
  };
  const filtersActive = Boolean(
    search || status !== "all" || tag !== "all" || eventDate !== "all" ||
      expiryDate !== "all" || starred !== "all" || sort !== "newest",
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-[#171717]">
      <aside className="fixed inset-y-0 left-0 hidden w-[292px] flex-col border-r bg-white md:flex">
        <div className="flex h-[62px] items-center gap-3 border-b px-5 text-sm font-semibold">
          <span className="size-5 rounded-full bg-[#0dc6b5]" /> Client Gallery
        </div>
        <nav className="grid gap-7 px-5 py-8">
          {navigation.map(([label, Icon, href]) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex items-center gap-4 text-base",
                label === "Collections" && "font-semibold text-[#00a997]",
              )}
            >
              <Icon className="size-5" /> {label}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="min-h-screen px-3 py-8 sm:px-4 sm:py-10 md:pl-[332px] md:pr-10 md:py-20">
        <div className="mx-auto max-w-[1500px]">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-wrap items-center gap-4 sm:gap-7 lg:w-auto">
              <h1 className="text-[28px] font-medium">Collections</h1>
              <label className="flex h-10 w-full min-w-0 items-center gap-3 border-b text-[#777] sm:min-w-[260px] sm:w-auto">
                <Search className="size-5" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search collections"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:gap-5 lg:w-auto">
              <Link href="/dashboard/client-gallery/settings/presets" className="text-sm font-semibold">View Presets</Link>
              <Link href="/dashboard/client-gallery/collection-new" className="inline-flex h-10 items-center bg-[#22bda7] px-5 text-sm font-bold text-white sm:px-7">New Collection</Link>
            </div>
          </header>

          <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
              <Filter value={status} onChange={setStatus} label="Status">
                <option value="all">Status: All</option>
                {statuses.map((value) => <option key={value} value={value}>Status: {titleCase(value)}</option>)}
              </Filter>
              <Filter value={tag} onChange={setTag} label="Category Tag">
                <option value="all">Category Tag: All</option>
                {tags.map((value) => <option key={value} value={value}>Category Tag: {value}</option>)}
              </Filter>
              <Filter value={eventDate} onChange={setEventDate} label="Event Date">
                <option value="all">Event Date: All</option>
                <option value="upcoming">Event Date: Upcoming</option>
                <option value="past">Event Date: Past</option>
                <option value="none">Event Date: None</option>
              </Filter>
              <Filter value={expiryDate} onChange={setExpiryDate} label="Expiry Date">
                <option value="all">Expiry Date: All</option>
                <option value="active">Expiry Date: Not expired</option>
                <option value="expired">Expiry Date: Expired</option>
                <option value="none">Expiry Date: None</option>
              </Filter>
              <Filter value={starred} onChange={setStarred} label="Starred">
                <option value="all">Starred: All</option>
                <option value="yes">Starred: Yes</option>
                <option value="no">Starred: No</option>
              </Filter>
              <Filter value={sort} onChange={setSort} label="Sort">
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="name-asc">Sort: Name A-Z</option>
                <option value="name-desc">Sort: Name Z-A</option>
              </Filter>
              {filtersActive && <button className="h-9 shrink-0 px-3 text-xs font-semibold text-[#00a997]" onClick={clearFilters}>Clear filters</button>}
            </div>
            <div className="flex items-center gap-2">
              <button className={cn("flex size-9 items-center justify-center border", view === "grid" && "bg-[#222] text-white")} onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 className="size-4" /></button>
              <button className={cn("flex size-9 items-center justify-center border", view === "list" && "bg-[#222] text-white")} onClick={() => setView("list")} aria-label="List view"><LayoutList className="size-4" /></button>
            </div>
          </div>

          <p className="mt-6 text-xs text-[#777]">Showing {visibleCollections.length} of {collections.length} collections</p>

          {collectionsQuery.isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="size-7 animate-spin" /></div>
          ) : visibleCollections.length === 0 ? (
            <div className="mt-8 flex min-h-[360px] flex-col items-center justify-center border bg-[#fafafa] text-center">
              <Images className="size-10 text-[#aaa]" />
              <p className="mt-4 font-semibold">No matching collections</p>
              <button className="mt-4 text-sm font-semibold text-[#00a997]" onClick={clearFilters}>Show all collections</button>
            </div>
          ) : view === "grid" ? (
            <div className="mt-8 grid gap-x-7 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleCollections.map((collection) => <CollectionCard key={collection._id} collection={collection} />)}
            </div>
          ) : (
            <div className="mt-8 divide-y border">
              {visibleCollections.map((collection) => <CollectionRow key={collection._id} collection={collection} />)}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Filter({ value, onChange, label, children }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 shrink-0 rounded-full border-0 bg-[#f5f5f5] px-4 text-xs font-medium outline-none"
      aria-label={label}
    >
      {children}
    </select>
  );
}

function CollectionCard({ collection }: { collection: CollectionRecord }) {
  return (
    <article className="group">
      <Link href={`/dashboard/client-gallery/collections/${collection._id}`} className="block overflow-hidden bg-[#f2f2f2]">
        {collection.coverImage ? <img src={imageSrc(collection.coverImage)} alt="" className="aspect-[1.33] w-full object-cover transition duration-300 group-hover:scale-105" /> : <span className="flex aspect-[1.33] items-center justify-center"><Images className="size-10 text-[#ccc]" /></span>}
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

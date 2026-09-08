"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import type { ClientBlogPost } from "@/lib/client-blog";
import { publicHomepageBlogPath } from "@/lib/public-site-url";
import {
  Globe2,
  CalendarDays,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Newspaper,
  Search,
  Phone,
} from "lucide-react";

export type PublicHomepageCollection = {
  _id: string;
  name: string;
  slug: string;
  eventDate?: string;
  coverImage?: string;
  imageCount?: number;
  tags?: string[];
  featured?: boolean;
  url: string;
};

export type PublicHomepageData = {
  slug: string;
  brandName: string;
  logoUrl?: string;
  biography?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  socialLinks?: Record<string, string>;
  booking?: { enabled?: boolean; url?: string };
  integrations?: {
    googleAnalytics?: {
      enabled?: boolean;
      measurementId?: string;
    };
  };
  hasPassword?: boolean;
  showCategories?: boolean;
  locked: boolean;
  collections: PublicHomepageCollection[];
  blogPosts?: ClientBlogPost[];
};

export function PublicHomepage({ initialData }: { initialData: PublicHomepageData }) {
  const [data, setData] = useState(initialData);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = useMemo(
    () => [...new Set(data.collections.flatMap((collection) => collection.tags ?? []).map((tag) => tag.trim()).filter(Boolean))].sort(),
    [data.collections],
  );
  const collections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.collections.filter((collection) => {
      const tags = collection.tags ?? [];
      const matchesCategory = activeCategory === "All" || tags.includes(activeCategory);
      const haystack = [collection.name, ...tags].join(" ").toLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [activeCategory, data.collections, search]);
  const featuredCollections = collections.filter((collection) => collection.featured);
  const regularCollections = featuredCollections.length ? collections.filter((collection) => !collection.featured) : collections;

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setUnlocking(true);
    setError("");
    try {
      const response = await fetch(`/api/public/homepages/${encodeURIComponent(data.slug)}?password=${encodeURIComponent(password)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.data?.locked) throw new Error("Incorrect homepage password");
      setData(payload.data);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not unlock homepage");
    } finally {
      setUnlocking(false);
    }
  };

  if (data.locked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7F4] p-5 text-[#151515]">
        <form onSubmit={unlock} className="w-full max-w-md border border-[#E8E5E1] bg-white p-8 text-center shadow-[0_24px_80px_rgba(21,21,21,0.08)] sm:p-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#111] text-white"><LockKeyhole className="size-6" /></div>
          {data.logoUrl && <img src={data.logoUrl} alt="" className="mx-auto mt-6 h-12 max-w-32 object-contain" />}
          <h1 className="mt-6 text-2xl font-semibold uppercase tracking-[0.1em]">{data.brandName}</h1>
          <p className="mt-3 text-sm text-[#666]">Enter the password to view this photographer homepage.</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Homepage password"
            className="mt-8 h-12 w-full border px-4 text-sm outline-none focus:border-[#18b89f]"
            autoFocus
          />
          {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
          <button type="submit" disabled={unlocking || !password} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 bg-[#111] text-sm font-bold text-white disabled:opacity-50">
            {unlocking && <Loader2 className="size-4 animate-spin" />}View Homepage
          </button>
        </form>
      </main>
    );
  }

  const socialItems = [
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["youtube", "YouTube"],
    ["linkedin", "LinkedIn"],
  ] as const;

  return (
    <main className="min-h-screen bg-[#F8F7F4] text-[#151515]">
      <header className="mx-auto max-w-[1380px] px-5 pb-10 pt-8 sm:px-10 sm:pt-12">
        <div className="flex justify-end">
          <label className="flex items-center gap-2 border-b border-transparent pb-2 focus-within:border-[#111]">
            <Search className="size-5 text-[#555]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search collections" className="w-0 bg-transparent text-sm outline-none transition-all focus:w-44" />
          </label>
        </div>

        <div className="mx-auto mt-8 max-w-3xl text-center sm:mt-12">
          {data.logoUrl && <img src={data.logoUrl} alt="" className="mx-auto h-16 max-w-40 object-contain" />}
          <h1 className="mt-7 text-2xl font-bold uppercase tracking-[0.12em] sm:text-[30px]">{data.brandName}</h1>
          {data.biography && <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#666]">{data.biography}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[#333]">
            {data.website && <a href={normalizeUrl(data.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline"><Globe2 className="size-4" />{stripProtocol(data.website)}</a>}
            {data.email && <a href={`mailto:${data.email}`} className="inline-flex items-center gap-2 hover:underline"><Mail className="size-4" />{data.email}</a>}
            {data.phone && <a href={`tel:${data.phone}`} className="inline-flex items-center gap-2 hover:underline"><Phone className="size-4" />{data.phone}</a>}
            {data.address && <span className="inline-flex items-center gap-2"><MapPin className="size-4" />{data.address}</span>}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {socialItems.map(([key, label]) => {
              const href = data.socialLinks?.[key];
              if (!href) return null;
              return (
                <a
                  key={key}
                  href={normalizeUrl(href)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-[#ddd] text-[#333] transition hover:border-black hover:bg-black hover:text-white"
                  title={label}
                >
                  <SocialIcon network={key} />
                </a>
              );
            })}
          </div>
          {(data.booking?.enabled && data.booking.url || (data.blogPosts?.length ?? 0) > 0) && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {data.booking?.enabled && data.booking.url && (
                <Link href={data.booking.url} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111] px-6 text-sm font-bold text-white transition hover:bg-[#6337d8]">
                  <CalendarDays className="size-4" /> Book a Session
                </Link>
              )}
              {(data.blogPosts?.length ?? 0) > 0 && (
                <Link href={publicHomepageBlogPath(data.slug)} className="inline-flex h-11 items-center gap-2 rounded-full border border-[#cfcac4] bg-white px-6 text-sm font-bold transition hover:border-[#111]">
                  <Newspaper className="size-4" /> Journal
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-[1380px] px-5 pb-20 sm:px-10">
        {data.showCategories !== false && categories.length > 0 && (
          <div className="mb-12 flex flex-wrap items-center justify-center gap-2 border-y border-[#e8e5e1] py-5">
            {["All", ...categories].map((category) => (
              <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-[.12em] transition ${activeCategory === category ? "border-[#111] bg-[#111] text-white" : "border-[#ddd] bg-white text-[#555] hover:border-[#999]"}`}>{category}</button>
            ))}
          </div>
        )}

        {featuredCollections.length > 0 && (
          <div className="mb-16">
            <div className="mb-7 text-center"><p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#8a8178]">Selected work</p><h2 className="mt-2 text-2xl font-semibold">Featured Galleries</h2></div>
            <div className="grid gap-x-8 gap-y-12 md:grid-cols-2">
              {featuredCollections.map((collection) => <GalleryCard key={collection._id} collection={collection} featured />)}
            </div>
          </div>
        )}

        {regularCollections.length ? (
          <div>
            {featuredCollections.length > 0 && <h2 className="mb-7 border-b pb-4 text-lg font-semibold">All Galleries</h2>}
            <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {regularCollections.map((collection) => <GalleryCard key={collection._id} collection={collection} />)}
            </div>
          </div>
        ) : !featuredCollections.length ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center border-t text-center">
            <p className="text-lg font-semibold">No galleries found</p>
            <p className="mt-3 text-sm text-[#777]">Try another search or category.</p>
          </div>
        ) : null}
      </section>

      {(data.blogPosts?.length ?? 0) > 0 && (
        <section className="border-t border-[#e8e5e1] bg-[#f8f7f4] px-5 py-16 sm:px-10 sm:py-20">
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#8a8178]">Journal</p><h2 className="mt-2 text-3xl font-semibold">Latest Stories</h2></div><Link href={publicHomepageBlogPath(data.slug)} className="text-sm font-bold underline underline-offset-4">View all stories</Link></div>
            <div className="mt-8 grid gap-7 md:grid-cols-3">
              {data.blogPosts!.slice(0, 3).map((post) => (
                <Link key={post.id} href={publicHomepageBlogPath(data.slug, post.slug)} className="group block bg-white">
                  <div className="aspect-[16/10] overflow-hidden bg-[#e8e5e1]">{post.coverImage ? <img src={imageSrc(post.coverImage)} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : null}</div>
                  <div className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8a8178]">{post.category} · {post.language}</p><h3 className="mt-3 text-xl font-semibold leading-tight">{post.title}</h3><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#666]">{post.excerpt}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function GalleryCard({ collection, featured = false }: { collection: PublicHomepageCollection; featured?: boolean }) {
  return (
    <Link href={collection.url} className="group block text-center">
      <div className="relative overflow-hidden bg-[#F3F0EA] shadow-[0_18px_48px_rgba(21,21,21,0.06)]">
        {collection.coverImage ? (
          <img src={imageSrc(collection.coverImage)} alt={collection.name} className={`${featured ? "aspect-[1.7]" : "aspect-[1.5]"} w-full object-cover transition duration-500 group-hover:scale-[1.03]`} />
        ) : (
          <div className={`${featured ? "aspect-[1.7]" : "aspect-[1.5]"} flex items-center justify-center text-sm text-[#999]`}>No cover image</div>
        )}
        {featured && <span className="absolute left-4 top-4 bg-white/95 px-3 py-2 text-[9px] font-bold uppercase tracking-[.2em]">Featured</span>}
      </div>
      <h2 className={`mx-auto mt-5 max-w-[92%] font-semibold uppercase leading-6 tracking-[0.08em] ${featured ? "text-[18px]" : "text-[16px]"}`}>{collection.name}</h2>
      {collection.tags?.length ? <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#998f84]">{collection.tags.slice(0, 3).join(" · ")}</p> : null}
      {collection.eventDate && <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-[#777]">{formatDate(collection.eventDate)}</p>}
    </Link>
  );
}

function normalizeUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function stripProtocol(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function SocialIcon({ network }: { network: "instagram" | "facebook" | "youtube" | "linkedin" }) {
  const icons: Record<typeof network, ReactNode> = {
    instagram: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
        <path d="M14 8.5V7c0-.8.2-1.2 1.2-1.2H17V3h-2.7C11.6 3 10 4.7 10 7.2v1.3H8v3h2V21h4v-9.5h2.7l.3-3H14Z" />
      </svg>
    ),
    youtube: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
        <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.2V8.8l5.5 3.2-5.5 3.2Z" />
      </svg>
    ),
    linkedin: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
        <path d="M6.7 8.8H3.4V21h3.3V8.8ZM5.1 3a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8ZM21 14.1c0-3.3-1.8-5.4-4.5-5.4a3.9 3.9 0 0 0-3.3 1.8V8.8H10V21h3.3v-6.1c0-1.8.9-3.1 2.3-3.1s2.1 1 2.1 3V21H21v-6.9Z" />
      </svg>
    ),
  };

  return icons[network];
}

function imageSrc(value: string) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return value.startsWith("/") ? `${base}${value}` : value;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

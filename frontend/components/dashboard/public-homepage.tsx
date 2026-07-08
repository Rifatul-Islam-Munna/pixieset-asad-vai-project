"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  Facebook,
  Globe2,
  Instagram,
  Linkedin,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Search,
  Phone,
  Youtube,
} from "lucide-react";

export type PublicHomepageCollection = {
  _id: string;
  name: string;
  slug: string;
  eventDate?: string;
  coverImage?: string;
  imageCount?: number;
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
  hasPassword?: boolean;
  locked: boolean;
  collections: PublicHomepageCollection[];
};

export function PublicHomepage({ initialData }: { initialData: PublicHomepageData }) {
  const [data, setData] = useState(initialData);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const collections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.collections;
    return data.collections.filter((collection) => collection.name.toLowerCase().includes(query));
  }, [data.collections, search]);

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
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] p-5 text-[#111]">
        <form onSubmit={unlock} className="w-full max-w-md bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.1)] sm:p-10">
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
    ["instagram", Instagram],
    ["facebook", Facebook],
    ["youtube", Youtube],
    ["linkedin", Linkedin],
  ] as const;

  return (
    <main className="min-h-screen bg-white text-[#111]">
      <header className="mx-auto max-w-[1380px] px-5 pb-10 pt-8 sm:px-10 sm:pt-12">
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-h-10 items-center gap-3">
            {socialItems.map(([key, Icon]) => {
              const href = data.socialLinks?.[key];
              if (!href) return null;
              return <a key={key} href={href} target="_blank" rel="noreferrer" aria-label={key} className="text-[#555] transition hover:text-black"><Icon className="size-4" /></a>;
            })}
          </div>
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
        </div>
      </header>

      <section className="mx-auto max-w-[1380px] px-5 pb-20 sm:px-10">
        {collections.length ? (
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <Link key={collection._id} href={collection.url} className="group block text-center">
                <div className="overflow-hidden bg-[#f1f1f1]">
                  {collection.coverImage ? (
                    <img src={imageSrc(collection.coverImage)} alt={collection.name} className="aspect-[1.5] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex aspect-[1.5] items-center justify-center text-sm text-[#999]">No cover image</div>
                  )}
                </div>
                <h2 className="mx-auto mt-5 max-w-[92%] text-[16px] font-semibold uppercase leading-6 tracking-[0.08em]">{collection.name}</h2>
                {collection.eventDate && <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-[#777]">{formatDate(collection.eventDate)}</p>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center border-t text-center">
            <p className="text-lg font-semibold">No published collections yet</p>
            <p className="mt-3 text-sm text-[#777]">Published collections will appear here automatically.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function normalizeUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function stripProtocol(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
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

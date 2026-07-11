"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  Globe2,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
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
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["youtube", "YouTube"],
    ["linkedin", "LinkedIn"],
  ] as const;

  return (
    <main className="min-h-screen bg-white text-[#111]">
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

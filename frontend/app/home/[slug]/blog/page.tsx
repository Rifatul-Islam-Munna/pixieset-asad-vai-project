import Link from "next/link";
import { ArrowLeft, CalendarDays, Search } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { PublicHomepageData } from "@/components/dashboard/public-homepage";
import { publicHomepageBlogPath, publicHomepagePath } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

export default async function ClientBlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; category?: string; language?: string }>;
}) {
  const { slug } = await params;
  const filters = await searchParams;
  await enforceClientBlogHost(slug, filters);
  const data = await loadHomepage(slug);
  if (data.locked) redirect(publicHomepagePath(slug));
  const posts = data.blogPosts ?? [];
  const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))].sort();
  const languages = [...new Set(posts.map((post) => post.language).filter(Boolean))].sort();
  const category = filters.category || "All";
  const language = filters.language || "All";
  const query = String(filters.q || "").trim().toLowerCase();
  const visible = posts.filter((post) => {
    const haystack = `${post.title} ${post.excerpt} ${post.category}`.toLowerCase();
    return (category === "All" || post.category === category) && (language === "All" || post.language === language) && (!query || haystack.includes(query));
  });
  return (
    <main className="min-h-screen bg-[#f8f7f4] text-[#171717]">
      <header className="border-b bg-white px-5 py-7 sm:px-10">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
          <Link href={publicHomepagePath(slug)} className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft className="size-4" />Back to galleries</Link>
          <p className="text-sm font-bold uppercase tracking-[.12em]">{data.brandName}</p>
        </div>
      </header>
      <section className="border-b bg-white px-5 py-16 text-center sm:py-20">
        <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#8a8178]">Journal</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Stories & Notes</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#666]">Sessions, advice, inspiration, and updates from {data.brandName}.</p>
      </section>
      <section className="mx-auto max-w-[1180px] px-5 py-10">
        <form className="grid gap-3 border bg-white p-4 md:grid-cols-[1fr_190px_190px_auto]">
          <label className="flex h-11 items-center gap-2 border px-3"><Search className="size-4 text-[#777]" /><input name="q" defaultValue={filters.q || ""} placeholder="Search stories" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <select name="category" defaultValue={category} className="h-11 border bg-white px-3 text-sm"><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select name="language" defaultValue={language} className="h-11 border bg-white px-3 text-sm"><option>All</option>{languages.map((item) => <option key={item}>{item}</option>)}</select>
          <button className="h-11 bg-[#111] px-6 text-sm font-bold text-white">Filter</button>
        </form>
        <div className="mt-8 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((post) => (
            <Link key={post.id} href={publicHomepageBlogPath(slug, post.slug)} className="group overflow-hidden border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="aspect-[16/10] overflow-hidden bg-[#e8e5e1]">{post.coverImage && <img src={assetSrc(post.coverImage)} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />}</div>              <div className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8a8178]">{post.category} · {post.language}</p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight">{post.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#666]">{post.excerpt}</p>
                {post.publishedAt && <p className="mt-5 flex items-center gap-2 text-xs text-[#999]"><CalendarDays className="size-4" />{new Date(post.publishedAt).toLocaleDateString()}</p>}
              </div>
            </Link>
          ))}
        </div>
        {!visible.length && <div className="mt-8 border border-dashed bg-white p-14 text-center text-sm text-[#777]">No published stories match these filters.</div>}
      </section>
    </main>
  );
}

async function enforceClientBlogHost(slug: string, filters: { q?: string; category?: string; language?: string }) {
  const configuredRoot = String(process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").trim();
  const root = configuredRoot.replace(/^https?:\/\//i, "").replace(/\/$/, "").split(":")[0].toLowerCase();
  if (!root || root === "localhost") return;
  const requestHeaders = await headers();
  const host = String(requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").split(",")[0].split(":")[0].toLowerCase();
  const expectedHost = `${slug.toLowerCase()}.${root}`;
  if (host === expectedHost) return;
  const protocol = configuredRoot.startsWith("http://") ? "http" : "https";
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.category) query.set("category", filters.category);
  if (filters.language) query.set("language", filters.language);
  redirect(`${protocol}://${expectedHost}/blog${query.size ? `?${query.toString()}` : ""}`);
}

async function loadHomepage(slug: string): Promise<PublicHomepageData> {
  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${baseUrl}/public/homepages/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Could not load photographer blog");
  const payload = await response.json() as { data: PublicHomepageData };
  return payload.data;
}

function assetSrc(value: string) {
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return value.startsWith("/") ? `${base}${value}` : value;
}

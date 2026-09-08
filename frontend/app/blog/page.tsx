import Link from "next/link";
import { ArrowRight, CalendarDays, Search, Star } from "lucide-react";
import { getUser } from "@/actions/auth";
import { SiteNav } from "@/components/home/site-nav";
import { getBlogs, type BlogPost } from "@/lib/blog";
import { GALLERY_LANGUAGES } from "@/lib/gallery-language";
import { getHomeCms } from "@/lib/home-cms-server";

export const dynamic = "force-dynamic";

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; language?: string }> }) {
  const params = await searchParams;
  const [posts, cms, user] = await Promise.all([getBlogs().catch(() => []), getHomeCms(), getUser()]);
  const t = cms.content.en;
  const dashboardHref = user ? (user.role === "admin" ? "/admin" : "/dashboard/client-gallery") : undefined;
  const query = String(params.q ?? "").trim().toLowerCase();
  const category = String(params.category ?? "All");
  const language = String(params.language ?? "All");
  const categories = [...new Set(posts.map((post) => post.category || "Guides"))].sort();
  const filtered = posts.filter((post) => {
    const postCategory = post.category || "Guides";
    const postLanguage = post.language || "English";
    const haystack = [post.title, post.excerpt, ...(post.keywords ?? [])].join(" ").toLowerCase();
    return (category === "All" || postCategory === category) && (language === "All" || postLanguage === language) && (!query || haystack.includes(query));
  });
  const featured = filtered.find((post) => post.featured);
  const regular = featured ? filtered.filter((post) => post._id !== featured._id) : filtered;

  return (
    <main className="min-h-screen bg-[#fbfaff] text-[#111]">
      <SiteNav brand={cms.brand} nav={t.nav} lang="en" dashboardHref={dashboardHref} />
      <section className="border-y border-[#eee9fb] bg-white px-5 py-16 text-center sm:py-24">
        <p className="text-xs font-bold uppercase tracking-[.28em] text-[#6337d8]">Ideas, guides & updates</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-bold tracking-[-.045em] sm:text-7xl">The Gallerista Blog</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#666]">Photography education, client experience, marketing ideas, inspiration, and product updates in the language you prefer.</p>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 pt-10">
        <form className="grid gap-3 rounded-2xl border border-[#e6ddff] bg-white p-4 shadow-sm md:grid-cols-[minmax(240px,1fr)_220px_auto]">
          <label className="flex h-11 items-center gap-2 border px-3"><Search className="size-4 text-[#777]" /><input name="q" defaultValue={params.q ?? ""} placeholder="Search articles" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <select name="language" defaultValue={language} className="h-11 border bg-white px-3 text-sm"><option value="All">All languages</option>{GALLERY_LANGUAGES.map((item) => <option key={item}>{item}</option>)}</select>
          <button className="h-11 bg-[#111] px-6 text-sm font-bold text-white">Filter</button>
          {category !== "All" && <input type="hidden" name="category" value={category} />}
        </form>
        <div className="mt-5 flex flex-wrap gap-2">
          {["All", ...categories].map((item) => <Link key={item} href={blogFilterHref({ q: params.q, language, category: item })} className={`rounded-full border px-4 py-2 text-xs font-bold ${category === item ? "border-[#6337d8] bg-[#6337d8] text-white" : "bg-white text-[#555]"}`}>{item}</Link>)}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-12 sm:py-16">
        {featured && <FeaturedPost post={featured} />}
        <div className={`grid gap-8 md:grid-cols-2 lg:grid-cols-3 ${featured ? "mt-12" : ""}`}>
          {regular.map((post) => <BlogCard key={post._id} post={post} />)}
        </div>
        {!filtered.length && <div className="rounded-2xl border border-dashed border-[#d8cdf5] bg-white p-16 text-center text-[#777]">No blog posts match these filters.</div>}
      </section>
    </main>
  );
}

function FeaturedPost({ post }: { post: BlogPost }) {
  return <article className="grid overflow-hidden rounded-2xl border border-[#ded2fb] bg-white shadow-[0_20px_60px_rgba(99,55,216,.12)] lg:grid-cols-[1.15fr_.85fr]">
    <Link href={`/blog/${post.slug}`} className="block min-h-[320px] bg-[#eeeaf8]">{post.thumbnailUrl && <img src={post.thumbnailUrl} alt={post.title} className="h-full w-full object-cover" />}</Link>
    <div className="flex flex-col justify-center p-8 sm:p-10"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#6337d8]"><Star className="size-4 fill-current" /> Featured · {post.category || "Guides"} · {post.language || "English"}</p><h2 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h2><p className="mt-5 text-sm leading-7 text-[#666]">{post.excerpt}</p><Link href={`/blog/${post.slug}`} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#6337d8]">Read featured article <ArrowRight className="size-4" /></Link></div>
  </article>;
}

function BlogCard({ post }: { post: BlogPost }) {
  return <article className="group overflow-hidden rounded-2xl border border-[#e6ddff] bg-white shadow-[0_14px_42px_rgba(99,55,216,.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(99,55,216,.16)]">
    <Link href={`/blog/${post.slug}`} className="block aspect-[16/10] overflow-hidden bg-[#eeeaf8]">{post.thumbnailUrl ? <img src={post.thumbnailUrl} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}</Link>
    <div className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#6337d8]">{post.category || "Guides"} · {post.language || "English"}</p><p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#777]"><CalendarDays className="size-4 text-[#6337d8]" />{new Date(post.publishedAt || post.createdAt || "1970-01-01").toLocaleDateString()}</p><h2 className="mt-4 text-2xl font-bold leading-tight">{post.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-7 text-[#666]">{post.excerpt}</p><Link href={`/blog/${post.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#6337d8]">Read article <ArrowRight className="size-4" /></Link></div>
  </article>;
}

function blogFilterHref({ q, category, language }: { q?: string; category: string; language: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category !== "All") params.set("category", category);
  if (language !== "All") params.set("language", language);
  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}

import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { getUser } from "@/actions/auth";
import { SiteNav } from "@/components/home/site-nav";
import { getBlogs } from "@/lib/blog";
import { getHomeCms } from "@/lib/home-cms-server";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const [posts, cms, user] = await Promise.all([getBlogs().catch(() => []), getHomeCms(), getUser()]);
  const t = cms.content.en;
  const dashboardHref = user ? (user.role === "admin" ? "/admin" : "/dashboard/client-gallery/dashboard") : undefined;
  return (
    <main className="min-h-screen bg-[#fbfaff] text-[#111]">
      <SiteNav brand={cms.brand} nav={t.nav} lang="en" dashboardHref={dashboardHref} />
      <section className="border-y border-[#eee9fb] bg-white px-5 py-20 text-center sm:py-28">
        <p className="text-xs font-bold uppercase tracking-[.28em] text-[#6337d8]">Ideas, guides & updates</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-bold tracking-[-.045em] sm:text-7xl">The Gallerista Blog</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#666]">Practical ideas for photographers who want better galleries, stronger client experiences, and a growing business.</p>
      </section>
      <section className="mx-auto max-w-[1240px] px-5 py-16 sm:py-20">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article key={post._id} className="group overflow-hidden rounded-2xl border border-[#e6ddff] bg-white shadow-[0_14px_42px_rgba(99,55,216,.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(99,55,216,.16)]">
              <Link href={`/blog/${post.slug}`} className="block aspect-[16/10] overflow-hidden bg-[#eeeaf8]">{post.thumbnailUrl ? <img src={post.thumbnailUrl} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}</Link>
              <div className="p-6"><p className="flex items-center gap-2 text-xs font-semibold text-[#777]"><CalendarDays className="size-4 text-[#6337d8]" />{new Date(post.publishedAt || post.createdAt || Date.now()).toLocaleDateString()}</p><h2 className="mt-4 text-2xl font-bold leading-tight">{post.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-7 text-[#666]">{post.excerpt}</p><Link href={`/blog/${post.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#6337d8]">Read article <ArrowRight className="size-4" /></Link></div>
            </article>
          ))}
        </div>
        {!posts.length && <div className="rounded-2xl border border-dashed border-[#d8cdf5] bg-white p-16 text-center text-[#777]">No published blog posts yet.</div>}
      </section>
    </main>
  );
}

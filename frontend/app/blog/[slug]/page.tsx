import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, User } from "lucide-react";
import { notFound } from "next/navigation";
import { getUser } from "@/actions/auth";
import { SiteNav } from "@/components/home/site-nav";
import { getBlog } from "@/lib/blog";
import { getHomeCms } from "@/lib/home-cms-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlog(slug).catch(() => null);
  if (!post) return { title: "Blog post" };
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords,
    openGraph: { title: post.title, description: post.excerpt, type: "article", images: post.thumbnailUrl ? [post.thumbnailUrl] : [] },
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, cms, user] = await Promise.all([getBlog(slug).catch(() => null), getHomeCms(), getUser()]);
  if (!post) notFound();
  const t = cms.content.en;
  const dashboardHref = user ? (user.role === "admin" ? "/admin" : "/dashboard/client-gallery/dashboard") : undefined;
  return (
    <main className="min-h-screen bg-white text-[#111]">
      <SiteNav brand={cms.brand} nav={t.nav} lang="en" dashboardHref={dashboardHref} />
      <article>
        <header className="border-y border-[#eee9fb] bg-[#fbfaff] px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl"><Link href="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-[#6337d8]"><ArrowLeft className="size-4" />Back to Blog</Link><h1 className="mt-8 text-4xl font-bold leading-[1.08] tracking-[-.045em] sm:text-6xl">{post.title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[#666]">{post.excerpt}</p><div className="mt-8 flex flex-wrap gap-5 text-sm text-[#777]"><span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-[#6337d8]" />{new Date(post.publishedAt || post.createdAt || Date.now()).toLocaleDateString()}</span>{post.author && <span className="inline-flex items-center gap-2"><User className="size-4 text-[#6337d8]" />{post.author}</span>}</div></div>
        </header>
        {post.thumbnailUrl && <div className="mx-auto max-w-5xl px-5 pt-12"><img src={post.thumbnailUrl} alt={post.title} className="max-h-[620px] w-full rounded-2xl object-cover shadow-[0_22px_70px_rgba(99,55,216,.14)]" /></div>}
        <div className="blog-content mx-auto max-w-3xl px-5 py-14 text-[17px] leading-8 text-[#333] sm:py-20" dangerouslySetInnerHTML={{ __html: post.content || "" }} />
      </article>
    </main>
  );
}

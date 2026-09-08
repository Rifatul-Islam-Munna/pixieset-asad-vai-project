import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { PublicHomepageData } from "@/components/dashboard/public-homepage";
import { publicHomepageBlogPath, publicHomepagePath } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; postSlug: string }> }): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const data = await loadHomepage(slug).catch(() => null);
  const post = data?.blogPosts?.find((item) => item.slug === postSlug);
  if (!post) return { title: "Blog post" };
  return { title: `${post.title} | ${data?.brandName || "Blog"}`, description: post.excerpt };
}

export default async function ClientBlogPostPage({ params }: { params: Promise<{ slug: string; postSlug: string }> }) {
  const { slug, postSlug } = await params;
  await enforceClientBlogHost(slug, postSlug);
  const data = await loadHomepage(slug);
  if (data.locked) redirect(publicHomepagePath(slug));
  const post = data.blogPosts?.find((item) => item.slug === postSlug);
  if (!post) notFound();

  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <header className="border-b px-5 py-7 sm:px-10">
        <div className="mx-auto flex max-w-[940px] items-center justify-between gap-4">
          <Link href={publicHomepageBlogPath(slug)} className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft className="size-4" />All stories</Link>
          <Link href={publicHomepagePath(slug)} className="text-sm font-bold uppercase tracking-[.12em]">{data.brandName}</Link>
        </div>
      </header>
      <article>
        <header className="bg-[#f8f7f4] px-5 py-14 sm:py-20">
          <div className="mx-auto max-w-[820px]">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a8178]">{post.featured ? "Featured · " : ""}{post.category} · {post.language}</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] sm:text-6xl">{post.title}</h1>
            <p className="mt-6 text-lg leading-8 text-[#666]">{post.excerpt}</p>
            {post.publishedAt && <p className="mt-7 flex items-center gap-2 text-sm text-[#888]"><CalendarDays className="size-4" />{new Date(post.publishedAt).toLocaleDateString()}</p>}
          </div>
        </header>
        {post.coverImage && <div className="mx-auto max-w-[1040px] px-5 pt-10"><img src={assetSrc(post.coverImage)} alt={post.title} className="max-h-[680px] w-full object-cover" /></div>}
        <div className="mx-auto max-w-[760px] px-5 py-12 text-[17px] leading-8 text-[#333] sm:py-16">
          <div className="whitespace-pre-line">{post.content}</div>
        </div>
      </article>
    </main>
  );
}

async function enforceClientBlogHost(slug: string, postSlug: string) {
  const configuredRoot = String(process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").trim();
  const root = configuredRoot.replace(/^https?:\/\//i, "").replace(/\/$/, "").split(":")[0].toLowerCase();
  if (!root || root === "localhost") return;
  const requestHeaders = await headers();
  const host = String(requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").split(",")[0].split(":")[0].toLowerCase();
  const expectedHost = `${slug.toLowerCase()}.${root}`;
  if (host === expectedHost) return;
  const protocol = configuredRoot.startsWith("http://") ? "http" : "https";
  redirect(`${protocol}://${expectedHost}/blog/${encodeURIComponent(postSlug)}`);
}

async function loadHomepage(slug: string): Promise<PublicHomepageData> {
  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${baseUrl}/public/homepages/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Could not load photographer blog");  const payload = await response.json() as { data: PublicHomepageData };
  return payload.data;
}

function assetSrc(value: string) {
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return value.startsWith("/") ? `${base}${value}` : value;
}

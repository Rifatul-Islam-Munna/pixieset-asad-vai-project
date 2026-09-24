import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, User } from "lucide-react";
import { notFound } from "next/navigation";
import { getUser } from "@/actions/auth";
import { SiteNav } from "@/components/home/site-nav";
import { getBlog } from "@/lib/blog";
import { getHomeCms } from "@/lib/home-cms-server";
import {
  autoDescription,
  autoKeywords,
  blogPostingJsonLd,
  collectSeoText,
  contentRobots,
  JsonLdScript,
  siteUrl,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

const languageTag = (value?: string) => {
  const key = String(value || "English").toLowerCase();
  if (key.includes("greek")) return "el";
  if (key.includes("french")) return "fr";
  if (key.includes("german") || key.includes("deutsch")) return "de";
  if (key.includes("arab")) return "ar";
  if (key.includes("spanish")) return "es";
  return "en";
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [post, cms] = await Promise.all([
    getBlog(slug).catch(() => null),
    getHomeCms(),
  ]);
  if (!post) return { title: "Blog post" };

  const autoText = collectSeoText({
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    author: post.author,
    language: post.language,
    ctaTitle: post.ctaEnabled ? post.ctaTitle : "",
    ctaText: post.ctaEnabled ? post.ctaText : "",
    ctaButtons: post.ctaEnabled
      ? (post.ctaButtons ?? []).filter((button) => button.enabled !== false).map((button) => button.label)
      : [],
  });
  const title = String(post.seoTitle || "").trim() || post.title;
  const description =
    String(post.seoDescription || "").trim() ||
    String(post.excerpt || "").trim() ||
    autoDescription(autoText, cms.seo.siteDescription);
  const keywords = post.keywords?.length
    ? post.keywords
    : autoKeywords(autoText, cms.seo.siteKeywords);
  const canonical = siteUrl(
    String(post.canonicalUrl || "").trim() || `/blog/${post.slug}`,
    cms.seo,
  );
  const imageSource =
    String(post.ogImageUrl || "").trim() ||
    String(post.thumbnailUrl || "").trim() ||
    String(cms.seo.siteImageUrl || "").trim();
  const image = imageSource ? siteUrl(imageSource, cms.seo) : undefined;
  const author = String(post.author || cms.seo.defaultAuthor || cms.seo.publisherName || cms.seo.siteTitle).trim();

  return {
    title: post.seoTitle ? { absolute: title } : title,
    description,
    keywords,
    authors: author ? [{ name: author }] : undefined,
    category: post.category || undefined,
    alternates: { canonical },
    robots: contentRobots(cms.seo, post.robotsIndex ?? true, post.robotsFollow ?? true),
    openGraph: {
      title: String(post.ogTitle || "").trim() || title,
      description: String(post.ogDescription || "").trim() || description,
      siteName: cms.seo.siteTitle,
      locale: cms.seo.siteLocale || "en_US",
      type: "article",
      url: canonical,
      publishedTime: post.publishedAt || post.createdAt,
      modifiedTime: post.updatedAt || post.publishedAt || post.createdAt,
      authors: author ? [author] : undefined,
      section: post.category || undefined,
      tags: keywords,
      images: image ? [{ url: image, alt: post.title }] : undefined,
    },
    twitter: {
      card: cms.seo.twitterCard === "summary" ? "summary" : "summary_large_image",
      site: cms.seo.twitterSite || undefined,
      creator: cms.seo.twitterCreator || undefined,
      title: String(post.ogTitle || "").trim() || title,
      description: String(post.ogDescription || "").trim() || description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, cms, user] = await Promise.all([getBlog(slug).catch(() => null), getHomeCms(), getUser()]);
  if (!post) notFound();

  const t = cms.content.en;
  const dashboardHref = user ? (user.role === "admin" ? "/admin" : "/dashboard/client-gallery") : undefined;
  const autoText = collectSeoText({
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    ctaTitle: post.ctaEnabled ? post.ctaTitle : "",
    ctaText: post.ctaEnabled ? post.ctaText : "",
    ctaButtons: post.ctaEnabled
      ? (post.ctaButtons ?? []).filter((button) => button.enabled !== false).map((button) => button.label)
      : [],
  });
  const description =
    String(post.seoDescription || "").trim() ||
    String(post.excerpt || "").trim() ||
    autoDescription(autoText, cms.seo.siteDescription);
  const keywords = post.keywords?.length ? post.keywords : autoKeywords(autoText, cms.seo.siteKeywords);
  const structuredData = blogPostingJsonLd({
    seo: cms.seo,
    title: post.title,
    description,
    path: `/blog/${post.slug}`,
    image: post.ogImageUrl || post.thumbnailUrl,
    author: post.author,
    publishedAt: post.publishedAt || post.createdAt,
    modifiedAt: post.updatedAt || post.publishedAt || post.createdAt,
    section: post.category,
    keywords,
    language: languageTag(post.language),
    content: post.content,
  });

  return (
    <main className="min-h-screen bg-white text-[#111]">
      <JsonLdScript data={structuredData} id="blog-post-json-ld" />
      <SiteNav brand={cms.brand} nav={t.nav} lang="en" dashboardHref={dashboardHref} />
      <article>
        <header className="border-y border-[#eee9fb] bg-[#fbfaff] px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl"><Link href="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-[#6337d8]"><ArrowLeft className="size-4" />Back to Blog</Link><p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-[#6337d8]">{post.featured ? "Featured · " : ""}{post.category || "Guides"} · {post.language || "English"}</p><h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-[-.045em] sm:text-6xl">{post.title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[#666]">{post.excerpt || description}</p><div className="mt-8 flex flex-wrap gap-5 text-sm text-[#777]"><span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-[#6337d8]" />{new Date(post.publishedAt || post.createdAt || "1970-01-01").toLocaleDateString()}</span>{(post.author || cms.seo.defaultAuthor) && <span className="inline-flex items-center gap-2"><User className="size-4 text-[#6337d8]" />{post.author || cms.seo.defaultAuthor}</span>}</div></div>
        </header>
        {post.thumbnailUrl && <div className="mx-auto max-w-5xl px-5 pt-12"><img src={post.thumbnailUrl} alt={post.title} className="max-h-[620px] w-full rounded-2xl object-cover shadow-[0_22px_70px_rgba(99,55,216,.14)]" /></div>}
        <div className="blog-content mx-auto max-w-3xl px-5 py-14 text-[17px] leading-8 text-[#333] sm:py-20" dangerouslySetInnerHTML={{ __html: post.content || "" }} />
        {post.ctaEnabled && (
          <BlogArticleCta
            title={post.ctaTitle}
            text={post.ctaText}
            buttons={post.ctaButtons ?? []}
          />
        )}
      </article>
    </main>
  );
}

function BlogArticleCta({
  title,
  text,
  buttons,
}: {
  title?: string;
  text?: string;
  buttons: NonNullable<Awaited<ReturnType<typeof getBlog>>>["ctaButtons"];
}) {
  const active = (buttons ?? []).filter((button) => button.enabled !== false && button.label && button.url);
  if (!title && !text && !active.length) return null;

  return (
    <section className="px-5 pb-16 sm:pb-24">
      <div className="mx-auto max-w-4xl rounded-[28px] bg-[#171717] px-6 py-10 text-center text-white shadow-[0_26px_70px_rgba(20,16,14,.18)] sm:px-12 sm:py-14">
        {title && <h2 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{title}</h2>}
        {text && <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/68">{text}</p>}
        {active.length > 0 && (
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {active.map((button, index) => {
              const style = button.style || "primary";
              return (
                <Link
                  key={button.id || index}
                  href={button.url || "#"}
                  target={button.newTab ? "_blank" : undefined}
                  rel={button.newTab ? "noopener noreferrer" : undefined}
                  className={
                    style === "primary"
                      ? "inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#171717] transition hover:-translate-y-0.5 hover:bg-[#ede8fb]"
                      : style === "secondary"
                        ? "inline-flex min-h-11 items-center rounded-full border border-white/25 px-6 text-sm font-bold text-white transition hover:bg-white/10"
                        : "inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-white underline underline-offset-4"
                  }
                >
                  {button.label}
                  {style !== "secondary" && <ArrowRight className="size-4" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getUser } from "@/actions/auth";
import { DynamicSectionRenderer } from "@/components/dynamic-page/dynamic-section-renderer";
import { SiteNav } from "@/components/home/site-nav";
import { getDynamicPage } from "@/lib/dynamic-pages";
import { getHomeCms } from "@/lib/home-cms-server";
import {
  autoDescription,
  autoKeywords,
  collectSeoText,
  contentRobots,
  JsonLdScript,
  siteUrl,
  webPageJsonLd,
} from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [page, cms] = await Promise.all([
    getDynamicPage(slug).catch(() => null),
    getHomeCms(),
  ]);
  if (!page) return { title: "Page" };

  const activeSections = (page.sections ?? []).filter((section) => section.enabled !== false);
  const activeColumns = page.legacyGridEnabled === false ? [] : page.columns;
  const heroActive = page.heroEnabled !== false;
  const autoText = collectSeoText({
    title: page.title,
    eyebrow: heroActive ? page.eyebrow : "",
    heroTitle: heroActive ? page.heroTitle : "",
    heroDescription: heroActive ? page.heroDescription : "",
    heroButtons: heroActive
      ? (page.heroButtons ?? []).filter((button) => button.enabled !== false).map((button) => button.label)
      : [],
    columns: activeColumns.map((column) => ({
      eyebrow: column.eyebrow,
      title: column.title,
      body: column.body,
      linkLabel: column.linkLabel,
    })),
    sections: activeSections.map((section) => ({
      eyebrow: section.eyebrow,
      title: section.title,
      body: section.body,
      buttons: (section.buttons ?? []).filter((button) => button.enabled !== false).map((button) => button.label),
      items: (section.items ?? []).map((item) => ({
        eyebrow: item.eyebrow,
        title: item.title,
        body: item.body,
        label: item.label,
        value: item.value,
        linkLabel: item.linkLabel,
      })),
    })),
  });
  const title = String(page.seoTitle || "").trim() || page.title;
  const description =
    String(page.seoDescription || "").trim() ||
    String(page.heroDescription || "").trim() ||
    autoDescription(autoText, cms.seo.siteDescription);
  const keywords = page.seoKeywords?.length
    ? page.seoKeywords
    : autoKeywords(autoText, cms.seo.siteKeywords);
  const canonical = siteUrl(
    String(page.canonicalUrl || "").trim() || `/info/${page.slug}`,
    cms.seo,
  );
  const sectionImage = activeSections.find((section) => section.imageUrl)?.imageUrl ||
    activeSections.flatMap((section) => section.items || []).find((item) => item.imageUrl)?.imageUrl;
  const imageSource =
    String(page.ogImageUrl || "").trim() ||
    String(heroActive ? page.heroImageUrl || "" : "").trim() ||
    String(sectionImage || "").trim() ||
    String(cms.seo.siteImageUrl || "").trim();
  const image = imageSource ? siteUrl(imageSource, cms.seo) : undefined;

  return {
    title: page.seoTitle ? { absolute: title } : title,
    description,
    keywords,
    alternates: { canonical },
    robots: contentRobots(cms.seo, page.robotsIndex, page.robotsFollow),
    openGraph: {
      title: String(page.ogTitle || "").trim() || title,
      description: String(page.ogDescription || "").trim() || description,
      siteName: cms.seo.siteTitle,
      locale: cms.seo.siteLocale || "en_US",
      type: "website",
      url: canonical,
      images: image ? [{ url: image, alt: page.heroTitle || page.title }] : undefined,
    },
    twitter: {
      card: cms.seo.twitterCard === "summary" ? "summary" : "summary_large_image",
      site: cms.seo.twitterSite || undefined,
      creator: cms.seo.twitterCreator || undefined,
      title: String(page.ogTitle || "").trim() || title,
      description: String(page.ogDescription || "").trim() || description,
      images: image ? [image] : undefined,
    },
  };
}

const heroToneClasses: Record<string, string> = {
  light: "bg-white text-[#171717]",
  soft: "bg-[#f7f5f1] text-[#171717]",
  dark: "bg-[#171717] text-white",
  brand: "bg-[#ede8fb] text-[#171717]",
};

export default async function DynamicInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page, cms, user] = await Promise.all([
    getDynamicPage(slug).catch(() => null),
    getHomeCms(),
    getUser(),
  ]);
  if (!page) notFound();

  const t = cms.content.en;
  const dashboardHref = user ? (user.role === "admin" ? "/admin" : "/dashboard/client-gallery") : undefined;
  const columns = page.legacyGridEnabled === false
    ? []
    : (page.columns ?? []).slice(0, Math.max(3, Math.min(8, page.columnCount || 3)));
  const sections = (page.sections ?? []).filter((section) => section.enabled !== false);
  const gridStyle = { "--page-columns": Math.max(3, Math.min(8, page.columnCount || 3)) } as CSSProperties;
  const autoText = collectSeoText({
    title: page.title,
    heroTitle: page.heroEnabled === false ? "" : page.heroTitle,
    heroDescription: page.heroEnabled === false ? "" : page.heroDescription,
    heroButtons: page.heroEnabled === false
      ? []
      : (page.heroButtons ?? []).filter((button) => button.enabled !== false).map((button) => button.label),
    columns: columns.map((column) => ({
      eyebrow: column.eyebrow,
      title: column.title,
      body: column.body,
      linkLabel: column.linkLabel,
    })),
    sections: sections.map((section) => ({
      eyebrow: section.eyebrow,
      title: section.title,
      body: section.body,
      buttons: (section.buttons ?? []).filter((button) => button.enabled !== false).map((button) => button.label),
      items: (section.items ?? []).map((item) => ({
        eyebrow: item.eyebrow,
        title: item.title,
        body: item.body,
        label: item.label,
        value: item.value,
        linkLabel: item.linkLabel,
      })),
    })),
  });
  const description =
    String(page.seoDescription || "").trim() ||
    String(page.heroDescription || "").trim() ||
    autoDescription(autoText, cms.seo.siteDescription);
  const structuredData = webPageJsonLd({
    seo: cms.seo,
    title: page.heroTitle || page.title,
    description,
    path: `/info/${page.slug}`,
    image: page.ogImageUrl || (page.heroEnabled === false ? undefined : page.heroImageUrl),
  });
  const heroTone = page.heroTone || "soft";
  const heroLayout = page.heroLayout || "split";

  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <JsonLdScript data={structuredData} id="dynamic-page-json-ld" />
      <SiteNav brand={cms.brand} nav={t.nav} lang="en" dashboardHref={dashboardHref} />

      {page.heroEnabled !== false && (heroLayout === "image-background" && page.heroImageUrl ? (
        <section className="relative min-h-[620px] overflow-hidden border-y border-black/5 text-white">
          <img src={page.heroImageUrl} alt={page.heroTitle || page.title} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,12,12,.78),rgba(12,12,12,.32),rgba(12,12,12,.12))]" />
          <div className="relative mx-auto flex min-h-[620px] max-w-[1320px] items-center px-5 py-20">
            <div className="max-w-3xl">
              {page.eyebrow && <p className="text-xs font-bold uppercase tracking-[.22em] text-white/75">{page.eyebrow}</p>}
              <h1 className="mt-5 text-5xl font-semibold leading-[.98] tracking-[-.05em] sm:text-7xl">{page.heroTitle || page.title}</h1>
              {(page.heroDescription || description) && <p className="mt-7 max-w-2xl text-lg leading-8 text-white/78">{page.heroDescription || description}</p>}
              <HeroButtons page={page} inverse />
            </div>
          </div>
        </section>
      ) : heroLayout === "centered" ? (
        <section className={cn("border-y border-black/[.05] px-5 py-20 text-center sm:py-28", heroToneClasses[heroTone] || heroToneClasses.soft)}>
          <div className="mx-auto max-w-4xl">
            {page.eyebrow && <p className="text-xs font-bold uppercase tracking-[.22em] text-[#6337d8]">{page.eyebrow}</p>}
            <h1 className="mt-5 text-5xl font-semibold leading-[.98] tracking-[-.05em] sm:text-7xl">{page.heroTitle || page.title}</h1>
            {(page.heroDescription || description) && <p className={cn("mx-auto mt-7 max-w-2xl text-lg leading-8", heroTone === "dark" ? "text-white/68" : "text-[#69645e]")}>{page.heroDescription || description}</p>}
            <HeroButtons page={page} />
            {page.heroImageUrl && <img src={page.heroImageUrl} alt={page.heroTitle || page.title} className="mx-auto mt-12 max-h-[620px] w-full max-w-5xl rounded-[28px] border border-black/[.06] object-cover shadow-[0_30px_80px_rgba(35,29,25,.14)]" />}
          </div>
        </section>
      ) : (
        <section className={cn("relative overflow-hidden border-y border-black/[.05]", heroToneClasses[heroTone] || heroToneClasses.soft)}>
          <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
            <div>
              {page.eyebrow && <p className="text-xs font-bold uppercase tracking-[.22em] text-[#6337d8]">{page.eyebrow}</p>}
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-.05em] sm:text-7xl">{page.heroTitle || page.title}</h1>
              {(page.heroDescription || description) && <p className={cn("mt-7 max-w-2xl text-lg leading-8", heroTone === "dark" ? "text-white/68" : "text-[#69645e]")}>{page.heroDescription || description}</p>}
              <HeroButtons page={page} />
            </div>
            {page.heroImageUrl ? (
              <div className="overflow-hidden rounded-[30px] border border-black/[.06] bg-white shadow-[0_28px_80px_rgba(35,29,25,.13)]">
                <img src={page.heroImageUrl} alt={page.heroTitle || page.title} className="aspect-[5/4] w-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[5/4] rounded-[30px] border border-dashed border-current/15 bg-black/[.025]" />
            )}
          </div>
        </section>
      ))}

      {page.legacyGridEnabled !== false && columns.some((column) => column.title || column.body || column.imageUrl) && (
        <section className="px-5 py-16 sm:py-24">
          <div
            className="mx-auto grid max-w-[1320px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-[repeat(var(--page-columns),minmax(0,1fr))]"
            style={gridStyle}
          >
            {columns.map((column, index) => (
              <article key={index} className="group overflow-hidden rounded-[22px] border border-black/[.07] bg-white shadow-[0_14px_40px_rgba(34,28,23,.05)]">
                {column.imageUrl && <img src={column.imageUrl} alt={column.title || page.title} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />}
                <div className="p-6">
                  {column.eyebrow && <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#6337d8]">{column.eyebrow}</p>}
                  {column.title && <h2 className="mt-2 text-xl font-semibold tracking-[-.02em]">{column.title}</h2>}
                  {column.body && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#68645f]">{column.body}</p>}
                  {column.linkLabel && column.linkUrl && (
                    <Link href={column.linkUrl} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#6337d8]">
                      {column.linkLabel}<ArrowRight className="size-4" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {sections.map((section, index) => (
        <DynamicSectionRenderer key={section.id || index} section={section} />
      ))}
    </main>
  );
}

function HeroButtons({
  page,
  inverse = false,
}: {
  page: NonNullable<Awaited<ReturnType<typeof getDynamicPage>>>;
  inverse?: boolean;
}) {
  const buttons = page.heroButtons?.length
    ? page.heroButtons.filter((button) => button.enabled !== false && button.label && button.url)
    : [
        page.heroPrimaryLabel && page.heroPrimaryUrl
          ? { id: undefined, newTab: false, label: page.heroPrimaryLabel, url: page.heroPrimaryUrl, style: "primary" }
          : null,
        page.heroSecondaryLabel && page.heroSecondaryUrl
          ? { id: undefined, newTab: false, label: page.heroSecondaryLabel, url: page.heroSecondaryUrl, style: "secondary" }
          : null,
      ].filter(Boolean);

  if (!buttons.length) return null;
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {buttons.map((button, index) => {
        if (!button) return null;
        const style = button.style || "primary";
        return (
          <Link
            key={button.id || index}
            href={button.url || "#"}
            target={button.newTab ? "_blank" : undefined}
            rel={button.newTab ? "noopener noreferrer" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-bold transition hover:-translate-y-0.5",
              style === "primary" && (inverse ? "bg-white text-[#171717] hover:bg-[#ede8fb]" : "bg-[#171717] text-white hover:bg-[#6337d8]"),
              style === "secondary" && (inverse ? "border border-white/30 text-white hover:bg-white/10" : "border border-black/15 hover:bg-black/[.04]"),
              style === "text" && (inverse ? "px-2 text-white underline underline-offset-4" : "px-2 text-[#6337d8]"),
            )}
          >
            {button.label}
            {style !== "secondary" && <ArrowRight className="size-4" />}
          </Link>
        );
      })}
    </div>
  );
}

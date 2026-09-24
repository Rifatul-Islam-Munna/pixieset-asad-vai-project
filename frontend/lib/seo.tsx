import type { Metadata } from "next";
import type { SiteSeo } from "@/lib/home-cms";

const frontendUrl =
  process.env.NEXT_PUBLIC_FRONTEND_URL ??
  process.env.FRONTEND_URL ??
  "http://localhost:3000";

export function absoluteUrl(pathOrUrl?: string) {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(
    pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`,
    frontendUrl,
  ).toString();
}

export function siteBaseUrl(seo?: Pick<SiteSeo, "siteCanonicalUrl">) {
  const configured = String(seo?.siteCanonicalUrl ?? "").trim();
  try {
    return configured ? new URL(configured).origin : new URL(frontendUrl).origin;
  } catch {
    return new URL(frontendUrl).origin;
  }
}

export function siteUrl(pathOrUrl: string, seo?: Pick<SiteSeo, "siteCanonicalUrl">) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, siteBaseUrl(seo)).toString();
}

export function splitKeywords(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function collectSeoText(value: unknown): string {
  const parts: string[] = [];
  const walk = (item: unknown) => {
    if (!item) return;
    if (typeof item === "string") {
      parts.push(plainSeoText(item));
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }
    if (typeof item === "object") {
      Object.values(item as Record<string, unknown>).forEach(walk);
    }
  };
  walk(value);
  return plainSeoText(parts.join(" "));
}

export function autoDescription(text: string, fallback: string) {
  const clean = plainSeoText(text);
  if (!clean) return fallback;
  return clean.length > 160 ? `${clean.slice(0, 157).trim()}...` : clean;
}

export function autoKeywords(text: string, fallback?: string) {
  const manual = splitKeywords(fallback);
  if (manual.length) return manual;
  const stop = new Set([
    "and",
    "the",
    "for",
    "with",
    "from",
    "your",
    "you",
    "are",
    "this",
    "that",
    "into",
    "our",
    "all",
    "page",
    "photo",
    "photos",
  ]);
  const counts = plainSeoText(text)
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2 && !stop.has(word))
    .reduce<Record<string, number>>((acc, word) => {
      acc[word] = (acc[word] ?? 0) + 1;
      return acc;
    }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([word]) => word);
}

export function plainSeoText(value?: string) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRobots(value?: string): Metadata["robots"] {
  const text = (value ?? "index, follow").toLowerCase();
  const maxSnippet = text.match(/max-snippet\s*:\s*(-?\d+)/)?.[1];
  const maxVideoPreview = text.match(/max-video-preview\s*:\s*(-?\d+)/)?.[1];
  const maxImagePreview = text.match(/max-image-preview\s*:\s*(none|standard|large)/)?.[1] as "none" | "standard" | "large" | undefined;
  const shared = {
    index: !text.includes("noindex"),
    follow: !text.includes("nofollow"),
    noarchive: text.includes("noarchive"),
    nosnippet: text.includes("nosnippet"),
    noimageindex: text.includes("noimageindex"),
    notranslate: text.includes("notranslate"),
    "max-snippet": maxSnippet === undefined ? undefined : Number(maxSnippet),
    "max-video-preview": maxVideoPreview === undefined ? undefined : Number(maxVideoPreview),
    "max-image-preview": maxImagePreview,
  };
  return {
    ...shared,
    googleBot: shared,
  };
}

export function contentRobots(seo: SiteSeo, index = true, follow = true): Metadata["robots"] {
  const base = parseRobots(seo.robots);
  if (!base || typeof base === "string") return { index, follow };
  const googleBot = typeof base.googleBot === "object" && base.googleBot
    ? { ...base.googleBot, index, follow }
    : { index, follow };
  return { ...base, index, follow, googleBot };
}

export function siteMetadata(seo: SiteSeo, autoText = ""): Metadata {
  const base = siteBaseUrl(seo);
  const image = seo.siteImageUrl ? siteUrl(seo.siteImageUrl, seo) : undefined;
  const canonical = siteUrl("/", seo);
  const description =
    String(seo.siteDescription ?? "").trim() ||
    autoDescription(autoText, String(seo.siteTitle ?? ""));
  const titleTemplate = String(seo.titleTemplate ?? "").includes("%s")
    ? seo.titleTemplate
    : `%s | ${seo.siteTitle}`;
  return {
    metadataBase: new URL(base),
    title: {
      default: seo.siteTitle,
      template: titleTemplate,
    },
    description,
    keywords: autoKeywords(autoText, seo.siteKeywords),
    applicationName: seo.siteTitle,
    creator: seo.defaultAuthor || seo.publisherName || seo.siteTitle,
    publisher: seo.publisherName || seo.siteTitle,
    manifest: "/manifest.webmanifest",
    robots: parseRobots(seo.robots),
    alternates: { canonical },
    verification: {
      google: seo.googleSiteVerification || undefined,
      other: seo.bingSiteVerification
        ? { "msvalidate.01": seo.bingSiteVerification }
        : undefined,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: seo.siteTitle,
    },
    formatDetection: {
      telephone: false,
    },
    icons: String(seo.faviconUrl ?? "").trim()
      ? {
          icon: [
            { url: String(seo.faviconUrl ?? "").trim(), type: "image/png" },
          ],
          apple: [
            {
              url: `/api/pwa-icon?size=180`,
              sizes: "180x180",
              type: "image/png",
            },
          ],
        }
      : undefined,
    openGraph: {
      title: seo.siteTitle,
      description,
      siteName: seo.siteTitle,
      locale: seo.siteLocale || "en_US",
      type: "website",
      url: canonical,
      images: image ? [{ url: image, alt: seo.siteTitle }] : undefined,
    },
    twitter: {
      card: seo.twitterCard === "summary" ? "summary" : "summary_large_image",
      site: seo.twitterSite || undefined,
      creator: seo.twitterCreator || undefined,
      title: seo.siteTitle,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export function pageMetadata({
  title,
  description,
  keywords,
  path,
  image,
  seo,
  autoText = "",
  type = "website",
}: {
  title: string;
  description: string;
  keywords?: string;
  path?: string;
  image?: string;
  seo: SiteSeo;
  autoText?: string;
  type?: "website" | "article";
}): Metadata {
  const url = path ? siteUrl(path, seo) : siteUrl("/", seo);
  const ogImage = image || seo.siteImageUrl ? siteUrl(image || seo.siteImageUrl, seo) : undefined;
  const nextDescription =
    description.trim() || autoDescription(autoText, seo.siteDescription);
  return {
    title: { absolute: title },
    manifest: path
      ? `/manifest.webmanifest?start=${encodeURIComponent(path)}`
      : "/manifest.webmanifest",
    description: nextDescription,
    keywords: autoKeywords(
      `${title} ${description} ${autoText}`,
      keywords || seo.siteKeywords,
    ),
    robots: parseRobots(seo.robots),
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description: nextDescription,
      siteName: seo.siteTitle,
      locale: seo.siteLocale || "en_US",
      type,
      url,
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
    },
    twitter: {
      card: seo.twitterCard === "summary" ? "summary" : "summary_large_image",
      site: seo.twitterSite || undefined,
      creator: seo.twitterCreator || undefined,
      title,
      description: nextDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export function parseJsonLd(value?: string) {
  if (!value?.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function JsonLdScript({
  data,
  id = "json-ld",
}: {
  data: unknown;
  id?: string;
}) {
  if (!data) return null;
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

function socialProfileUrls(value?: string) {
  return String(value ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

export function defaultOrganizationJsonLd(seo: SiteSeo) {
  const base = siteBaseUrl(seo);
  const logo = seo.publisherLogoUrl || seo.siteImageUrl || seo.faviconUrl;
  const organizationId = `${base}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: seo.publisherName || seo.siteTitle,
        url: base,
        description: seo.siteDescription,
        logo: logo
          ? {
              "@type": "ImageObject",
              url: siteUrl(logo, seo),
            }
          : undefined,
        sameAs: socialProfileUrls(seo.socialProfiles),
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: seo.siteTitle,
        description: seo.siteDescription,
        publisher: { "@id": organizationId },
        inLanguage: String(seo.siteLocale || "en_US").replace("_", "-"),
      },
    ],
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  seo: SiteSeo,
) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: siteUrl(item.path, seo),
    })),
  };
}

export function blogPostingJsonLd({
  seo,
  title,
  description,
  path,
  image,
  author,
  publishedAt,
  modifiedAt,
  section,
  keywords,
  language,
  content,
}: {
  seo: SiteSeo;
  title: string;
  description: string;
  path: string;
  image?: string;
  author?: string;
  publishedAt?: string;
  modifiedAt?: string;
  section?: string;
  keywords?: string[];
  language?: string;
  content?: string;
}) {
  const url = siteUrl(path, seo);
  const imageUrl = image ? siteUrl(image, seo) : seo.siteImageUrl ? siteUrl(seo.siteImageUrl, seo) : undefined;
  const authorName = author || seo.defaultAuthor || seo.publisherName || seo.siteTitle;
  const cleanContent = plainSeoText(content);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: title,
        description,
        image: imageUrl ? [imageUrl] : undefined,
        datePublished: publishedAt || undefined,
        dateModified: modifiedAt || publishedAt || undefined,
        author: { "@type": "Person", name: authorName },
        publisher: { "@id": `${siteBaseUrl(seo)}/#organization` },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        articleSection: section || undefined,
        keywords: keywords?.length ? keywords.join(", ") : undefined,
        inLanguage: language || String(seo.siteLocale || "en_US").replace("_", "-"),
        wordCount: cleanContent ? cleanContent.split(/\s+/).length : undefined,
      },
      breadcrumbJsonLd(
        [
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: title, path },
        ],
        seo,
      ),
    ],
  };
}

export function webPageJsonLd({
  seo,
  title,
  description,
  path,
  image,
}: {
  seo: SiteSeo;
  title: string;
  description: string;
  path: string;
  image?: string;
}) {
  const url = siteUrl(path, seo);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: title,
        description,
        primaryImageOfPage: image
          ? { "@type": "ImageObject", url: siteUrl(image, seo) }
          : undefined,
        isPartOf: { "@id": `${siteBaseUrl(seo)}/#website` },
        inLanguage: String(seo.siteLocale || "en_US").replace("_", "-"),
      },
      breadcrumbJsonLd(
        [
          { name: "Home", path: "/" },
          { name: title, path },
        ],
        seo,
      ),
    ],
  };
}

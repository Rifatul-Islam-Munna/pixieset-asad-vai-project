import type { Metadata } from "next";
import type { SiteSeo } from "@/lib/home-cms";

const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL ?? process.env.FRONTEND_URL ?? "http://localhost:3000";

export function absoluteUrl(pathOrUrl?: string) {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, frontendUrl).toString();
}

export function splitKeywords(value?: string) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
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
  const stop = new Set(["and", "the", "for", "with", "from", "your", "you", "are", "this", "that", "into", "our", "all", "page", "photo", "photos"]);
  const counts = plainSeoText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
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

function plainSeoText(value?: string) {
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
  return {
    index: !text.includes("noindex"),
    follow: !text.includes("nofollow"),
    googleBot: {
      index: !text.includes("noindex"),
      follow: !text.includes("nofollow"),
    },
  };
}

export function siteMetadata(seo: SiteSeo, autoText = ""): Metadata {
  const image = absoluteUrl(seo.siteImageUrl);
  const canonical = absoluteUrl(seo.siteCanonicalUrl);
  const description = seo.siteDescription.trim() || autoDescription(autoText, seo.siteTitle);
  return {
    metadataBase: new URL(frontendUrl),
    title: {
      default: seo.siteTitle,
      template: `%s | ${seo.siteTitle}`,
    },
    description,
    keywords: autoKeywords(autoText, seo.siteKeywords),
    applicationName: seo.siteTitle,
    robots: parseRobots(seo.robots),
    alternates: canonical ? { canonical } : undefined,
    icons: seo.faviconUrl.trim() ? { icon: [{ url: seo.faviconUrl.trim(), type: "image/png" }] } : undefined,
    openGraph: {
      title: seo.siteTitle,
      description,
      siteName: seo.siteTitle,
      type: "website",
      url: canonical,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: seo.twitterCard === "summary" ? "summary" : "summary_large_image",
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
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(image || seo.siteImageUrl);
  const nextDescription = description.trim() || autoDescription(autoText, seo.siteDescription);
  return {
    title: { absolute: title },
    description: nextDescription,
    keywords: autoKeywords(`${title} ${description} ${autoText}`, keywords || seo.siteKeywords),
    robots: parseRobots(seo.robots),
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description: nextDescription,
      siteName: seo.siteTitle,
      type,
      url,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: seo.twitterCard === "summary" ? "summary" : "summary_large_image",
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

export function JsonLdScript({ data, id = "json-ld" }: { data: unknown; id?: string }) {
  if (!data) return null;
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function defaultOrganizationJsonLd(seo: SiteSeo) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo.siteTitle,
    url: absoluteUrl(seo.siteCanonicalUrl || "/"),
    description: seo.siteDescription,
    logo: absoluteUrl(seo.siteImageUrl || seo.faviconUrl),
  };
}

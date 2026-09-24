import type { MetadataRoute } from "next";
import { getBlogs } from "@/lib/blog";
import { getDynamicSitemapPages } from "@/lib/dynamic-pages";
import { getHomeCms } from "@/lib/home-cms-server";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cms = await getHomeCms();
  const { seo } = cms;
  if (!seo.sitemapEnabled) return [];

  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  if (seo.sitemapIncludeStaticPages) {
    const staticPages: Array<{
      path: string;
      changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
      priority: number;
    }> = [
      { path: "/", changeFrequency: "weekly", priority: 1 },
      { path: "/blog", changeFrequency: "daily", priority: 0.9 },
      { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
      { path: "/plans", changeFrequency: "weekly", priority: 0.7 },
      { path: "/terms-of-service", changeFrequency: "yearly", priority: 0.3 },
      { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
    ];
    entries.push(...staticPages.map((item) => ({
      url: siteUrl(item.path, seo),
      lastModified: now,
      changeFrequency: item.changeFrequency,
      priority: item.priority,
    })));
  }

  if (seo.sitemapIncludeBlog) {
    const posts = await getBlogs().catch(() => []);
    entries.push(...posts
      .filter((post) => post.robotsIndex !== false)
      .map((post) => ({
        url: siteUrl(`/blog/${post.slug}`, seo),
        lastModified: post.updatedAt || post.publishedAt || post.createdAt || now,
        changeFrequency: "weekly" as const,
        priority: post.featured ? 0.9 : 0.8,
        images: post.thumbnailUrl ? [siteUrl(post.thumbnailUrl, seo)] : undefined,
      })));
  }

  if (seo.sitemapIncludeDynamicPages) {
    const pages = await getDynamicSitemapPages().catch(() => []);
    entries.push(...pages
      .filter((page) => page.robotsIndex !== false)
      .map((page) => {
        const sectionImages = (page.sections ?? [])
          .filter((section) => section.enabled !== false)
          .flatMap((section) => [
            section.imageUrl,
            ...(section.items ?? []).map((item) => item.imageUrl),
          ]);
        const images = [
          page.heroEnabled === false ? undefined : page.heroImageUrl,
          ...(page.legacyGridEnabled === false ? [] : (page.columns ?? []).map((column) => column.imageUrl)),
          ...sectionImages,
        ]
          .filter((value): value is string => Boolean(value))
          .map((value) => siteUrl(value, seo));
        return {
          url: siteUrl(`/info/${page.slug}`, seo),
          lastModified: page.updatedAt || page.createdAt || now,
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: images.length ? images : undefined,
        };
      }));
  }

  const extraUrls = String(seo.sitemapExtraUrls || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  entries.push(...extraUrls.map((value) => ({
    url: siteUrl(value, seo),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  })));

  const unique = new Map(entries.map((entry) => [entry.url, entry]));
  return [...unique.values()];
}

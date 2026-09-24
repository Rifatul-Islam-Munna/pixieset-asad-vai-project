import { getHomeCms } from "@/lib/home-cms-server";
import { siteBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const cms = await getHomeCms();
  const { seo } = cms;
  const base = siteBaseUrl(seo);
  const fallback = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /dashboard/",
    "Disallow: /api/",
    "Disallow: /login",
    "Disallow: /register",
  ].join("\n");

  let body = String(seo.robotsTxt || fallback).trim();
  if (seo.robotsTxtAppendSitemap && seo.sitemapEnabled && !/^\s*Sitemap\s*:/im.test(body)) {
    body += `\n\nSitemap: ${base}/sitemap.xml`;
  }

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

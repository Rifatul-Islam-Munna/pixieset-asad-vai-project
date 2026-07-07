import { NextResponse, type NextRequest } from "next/server";
import { getHomeCms } from "@/lib/home-cms-server";
import { absoluteUrl } from "@/lib/seo";

export async function GET(request: NextRequest) {
  const cms = await getHomeCms();
  const start = request.nextUrl.searchParams.get("start") || "/";
  const safeStart = start.startsWith("/") && !start.startsWith("//") ? start : "/";
  const icon = cms.seo.faviconUrl.trim();
  const iconQuery = icon ? `&src=${encodeURIComponent(icon)}` : "";
  const name = cms.seo.siteTitle.trim() || cms.content.nav.brand || "Nikoset";

  return new NextResponse(JSON.stringify({
    name,
    short_name: name.slice(0, 12),
    description: cms.seo.siteDescription,
    id: safeStart,
    start_url: safeStart,
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#ffffff",
    theme_color: "#111111",
    orientation: "portrait-primary",
    icons: [192, 512].map((size) => ({
      src: `/api/pwa-icon?size=${size}${iconQuery}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any maskable",
    })),
    shortcuts: [
      {
        name: "Open galleries",
        short_name: "Galleries",
        url: "/dashboard/collections",
        icons: [{ src: `/api/pwa-icon?size=96${iconQuery}`, sizes: "96x96" }],
      },
    ],
    screenshots: cms.seo.siteImageUrl
      ? [{ src: absoluteUrl(cms.seo.siteImageUrl), sizes: "1280x720", type: "image/png", form_factor: "wide" }]
      : undefined,
  }), {
    headers: {
      "content-type": "application/manifest+json",
      "cache-control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}

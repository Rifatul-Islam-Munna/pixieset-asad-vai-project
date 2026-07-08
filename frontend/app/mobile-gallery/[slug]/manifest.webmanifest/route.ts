import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const response = await fetch(`${baseUrl}/public/mobile-gallery/apps/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  const payload = response?.ok ? await response.json().catch(() => null) : null;
  const app = payload?.data;
  const name = app?.name || "Mobile Gallery App";
  return NextResponse.json(
    {
      id: `/mobile-gallery/${slug}`,
      name,
      short_name: String(name).slice(0, 12),
      description: `Mobile photo gallery for ${name}`,
      start_url: `/mobile-gallery/${slug}?source=pwa`,
      scope: `/mobile-gallery/${slug}`,
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
      background_color: app?.design?.backgroundColor || "#ffffff",
      theme_color: app?.design?.backgroundColor || "#ffffff",
      orientation: "portrait-primary",
      categories: ["photo", "lifestyle"],
      prefer_related_applications: false,
      icons: [
        { src: `/mobile-gallery/${slug}/icon/180`, sizes: "180x180", type: "image/png", purpose: "any" },
        { src: `/mobile-gallery/${slug}/icon/192`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: `/mobile-gallery/${slug}/icon/512`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
      shortcuts: [
        { name: "Open Gallery", short_name: "Gallery", url: `/mobile-gallery/${slug}?source=shortcut`, icons: [{ src: `/mobile-gallery/${slug}/icon/192`, sizes: "192x192" }] },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=300" } },
  );
}

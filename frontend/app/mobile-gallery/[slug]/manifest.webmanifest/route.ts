import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const response = await fetch(`${baseUrl}/public/mobile-gallery/apps/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  const payload = response?.ok ? await response.json().catch(() => null) : null;
  const app = payload?.data;
  const icon = app?.iconUrl || app?.coverImage || "/favicon.ico";
  return NextResponse.json(
    {
      id: `/mobile-gallery/${slug}`,
      name: app?.name || "Mobile Gallery App",
      short_name: app?.name || "Gallery",
      description: `Mobile photo gallery for ${app?.name || "your event"}`,
      start_url: `/mobile-gallery/${slug}?source=pwa`,
      scope: `/mobile-gallery/${slug}`,
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone"],
      background_color: app?.design?.backgroundColor || "#ffffff",
      theme_color: app?.design?.backgroundColor || "#ffffff",
      orientation: "portrait-primary",
      icons: [
        { src: icon, sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: icon, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=300" } },
  );
}

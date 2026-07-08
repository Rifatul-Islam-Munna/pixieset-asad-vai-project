import { ImageResponse } from "next/og";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

const allowedSizes: Record<string, { width: number; height: number }> = {
  "1179x2556": { width: 1179, height: 2556 },
  "1290x2796": { width: 1290, height: 2796 },
  "1170x2532": { width: 1170, height: 2532 },
  "1125x2436": { width: 1125, height: 2436 },
  "1242x2688": { width: 1242, height: 2688 },
  "1536x2048": { width: 1536, height: 2048 },
  "1668x2388": { width: 1668, height: 2388 },
  "2048x2732": { width: 2048, height: 2732 },
};

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; size: string }> }) {
  const { slug, size } = await params;
  const dimensions = allowedSizes[size] || allowedSizes["1179x2556"];
  const response = await fetch(`${baseUrl}/public/mobile-gallery/apps/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  const payload = response?.ok ? await response.json().catch(() => null) : null;
  const app = payload?.data;
  const cover = app?.coverImage || app?.iconUrl;
  const name = String(app?.name || "Mobile Gallery");
  const background = app?.design?.backgroundColor || "#f7f5f2";
  const foreground = app?.design?.textColor || "#222222";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background }}>
        {cover ? <img src={cover} alt="" width={dimensions.width} height={dimensions.height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        {cover ? <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.42)" }} /> : null}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 80, color: cover ? "#ffffff" : foreground }}>
          {app?.iconUrl ? <img src={app.iconUrl} alt="" width={220} height={220} style={{ width: 220, height: 220, borderRadius: 48, objectFit: "cover", marginBottom: 48 }} /> : null}
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: 2, maxWidth: 900 }}>{name}</div>
          <div style={{ marginTop: 24, fontSize: 24, letterSpacing: 8, textTransform: "uppercase", opacity: .8 }}>Mobile Gallery</div>
        </div>
      </div>
    ),
    { width: dimensions.width, height: dimensions.height, headers: { "cache-control": "public, max-age=300" } },
  );
}

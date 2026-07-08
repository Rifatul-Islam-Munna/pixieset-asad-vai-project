import { ImageResponse } from "next/og";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; size: string }> }) {
  const { slug, size: rawSize } = await params;
  const requested = Number(rawSize);
  const size = [180, 192, 512].includes(requested) ? requested : 192;
  const response = await fetch(`${baseUrl}/public/mobile-gallery/apps/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  const payload = response?.ok ? await response.json().catch(() => null) : null;
  const app = payload?.data;
  const icon = app?.iconUrl || app?.coverImage;
  const name = String(app?.name || "Gallery");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: app?.design?.backgroundColor || "#f3f3f1",
          color: app?.design?.textColor || "#222222",
          overflow: "hidden",
          fontSize: Math.round(size * 0.25),
          fontWeight: 700,
        }}
      >
        {icon ? (
          <img src={icon} alt="" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span>{name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=300" } },
  );
}

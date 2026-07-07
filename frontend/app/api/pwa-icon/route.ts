import { NextResponse, type NextRequest } from "next/server";
import { getHomeCms } from "@/lib/home-cms-server";

const apiBase = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const size = clampSize(Number(request.nextUrl.searchParams.get("size")) || 192);
  const src = request.nextUrl.searchParams.get("src") || (await getHomeCms()).seo.faviconUrl.trim();
  const url = resolveIconUrl(src, request.nextUrl.origin);

  if (url) {
    const response = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (response?.ok) {
      return new NextResponse(await response.arrayBuffer(), {
        headers: {
          "content-type": response.headers.get("content-type") || "image/png",
          "cache-control": "public, max-age=300, stale-while-revalidate=86400",
        },
      });
    }
  }

  return new NextResponse(fallbackSvg(size), {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}

function resolveIconUrl(src: string | undefined, origin: string) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/uploads/")) return `${apiBase}${src}`;
  if (src.startsWith("/")) return new URL(src, origin).toString();
  return new URL(`/${src}`, origin).toString();
}

function clampSize(size: number) {
  return Math.min(512, Math.max(48, Math.round(size)));
}

function fallbackSvg(size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#111"/><circle cx="256" cy="256" r="148" fill="#fff"/><circle cx="256" cy="256" r="88" fill="#111"/><circle cx="332" cy="182" r="34" fill="#fff"/></svg>`;
}

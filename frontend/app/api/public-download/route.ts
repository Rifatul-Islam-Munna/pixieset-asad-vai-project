import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url") ?? "";
  const rawName = searchParams.get("name") ?? "photo";
  const targetUrl = rawUrl.startsWith("/uploads/") ? `${baseUrl}${rawUrl}` : rawUrl;

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ message: "Invalid download URL" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ message: "Invalid download protocol" }, { status: 400 });
  }

  const response = await fetch(parsed, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) {
    return NextResponse.json({ message: "Image download failed" }, { status: response?.status ?? 502 });
  }
  if (!response.body) {
    return NextResponse.json({ message: "Image body missing" }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const extension = extensionFromContentType(contentType) || extensionFromPath(parsed.pathname);
  const filename = safeFilename(rawName, extension);

  return new NextResponse(response.body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function safeFilename(value: string, extension: string) {
  const clean = value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "photo";
  return `${clean}${extension || ".jpg"}`;
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  return "";
}

function extensionFromPath(pathname: string) {
  const match = pathname.match(/\.[a-z0-9]{2,5}$/i);
  return match?.[0] ?? ".jpg";
}

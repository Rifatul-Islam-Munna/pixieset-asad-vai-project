import { NextResponse } from "next/server";

const allowedExtensions = [".woff", ".woff2", ".ttf", ".otf"];

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url") || "";
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ message: "Invalid font URL" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(target.protocol) || !isAllowedOrigin(target.origin)) {
    return NextResponse.json({ message: "Font source is not allowed" }, { status: 403 });
  }

  const extension = allowedExtensions.find((value) => target.pathname.toLowerCase().endsWith(value));
  if (!extension) return NextResponse.json({ message: "Unsupported font file" }, { status: 400 });

  const response = await fetch(target, { cache: "force-cache" }).catch(() => null);
  if (!response?.ok || !response.body) {
    return NextResponse.json({ message: "Font could not be loaded" }, { status: response?.status || 502 });
  }

  return new NextResponse(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") || contentType(extension),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

function isAllowedOrigin(origin: string) {
  const configured = [
    process.env.MINIO_URL,
    process.env.BASE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ].filter(Boolean) as string[];
  return configured.some((value) => {
    try {
      return new URL(value).origin === origin;
    } catch {
      return false;
    }
  });
}

function contentType(extension: string) {
  if (extension === ".woff2") return "font/woff2";
  if (extension === ".woff") return "font/woff";
  if (extension === ".otf") return "font/otf";
  return "font/ttf";
}

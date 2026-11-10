import { NextResponse } from "next/server";
import JSZip from "jszip";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

type ZipImage = {
  id?: string;
  url?: string;
  name?: string;
};

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

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const rawImages = Array.isArray(payload?.images) ? payload.images as ZipImage[] : [];
  const strictFavoriteSelection = payload?.scope === "favorites";
  const selectedImageIds = new Set(
    Array.isArray(payload?.selectedImageIds)
      ? payload.selectedImageIds.map((value: unknown) => String(value)).filter(Boolean)
      : [],
  );
  const seenFavoriteIds = new Set<string>();
  const images = (strictFavoriteSelection
    ? rawImages.filter((image) => {
        const id = String(image.id ?? "");
        if (!id || !selectedImageIds.has(id) || seenFavoriteIds.has(id)) return false;
        seenFavoriteIds.add(id);
        return true;
      })
    : rawImages
  ).slice(0, 250);
  const zipName = safeFilename(String(payload?.name ?? "collection"), ".zip");

  if (strictFavoriteSelection && !selectedImageIds.size) {
    return NextResponse.json({ message: "No favorite photos selected" }, { status: 400 });
  }
  if (!images.length) {
    return NextResponse.json({ message: strictFavoriteSelection ? "Selected favorites were not found" : "No images to download" }, { status: 400 });
  }

  const usedNames = new Set<string>();
  const files = (await mapWithConcurrency(images, 20, async (image, index) => {
    const targetUrl = resolveDownloadUrl(image.url ?? "");
    const parsed = parseHttpUrl(targetUrl);
    if (!parsed) return null;

    const response = await fetch(parsed, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return null;

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (contentType.includes("text/html") || contentType.includes("application/json") || contentType.includes("text/plain")) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const detectedExtension = detectImageExtension(bytes);
    if (!detectedExtension) return null;
    const extension = detectedExtension;
    const filename = safeZipEntryName(String(image.name || `photo-${index + 1}`), extension, usedNames);
    usedNames.add(filename);
    return { name: filename, data: bytes };
  })).filter((file): file is { name: string; data: Uint8Array<ArrayBuffer> } => Boolean(file));

  if (files.length !== images.length) {
    return NextResponse.json({
      message: `ZIP not created: ${images.length - files.length} image(s) could not be fetched as valid original media. Please retry or restore missing originals.`,
    }, { status: 502 });
  }

  return new NextResponse(await createZip(files), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${zipName}"`,
      "cache-control": "no-store",
    },
  });
}

function detectImageExtension(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ".jpg";
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 &&
      bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return ".png";
  const text = (offset: number, size: number) => String.fromCharCode(...bytes.subarray(offset, offset + size));
  if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") return ".webp";
  if (text(0, 3) === "GIF") return ".gif";
  if ((text(0, 2) === "II" && bytes[2] === 42 && bytes[3] === 0) ||
      (text(0, 2) === "MM" && bytes[2] === 0 && bytes[3] === 42)) return ".tif";
  if (text(4, 4) === "ftyp") {
    const brand = text(8, 4);
    if (brand === "avif" || brand === "avis") return ".avif";
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return ".heic";
  }
  return null;
}

function resolveDownloadUrl(rawUrl: string) {
  return rawUrl.startsWith("/uploads/") ? `${baseUrl}${rawUrl}` : rawUrl;
}

function parseHttpUrl(targetUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return null;
  }
  return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
}

function safeFilename(value: string, extension: string) {
  const clean = value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "photo";
  return `${clean}${extension || ".jpg"}`;
}

function safeZipEntryName(value: string, extension: string, existing: Set<string>) {
  const base = safeFilename(value, extension);
  if (!existing.has(base)) return base;

  const stem = base.replace(/\.[a-z0-9]{2,5}$/i, "");
  const ext = extensionFromPath(base);
  let count = 2;
  let next = `${stem}-${count}${ext}`;
  while (existing.has(next)) {
    count += 1;
    next = `${stem}-${count}${ext}`;
  }
  return next;
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("mp4")) return ".mp4";
  if (contentType.includes("quicktime")) return ".mov";
  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  return "";
}

function extensionFromPath(pathname: string) {
  const match = pathname.match(/\.[a-z0-9]{2,5}$/i);
  return match?.[0] ?? ".jpg";
}

async function createZip(files: { name: string; data: Uint8Array<ArrayBuffer> }[]) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.data);
  }
  return zip.generateAsync({ type: "arraybuffer", compression: "STORE" });
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

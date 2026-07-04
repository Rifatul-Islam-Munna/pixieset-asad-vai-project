import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
const textEncoder = new TextEncoder();

type ZipImage = {
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
  const images = Array.isArray(payload?.images) ? payload.images.slice(0, 250) as ZipImage[] : [];
  const zipName = safeFilename(String(payload?.name ?? "collection"), ".zip");

  if (!images.length) {
    return NextResponse.json({ message: "No images to download" }, { status: 400 });
  }

  const files: { name: string; data: Uint8Array }[] = [];
  for (const [index, image] of images.entries()) {
    const targetUrl = resolveDownloadUrl(image.url ?? "");
    const parsed = parseHttpUrl(targetUrl);
    if (!parsed) continue;

    const response = await fetch(parsed, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) continue;

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const extension = extensionFromContentType(contentType) || extensionFromPath(new URL(parsed).pathname);
    const filename = safeZipEntryName(String(image.name || `photo-${index + 1}`), extension, files.map((file) => file.name));
    files.push({ name: filename, data: new Uint8Array(await response.arrayBuffer()) });
  }

  if (!files.length) {
    return NextResponse.json({ message: "Image download failed" }, { status: 502 });
  }

  return new NextResponse(createZip(files), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${zipName}"`,
      "cache-control": "no-store",
    },
  });
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

function safeZipEntryName(value: string, extension: string, existing: string[]) {
  const base = safeFilename(value, extension);
  if (!existing.includes(base)) return base;

  const stem = base.replace(/\.[a-z0-9]{2,5}$/i, "");
  const ext = extensionFromPath(base);
  let count = 2;
  let next = `${stem}-${count}${ext}`;
  while (existing.includes(next)) {
    count += 1;
    next = `${stem}-${count}${ext}`;
  }
  return next;
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

function createZip(files: { name: string; data: Uint8Array }[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = textEncoder.encode(file.name);
    const crc = crc32(file.data);
    const localHeader = zipHeader(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(file.data.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, file.data);

    const centralHeader = zipHeader(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(file.data.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + file.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = zipHeader(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(files.length, 8);
  endHeader.writeUInt16LE(files.length, 10);
  endHeader.writeUInt32LE(centralSize, 12);
  endHeader.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, ...centralParts, endHeader]);
}

function zipHeader(size: number) {
  return Buffer.alloc(size);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

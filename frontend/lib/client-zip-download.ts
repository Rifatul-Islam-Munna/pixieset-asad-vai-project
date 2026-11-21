"use client";

import { BlobWriter, ZipWriter } from "@zip.js/zip.js";

export type ClientZipFile = {
  url: string;
  name: string;
  sizeBytes?: number;
};

export type ClientZipDestination = {
  writable?: WritableStream<Uint8Array>;
  blobWriter?: BlobWriter;
};

type DownloadOptions = {
  estimatedSizeBytes?: number;
  totalFiles?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
};

type SaveFileHandleLike = {
  createWritable: () => Promise<WritableStream<Uint8Array>>;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<SaveFileHandleLike>;
};

const MAX_IN_MEMORY_ZIP_BYTES = 96 * 1024 * 1024;

function zipFilename(value: string) {
  const clean = String(value || "photos")
    .replace(/\.(zip)$/i, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${clean || "photos"}.zip`;
}

function uniqueEntryName(value: string, used: Set<string>) {
  const segments = String(value || "photo")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const clean = segment
        .replace(/[<>:"|?*\x00-\x1f]/g, "-")
        .replace(/^\.+$/g, "-")
        .trim()
        .slice(0, 180);
      return clean || "photo";
    });
  const base = segments.join("/") || "photo";
  if (!used.has(base.toLowerCase())) {
    used.add(base.toLowerCase());
    return base;
  }

  const slash = base.lastIndexOf("/");
  const folder = slash >= 0 ? base.slice(0, slash + 1) : "";
  const filename = slash >= 0 ? base.slice(slash + 1) : base;
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : "";
  let suffix = 2;
  let next = `${folder}${stem}-${suffix++}${extension}`;
  while (used.has(next.toLowerCase())) next = `${folder}${stem}-${suffix++}${extension}`;
  used.add(next.toLowerCase());
  return next;
}

async function* asAsyncIterable(
  source: Iterable<ClientZipFile> | AsyncIterable<ClientZipFile>,
): AsyncGenerator<ClientZipFile> {
  if (Symbol.asyncIterator in Object(source)) {
    for await (const item of source as AsyncIterable<ClientZipFile>) yield item;
    return;
  }
  for (const item of source as Iterable<ClientZipFile>) yield item;
}

/** Open the save dialog immediately from a click handler, before loading more metadata. */
export async function reserveClientZipDestination(fileName: string): Promise<ClientZipDestination | null> {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (!picker) return null;
  const handle = await picker.call(window, {
    suggestedName: zipFilename(fileName),
    types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
  });
  return { writable: await handle.createWritable() };
}

function enforceInMemoryLimit(
  stream: ReadableStream<Uint8Array>,
  tracker: { bytes: number },
) {
  const reader = stream.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      tracker.bytes += value.byteLength;
      if (tracker.bytes > MAX_IN_MEMORY_ZIP_BYTES) {
        await reader.cancel().catch(() => undefined);
        controller.error(new Error(
          "This gallery is larger than the safe in-memory limit. Open it in Chrome or Edge to save the ZIP directly to disk.",
        ));
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function fetchPhoto(file: ClientZipFile, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(file.url, { cache: "no-store", signal, mode: "cors", referrerPolicy: "no-referrer" });
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    throw new Error(
      `The browser could not access "${file.name}". The photo host must allow CORS from https://gallerista.app.`,
    );
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 403 || response.status === 410) {
      throw new Error("A photo download link expired. Request a fresh download link and try again.");
    }
    throw new Error(`Could not download "${file.name}" (HTTP ${response.status}).`);
  }
  return response.body;
}

/**
 * Streams photos one at a time into a ZIP in the visitor's browser. When the
 * File System Access API is available, ZIP bytes go straight to disk. Browsers
 * without it get a deliberately small in-memory fallback to protect device RAM.
 */
export async function downloadClientZip(
  source: Iterable<ClientZipFile> | AsyncIterable<ClientZipFile>,
  fileName: string,
  options: DownloadOptions = {},
  reservedDestination?: ClientZipDestination | null,
) {
  const suggestedName = zipFilename(fileName);
  let destination = reservedDestination;
  if (!destination) destination = await reserveClientZipDestination(fileName);

  let fileWritable = destination?.writable;
  let blobWriter = destination?.blobWriter;
  if (!fileWritable && !blobWriter) {
    const estimatedSize = Math.max(0, Number(options.estimatedSizeBytes || 0));
    if (estimatedSize > MAX_IN_MEMORY_ZIP_BYTES) {
      throw new Error(
        "This browser cannot safely save a large ZIP without using a lot of memory. Open this download in Chrome or Edge on a device that supports direct-to-disk saving.",
      );
    }
    blobWriter = new BlobWriter("application/zip");
  }

  const zipWriter = new ZipWriter(fileWritable || blobWriter!, {
    zip64: true,
    level: 0,
  });
  const usedNames = new Set<string>();
  const memoryTracker = { bytes: 0 };
  let completed = 0;

  try {
    for await (const file of asAsyncIterable(source)) {
      if (options.signal?.aborted) throw options.signal.reason ?? new Error("Download cancelled");
      if (!file.url) throw new Error(`A download URL is missing for "${file.name}".`);
      const fetchedBody = await fetchPhoto(file, options.signal);
      const body = blobWriter ? enforceInMemoryLimit(fetchedBody, memoryTracker) : fetchedBody;
      await zipWriter.add(uniqueEntryName(file.name, usedNames), body, { level: 0 });
      completed += 1;
      options.onProgress?.(completed, options.totalFiles ?? 0);
    }

    if (!completed) throw new Error("No downloadable photos remain in this request.");
    await zipWriter.close();
    if (blobWriter) {
      const blob = await blobWriter.getData();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = suggestedName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
    return completed;
  } catch (error) {
    if (fileWritable) await fileWritable.abort(error).catch(() => undefined);
    else await zipWriter.close().catch(() => undefined);
    throw error;
  }
}


/** Streams a single photo to disk where supported; never routes its bytes through the backend. */
export async function downloadClientFile(file: ClientZipFile) {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (picker) {
    const handle = await picker.call(window, {
      suggestedName: String(file.name || "photo").split("/").pop() || "photo",
      types: [{ description: "Photo or video", accept: { "application/octet-stream": [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".heic", ".mp4", ".mov", ".webm"] } }],
    });
    const writable = await handle.createWritable();
    try {
      const body = await fetchPhoto(file);
      await body.pipeTo(writable);
    } catch (error) {
      await writable.abort(error).catch(() => undefined);
      if (error instanceof Error && error.message.includes("browser could not access")) {
        const fallback = document.createElement("a");
        fallback.href = file.url;
        fallback.target = "_blank";
        fallback.rel = "noopener noreferrer";
        document.body.appendChild(fallback);
        fallback.click();
        fallback.remove();
        return;
      }
      throw error;
    }
    return;
  }

  // Cross-origin download attributes are not consistently honored. Let the
  // source's signed Content-Disposition header control the browser download.
  const link = document.createElement("a");
  link.href = file.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

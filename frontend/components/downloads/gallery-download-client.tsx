"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { downloadClientFile, downloadClientZip, type ClientZipFile } from "@/lib/client-zip-download";

type DownloadManifestPage = {
  fileName: string;
  scope: "single" | "set" | "favorites" | "all";
  totalCount: number;
  totalSizeBytes: number;
  offset: number;
  limit: number;
  nextOffset: number;
  expiresAt: string;
  files: Array<ClientZipFile & { id: string }>;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://ai-photo-book-moment-backend.wrtsxa.easypanel.host"
).replace(/\/+$/, "");

async function getManifest(token: string, offset = 0, limit = 50, signal?: AbortSignal) {
  const url = new URL(
    `/public/collections/download-deliveries/${encodeURIComponent(token)}/manifest`,
    `${API_BASE}/`,
  );
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { cache: "no-store", signal, credentials: "omit" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message;
    throw new Error(message || "This download link is unavailable. Request a new link from the gallery.");
  }
  if (!payload?.data) throw new Error("The download manifest was empty. Please request a new link.");
  return payload.data as DownloadManifestPage;
}

function formatBytes(value: number) {
  const bytes = Math.max(0, Number(value || 0));
  if (!bytes) return "Size unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function expiryLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "This secure link expires after 24 hours." : `Link expires ${date.toLocaleString()}.`;
}

export function GalleryDownloadClient({ token }: { token: string }) {
  const [manifest, setManifest] = useState<DownloadManifestPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [saveMode, setSaveMode] = useState<"detecting" | "browser" | "server">("detecting");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Safari and Firefox do not support the user-visible File System Access
    // picker. Use a real attachment link there instead of a memory-limited Blob.
    const picker = (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    setSaveMode(typeof picker === "function" ? "browser" : "server");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getManifest(token, 0, 50, controller.signal)
      .then(setManifest)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not prepare this download.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  const downloadAll = async () => {
    if (!manifest || busy) return;
    setError("");
    setFinished(false);
    setCompleted(0);

    if (manifest.scope === "single" && manifest.files.length === 1) {
      setBusy(true);
      try {
        await downloadClientFile(manifest.files[0]);
        setFinished(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The photo could not be downloaded.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      async function* allFiles() {
        let page = manifest;
        while (page) {
          for (const file of page.files) yield file;
          if (page.nextOffset >= page.totalCount) break;
          page = await getManifest(token, page.nextOffset, page.limit, controller.signal);
        }
      }

      const count = await downloadClientZip(allFiles(), manifest.fileName, {
        estimatedSizeBytes: manifest.totalSizeBytes,
        totalFiles: manifest.totalCount,
        signal: controller.signal,
        onProgress: (next) => setCompleted(next),
      });
      setCompleted(count);
      setFinished(true);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The ZIP could not be created.");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f3f0] px-4 py-12 text-[#242424]">
      <section className="w-full max-w-xl border border-black/5 bg-white px-6 py-10 shadow-sm sm:px-10">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#16a894]">Secure photo delivery</p>
        <h1 className="mt-4 text-center text-2xl font-medium tracking-[0.08em] sm:text-3xl">Your photos are ready</h1>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-sm text-[#777]">
            <Loader2 className="size-6 animate-spin" />
            Checking your secure download link…
          </div>
        ) : error && !manifest ? (
          <div className="mt-8 flex items-start gap-3 bg-red-50 p-4 text-sm leading-6 text-red-800">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : manifest ? (
          <>
            <p className="mx-auto mt-6 max-w-md text-center text-sm leading-6 text-[#666]">
              {manifest.scope === "single"
                ? "Your requested photo is ready. Save it directly to your device."
                : saveMode === "server"
                  ? "Download all requested photos in one ZIP file. Your browser will save a streamed attachment without needing to build the archive in device memory."
                  : "Download every requested photo together in one ZIP file. Photos are fetched and packaged in your browser; the backend does not build or store the ZIP."}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 border-y border-[#eee] py-5 text-center">
              <div>
                <p className="text-2xl font-semibold tabular-nums">{manifest.totalCount.toLocaleString()}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#888]">
                  {manifest.totalCount === 1 ? "Photo" : "Photos"}
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold">{formatBytes(manifest.totalSizeBytes)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#888]">Estimated size</p>
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-[#888]">{expiryLabel(manifest.expiresAt)}</p>

            {busy && (
              <div className="mt-7">
                <div className="flex items-center justify-between text-xs text-[#666]">
                  <span>Adding photos to your ZIP</span>
                  <span className="tabular-nums">{completed.toLocaleString()} / {manifest.totalCount.toLocaleString()}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden bg-[#eee]">
                  <div
                    className="h-full bg-[#18bba5] transition-[width]"
                    style={{ width: `${manifest.totalCount ? Math.min(100, completed / manifest.totalCount * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 flex items-start gap-3 bg-red-50 p-4 text-sm leading-6 text-red-800">
                <AlertCircle className="mt-0.5 size-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {finished && !busy && (
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#16856f]">
                <CheckCircle2 className="size-5" />
                Download started successfully.
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3">
              {saveMode === "server" && manifest.totalCount > 0 ? (
                <a
                  href={
                    API_BASE + "/public/collections/download-deliveries/" + encodeURIComponent(token)
                      + (manifest.scope === "single" && manifest.files.length === 1
                        ? "/files/" + encodeURIComponent(manifest.files[0].id)
                        : "/archive")
                  }
                  referrerPolicy="no-referrer"
                  className="flex h-12 items-center justify-center gap-2 bg-[#18bba5] px-6 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#139f8d]"
                >
                  <Download className="size-4" />
                  {manifest.scope === "single" ? "Download photo" : "Download ZIP"}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void downloadAll()}
                  disabled={busy || !manifest.totalCount || saveMode === "detecting"}
                  className="flex h-12 items-center justify-center gap-2 bg-[#18bba5] px-6 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#139f8d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy || saveMode === "detecting" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {busy ? "Preparing your download" : manifest.scope === "single" ? "Download photo" : "Download all photos"}
                </button>
              )}
              {busy && (
                <button type="button" onClick={() => abortRef.current?.abort(new Error("Download cancelled."))} className="h-10 text-xs font-semibold text-[#777] hover:text-black">
                  Cancel download
                </button>
              )}
            </div>
            <p className="mt-5 text-center text-[11px] leading-5 text-[#999]">
              {saveMode === "server"
                ? "Safari and Firefox use a normal browser download. Check your browser's Downloads list after clicking."
                : "For large galleries, Chrome or Edge can save the ZIP directly to disk without holding the whole archive in memory."}
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Download, ImageDown, Loader2, PackageCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

type DownloadPayload = {
  collectionName: string;
  listName: string;
  email: string;
  images: Array<{ url: string; name: string }>;
};

export default function FavoriteDownloadPage() {
  const [payload, setPayload] = useState<DownloadPayload | null>(null);
  const [percent, setPercent] = useState(3);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("Preparing secure image package");
  const imageCount = payload?.images.length ?? 0;

  useEffect(() => {
    const raw = window.sessionStorage.getItem("nikoset-favorite-download");
    const parsed = raw ? JSON.parse(raw) as DownloadPayload : null;
    setPayload(parsed);
    if (!parsed?.images?.length) {
      setStatus("error");
      setMessage("No collection images found");
    }
  }, []);

  useEffect(() => {
    if (!payload?.images.length) return;
    let value = 3;
    const timer = window.setInterval(() => {
      value = Math.min(91, value + Math.max(2, Math.round((96 - value) / 11)));
      setPercent(value);
      setMessage(value < 30 ? "Reading collection files" : value < 62 ? "Compressing full-resolution photos" : "Sealing ZIP archive");
    }, 260);

    const downloadZip = async () => {
      const response = await fetch("/api/public-download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: payload.collectionName, images: payload.images }),
      }).catch(() => null);
      window.clearInterval(timer);
      if (!response?.ok) {
        setStatus("error");
        setPercent(100);
        setMessage("Download failed");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName(payload.collectionName)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPercent(100);
      setStatus("done");
      setMessage("Download started");
    };

    void downloadZip();
    return () => window.clearInterval(timer);
  }, [payload]);

  const ring = useMemo(() => ({
    background: `conic-gradient(#111 0deg, #111 ${percent * 3.6}deg, #d9e7df ${percent * 3.6}deg)`,
  }), [percent]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f6ef] text-[#10130f]">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(17,17,17,0.08)_0_1px,transparent_1px_120px)]" />
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#c8eadf] blur-3xl" />
      <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-[#f1d57f] opacity-50 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-[minmax(360px,0.85fr)_1.15fr]">
        <aside className="flex flex-col justify-between border-r border-black/10 bg-white/70 p-6 backdrop-blur">
          <button className="inline-flex w-fit items-center gap-2 text-sm font-bold text-[#1d241f]" onClick={() => history.back()}>
            <ArrowLeft className="size-4" />
            Back
          </button>

          <div className="max-w-[460px]">
            <p className="text-xs font-black uppercase tracking-[0.34em] text-[#008f78]">Download all photos</p>
            <h1 className="mt-5 text-5xl font-black leading-none tracking-normal md:text-6xl">
              {payload?.collectionName ?? "Collection"}
            </h1>
            <p className="mt-5 text-lg font-semibold text-[#59635c]">
              Full collection archive, built from {imageCount} image{imageCount === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Files" value={String(imageCount)} />
            <Stat label="Type" value="ZIP" />
            <Stat label="Status" value={status === "done" ? "Ready" : status === "error" ? "Failed" : "Working"} />
          </div>
        </aside>

        <section className="relative flex items-center justify-center p-6 md:p-12">
          <div className="relative w-full max-w-[760px] overflow-hidden border border-black/10 bg-white shadow-[0_34px_120px_rgba(28,35,28,0.18)]">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#111]" style={{ transform: `scaleX(${percent / 100})`, transformOrigin: "left", transition: "transform 300ms ease" }} />
            <div className="grid gap-10 p-8 md:grid-cols-[240px_minmax(0,1fr)] md:p-10">
              <div className="relative mx-auto flex size-56 items-center justify-center rounded-full p-3" style={ring}>
                <div className="absolute inset-8 rounded-full border border-black/10" />
                <div className="relative flex h-full w-full flex-col items-center justify-center rounded-full bg-[#fbfcf8]">
                  {status === "done" ? <Check className="size-12 text-[#008f78]" /> : status === "error" ? <Download className="size-12 text-red-500" /> : <Loader2 className="size-12 animate-spin text-[#111]" />}
                  <span className="mt-3 text-5xl font-black">{percent}%</span>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center bg-[#111] text-white">
                    {status === "done" ? <PackageCheck className="size-5" /> : <ImageDown className="size-5" />}
                  </span>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-[#59635c]">{message}</p>
                </div>
                <div className="mt-9 h-4 overflow-hidden bg-[#e4ebe5]">
                  <div className="h-full bg-[#111] transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-8 grid gap-3">
                  {payload?.images.slice(0, 4).map((image, index) => (
                    <div key={`${image.url}-${index}`} className="flex items-center justify-between border-b border-black/10 pb-3 text-sm">
                      <span className="truncate font-semibold">{image.name}</span>
                      <Sparkles className="size-4 text-[#008f78]" />
                    </div>
                  ))}
                </div>
                {status === "error" && (
                  <Button className="mt-8 h-11 w-fit rounded-none bg-[#111] px-6 text-white" onClick={() => location.reload()}>
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/10 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#768079]">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "collection";
}

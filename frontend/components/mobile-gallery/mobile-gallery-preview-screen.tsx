"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Monitor, Smartphone } from "lucide-react";
import type { MobileGalleryApp, MobileGalleryProfile } from "@/api-hooks/use-mobile-gallery";
import { MobileGalleryPublic } from "./mobile-gallery-public";

export function MobileGalleryPreviewScreen({
  app,
  profile,
}: {
  app: MobileGalleryApp;
  profile: MobileGalleryProfile;
}) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const publicUrl = `/mobile-gallery/${app.slug}`;

  return (
    <main className="min-h-screen bg-[#f8f4f1] text-[#222]">
      <header className="sticky top-0 z-40 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link href={`/dashboard/mobile-gallery/apps/${app._id}`} className="flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> Back</Link>
        <div className="flex items-center gap-2">
          <div className="flex rounded border bg-[#f4f4f4] p-1">
            <button type="button" onClick={() => setDevice("mobile")} aria-label="Mobile preview" className={`rounded p-2 ${device === "mobile" ? "bg-white text-[#18bfa6] shadow-sm" : "text-[#777]"}`}><Smartphone className="size-4" /></button>
            <button type="button" onClick={() => setDevice("desktop")} aria-label="Desktop preview" className={`rounded p-2 ${device === "desktop" ? "bg-white text-[#18bfa6] shadow-sm" : "text-[#777]"}`}><Monitor className="size-4" /></button>
          </div>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 border px-3 py-2 text-sm"><ExternalLink className="size-4" /> Open Live</a>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-65px)] items-center justify-center p-4 sm:p-8">
        {device === "mobile" ? (
          <PhonePreview><MobileGalleryPublic app={app} profile={profile} embedded /></PhonePreview>
        ) : (
          <div className="w-full max-w-[1180px] overflow-hidden rounded-xl border bg-white shadow-[0_22px_60px_rgba(0,0,0,0.14)]">
            <div className="flex h-10 items-center gap-2 border-b bg-[#f4f4f4] px-4"><span className="size-2.5 rounded-full bg-[#d9d9d9]" /><span className="size-2.5 rounded-full bg-[#d9d9d9]" /><span className="size-2.5 rounded-full bg-[#d9d9d9]" /><div className="ml-3 flex-1 truncate rounded bg-white px-3 py-1 text-xs text-[#888]">{publicUrl}</div></div>
            <div className="h-[78vh] min-h-[600px] overflow-hidden"><MobileGalleryPublic app={app} profile={profile} embedded /></div>
          </div>
        )}
      </div>
    </main>
  );
}

function PhonePreview({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[390px] rounded-[42px] bg-white p-3 shadow-[0_22px_60px_rgba(0,0,0,0.16)]"><div className="h-[min(720px,78vh)] min-h-[560px] overflow-hidden rounded-[32px] border bg-white">{children}</div></div>;
}

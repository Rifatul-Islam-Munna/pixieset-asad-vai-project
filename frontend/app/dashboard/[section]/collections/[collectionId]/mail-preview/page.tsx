"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, Copy, ExternalLink, MailCheck, MonitorDown, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EmailTemplateItem } from "@/lib/dashboard-store";

type PreviewPayload = {
  to: string;
  collectionName: string;
  publicLink: string;
  template: EmailTemplateItem;
};

export default function MailPreviewPage() {
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("nikoset-mail-preview");
    setPayload(raw ? JSON.parse(raw) as PreviewPayload : null);
  }, []);

  const template = payload?.template;
  const installLink = useMemo(() => payload?.publicLink ? withInstallQuery(payload.publicLink) : "", [payload?.publicLink]);
  const sendMailLink = useMemo(() => {
    if (!payload || !template) return "#";
    const body = [
      template.message,
      "",
      `${template.buttonText || "Open Gallery"}: ${payload.publicLink}`,
      `Install Gallery App: ${installLink}`,
      "",
      template.footerText,
    ].filter(Boolean).join("\n");

    return `mailto:${encodeURIComponent(payload.to)}?subject=${encodeURIComponent(template.subject || payload.collectionName)}&body=${encodeURIComponent(body)}`;
  }, [installLink, payload, template]);

  const copyInstallLink = async () => {
    if (!installLink) return;
    await navigator.clipboard.writeText(installLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main className="min-h-screen bg-[#f4f4f2] text-[#111]">
      <div className="grid min-h-screen lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="flex flex-col border-r border-black/10 bg-[#f4f4f2] p-6">
          <button className="inline-flex w-fit items-center gap-2 text-sm font-bold text-[#555]" onClick={() => history.back()}>
            <ArrowLeft className="size-4" />
            Back
          </button>

          <div className="mt-10">
            <p className="text-xs font-black uppercase tracking-[0.34em] text-[#22bda7]">Send as download</p>
            <h1 className="mt-5 text-4xl font-black leading-tight">{payload?.collectionName ?? "Collection"}</h1>
            <div className="mt-7 space-y-4 text-sm text-[#555]">
              <InfoLine label="To" value={payload?.to ?? "-"} />
              <InfoLine label="Subject" value={template?.subject || "-"} />
              <InfoLine label="Template" value={template?.name || template?.title || "-"} />
            </div>
          </div>

          <div className="mt-8 border border-black/10 bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center bg-[#22bda7] text-white">
                <MonitorDown className="size-5" />
              </span>
              <h2 className="font-black">PWA install link</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#555]">
              Client opens this gallery-only install link, then browser shows install prompt for that gallery.
            </p>
            <p className="mt-4 break-all bg-[#f4f4f2] p-3 text-xs text-[#111]">{installLink || "-"}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button className="h-10 rounded-none bg-[#22bda7] text-white hover:bg-[#19a995]" onClick={copyInstallLink}>
                <Copy className="size-4" />
                {copied ? "Copied" : "Copy"}
              </Button>
              <a href={installLink || "#"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 border border-black/15 text-sm font-bold text-[#111]">
                <ExternalLink className="size-4" />
                Open
              </a>
            </div>
          </div>

          <Button asChild className="mt-auto h-12 rounded-none bg-[#22bda7] text-white hover:bg-[#19a995]">
            <a href={sendMailLink}>
              <Send className="size-4" />
              Send Mail
            </a>
          </Button>
          <Button className="mt-3 h-12 rounded-none border border-black/15 bg-white text-[#111] hover:bg-[#f4f4f2]">
            <Send className="size-4" />
            Preview Ready
          </Button>
        </aside>

        <section className="relative overflow-auto bg-[#f4f4f2] p-5 text-[#111] md:p-10">
          <div className="absolute inset-x-0 top-0 h-32 bg-[#e8e8e5]" />
          <div className="relative mx-auto max-w-[760px]">
            <div className="mb-5 flex items-center justify-between rounded-none bg-white px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.10)]">
              <div className="flex items-center gap-3">
                <MailCheck className="size-5 text-[#22bda7]" />
                <span className="text-sm font-black uppercase tracking-[0.18em]">Email preview</span>
              </div>
              <Bell className="size-5 text-[#111]" />
            </div>

            {template ? (
              <article className="overflow-hidden bg-white shadow-[0_34px_120px_rgba(0,0,0,0.18)]">
                <header className="border-b bg-[#f4f4f2] px-8 py-10 text-center text-[#111] md:px-14">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-[#22bda7]">Gallery delivery</p>
                  <h2 className="mt-4 text-4xl font-black uppercase tracking-wide md:text-6xl">{template.title}</h2>
                </header>
                <div className="h-[280px] overflow-hidden bg-[#e8e8e5]">
                  {template.image ? (
                    <img src={template.image} alt={template.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[#e8e8e5] text-5xl font-black uppercase tracking-wide text-[#111]/10">
                      {template.title}
                    </div>
                  )}
                </div>
                <div className="px-8 py-10 text-base leading-7 md:px-16">
                  <p className="text-sm font-black uppercase tracking-wide text-[#667]">{template.subject}</p>
                  <p className="mt-2 text-sm text-[#667]">{template.previewText}</p>
                  <div className="mt-7 whitespace-pre-line text-[#222]">{template.message}</div>
                  <div className="mt-10 grid gap-3 text-center sm:grid-cols-2">
                    <a
                      href={payload.publicLink}
                      className="inline-flex h-12 items-center justify-center px-8 font-black uppercase tracking-wide text-white"
                      style={{ backgroundColor: template.buttonColor || "#111111" }}
                    >
                      {template.buttonText || "Open Gallery"}
                    </a>
                    <a
                      href={installLink}
                      className="inline-flex h-12 items-center justify-center border border-black/15 bg-white px-8 font-black uppercase tracking-wide text-[#111]"
                    >
                      Install Gallery App
                    </a>
                  </div>
                  <p className="mt-10 whitespace-pre-line text-center text-xs text-[#555]">{template.footerText}</p>
                </div>
              </article>
            ) : (
              <div className="grid min-h-[520px] place-items-center bg-white text-sm font-black text-[#777]">
                No preview payload.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#777]">{label}</span>
      <span className="mt-1 block break-all font-semibold text-[#111]">{value}</span>
    </p>
  );
}

function withInstallQuery(url: string) {
  try {
    const next = new URL(url);
    next.searchParams.set("install", "1");
    return next.toString();
  } catch {
    return `${url}${url.includes("?") ? "&" : "?"}install=1`;
  }
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileUp,
  Home,
  Link2,
  Loader2,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { PostRequestAxios } from "@/api-hooks/api-hooks";
import { useCollectionDetail } from "@/api-hooks/use-collections";
import { useDashboardSettings } from "@/api-hooks/use-dashboard-settings";
import { useHomepageSettings } from "@/api-hooks/use-homepage";
import { recordEmailUsage } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardSection } from "@/components/dashboard/client-dashboard";
import type { EmailTemplateItem } from "@/lib/dashboard-store";
import type { BrandSettings } from "@/lib/home-cms";
import { publicCollectionUrl } from "@/lib/public-site-url";

const defaultBranding: BrandSettings = {
  logoUrl: "",
  brandText: "",
  brandImageUrl: "",
  accentColor: "#22bda7",
};

function mediaUrl(value?: string) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function plainText(value?: string) {
  return String(value ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendCollectionEmail(payload: {
  to: string[];
  subject: string;
  text: string;
  html: string;
}) {
  const [data, error] = await PostRequestAxios<{
    data: { sent: boolean; skipped?: boolean; reason?: string };
  }>("/mail/send", payload);
  if (error || !data) throw new Error(error?.message || "Email send failed");
  return data.data;
}

export function CollectionSharePage({
  section,
  collectionId,
}: {
  section: DashboardSection;
  collectionId: string;
}) {
  const router = useRouter();
  const { collectionQuery } = useCollectionDetail(collectionId);
  const emailTemplateSettings = useDashboardSettings<EmailTemplateItem>("email-template");
  const brandingSettings = useDashboardSettings<BrandSettings>("branding");
  const homepageQuery = useHomepageSettings().query;

  const collection = collectionQuery.data?.data;
  const images = collection?.images ?? [];
  const templates = useMemo(
    () =>
      Array.isArray(emailTemplateSettings.query.data?.data)
        ? emailTemplateSettings.query.data.data.map((setting) => setting.data)
        : [],
    [emailTemplateSettings.query.data?.data],
  );
  const branding =
    brandingSettings.query.data?.data?.[0]?.data ?? defaultBranding;

  const [origin, setOrigin] = useState("");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [message, setMessage] = useState("");
  const [buttonText, setButtonText] = useState("View Gallery");
  const [footerText, setFooterText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const collectionSlug = collection?.slug ?? collectionId;
  const homepageSlug = homepageQuery.data?.data?.slug;
  const publicLink = homepageSlug
    ? publicCollectionUrl(homepageSlug, collectionSlug, origin)
    : `${origin}/collection/${encodeURIComponent(collection?.name ?? collectionId)}/${encodeURIComponent(collectionSlug)}`;

  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

  const applyTemplate = (template?: EmailTemplateItem) => {
    setSelectedTemplateId(template?.id ?? "");
    setSubject(
      template?.subject?.trim() ||
        `Photos for ${collection?.name ?? "your collection"} are ready`,
    );
    setHeading(
      template?.title?.trim() || collection?.name || "Your photos are ready",
    );
    setMessage(
      plainText(template?.message) ||
        "Your photos are ready. Use the button below to view the gallery.",
    );
    setButtonText(template?.buttonText?.trim() || "View Gallery");
    setFooterText(template?.footerText?.trim() || branding.brandText || "");
  };

  useEffect(() => {
    if (!collection || initialised) return;
    applyTemplate(templates[0]);
    setInitialised(true);
  }, [collection, initialised, templates]);

  const filteredTemplates = templates.filter((template) =>
    [template.name, template.subject, template.previewText]
      .join(" ")
      .toLowerCase()
      .includes(templateSearch.toLowerCase()),
  );

  const coverImage =
    selectedTemplate?.image ||
    collection?.coverImage ||
    images.find((image) => image.mediaType !== "video")?.url ||
    "";
  const logo = branding.logoUrl || branding.brandImageUrl || "";
  const accent = selectedTemplate?.buttonColor || branding.accentColor || "#444";

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicLink);
    toast.success("Direct link copied");
  };

  const send = async () => {
    const recipients = recipient
      .split(/[;,\n]/)
      .map((email) => email.trim())
      .filter((email) => /^\S+@\S+\.\S+$/.test(email));
    if (!recipients.length) {
      toast.error("Enter at least one valid email address");
      return;
    }
    if (!subject.trim()) {
      toast.error("Email subject is required");
      return;
    }

    const html = `
      <div style="margin:0;background:#f5f5f5;padding:36px 16px;font-family:Arial,sans-serif;color:#222">
        <div style="max-width:640px;margin:0 auto;background:#fff;text-align:center">
          <div style="padding:38px 36px 26px">
            ${logo ? `<img src="${escapeHtml(mediaUrl(logo))}" alt="" style="max-height:54px;max-width:170px;margin-bottom:18px"/>` : ""}
            ${branding.brandText ? `<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#555">${escapeHtml(branding.brandText)}</div>` : ""}
            <h1 style="margin:28px 0 0;font-size:27px;font-weight:500;letter-spacing:4px;text-transform:uppercase">${escapeHtml(heading || collection?.name || "Your photos")}</h1>
          </div>
          ${coverImage ? `<img src="${escapeHtml(mediaUrl(coverImage))}" alt="" style="display:block;width:100%;max-height:430px;object-fit:cover"/>` : ""}
          <div style="padding:42px 42px 34px">
            <p style="margin:0 auto 30px;max-width:500px;font-size:15px;line-height:1.8;color:#555;white-space:pre-line">${escapeHtml(message)}</p>
            <a href="${escapeHtml(publicLink)}" style="display:inline-block;background:${escapeHtml(accent)};color:#fff;text-decoration:none;padding:15px 34px;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(buttonText || "View Gallery")}</a>
            ${footerText ? `<p style="margin:34px 0 0;font-size:11px;line-height:1.7;color:#777">${escapeHtml(footerText)}</p>` : ""}
          </div>
        </div>
      </div>`;

    setSending(true);
    try {
      await sendCollectionEmail({
        to: recipients,
        subject: subject.trim(),
        text: `${message.trim()}\n\n${publicLink}`,
        html,
      });
      await recordEmailUsage(recipients.length).catch(() => null);
      toast.success(
        `Collection shared with ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email could not be sent");
    } finally {
      setSending(false);
    }
  };

  if (collectionQuery.isLoading || !collection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="size-7 animate-spin text-[#22bda7]" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-white text-[#151515]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-5 md:px-7">
        <div className="flex items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/${section}/collections/${collectionId}`)}
            className="flex size-10 items-center justify-center hover:bg-[#f4f4f4]"
            aria-label="Back to collection"
          >
            <ArrowLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/${section}`)}
            className="flex size-10 items-center justify-center hover:bg-[#f4f4f4]"
            aria-label="Go to dashboard home"
            title="Home"
          >
            <Home className="size-5" />
          </button>
          <div>
            <h1 className="font-medium">Share Collection</h1>
            <p className="mt-1 text-xs text-[#777]">{collection.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex items-center gap-2 text-sm font-medium"
        >
          <Link2 className="size-4" />
          <span className="hidden sm:inline">Get direct link</span>
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1.05fr_1fr]">
        <section className="flex min-h-[calc(100vh-4rem)] flex-col border-r bg-white">
          <div className="flex-1 px-5 py-7 md:px-8">
            <FieldGroup className="gap-6">
              <Field>
                <FieldLabel className="text-xs font-bold uppercase tracking-wide text-[#777]">
                  To
                </FieldLabel>
                <Textarea
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="guest@email.com"
                  className="min-h-20 rounded-none"
                />
              </Field>
              <Field>
                <FieldLabel>Subject</FieldLabel>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="h-12 rounded-none"
                />
              </Field>
              <Field>
                <FieldLabel>Heading</FieldLabel>
                <Input
                  value={heading}
                  onChange={(event) => setHeading(event.target.value)}
                  className="h-12 rounded-none"
                />
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="min-h-40 rounded-none"
                />
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel>Button text</FieldLabel>
                  <Input
                    value={buttonText}
                    onChange={(event) => setButtonText(event.target.value)}
                    className="h-12 rounded-none"
                  />
                </Field>
                <Field>
                  <FieldLabel>Footer text</FieldLabel>
                  <Input
                    value={footerText}
                    onChange={(event) => setFooterText(event.target.value)}
                    className="h-12 rounded-none"
                  />
                </Field>
              </div>
            </FieldGroup>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#00a997]"
                >
                  <FileUp className="size-4" />
                  Insert Email Template
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[340px] rounded-none p-3">
                <div className="mb-3 flex h-10 items-center gap-2 border px-3">
                  <Search className="size-4 text-[#888]" />
                  <Input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Find template"
                    className="h-9 rounded-none border-0 px-0 focus-visible:ring-0"
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      className="block h-auto rounded-none px-3 py-3"
                      onSelect={() => applyTemplate(template)}
                    >
                      <span className="block truncate font-bold">
                        {template.name || "Untitled Template"}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#777]">
                        {template.subject || "No subject"}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {!filteredTemplates.length && (
                    <p className="px-3 py-7 text-center text-sm text-[#777]">
                      No templates found.
                    </p>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <footer className="flex shrink-0 items-center justify-end border-t px-5 py-4 md:px-8">
            <Button
              className="h-11 min-w-32 rounded-none bg-[#22bda7] text-white hover:bg-[#19a995]"
              disabled={sending || !recipient.trim() || !subject.trim()}
              onClick={() => void send()}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? "Sending..." : "Send"}
            </Button>
          </footer>
        </section>

        <aside className="min-h-[calc(100vh-4rem)] overflow-y-auto bg-[#f5f5f5] p-5 md:p-10">
          <div className="mx-auto max-w-[560px] bg-white text-center shadow-sm">
            <div className="px-8 pb-8 pt-10">
              {logo && (
                <img
                  src={mediaUrl(logo)}
                  alt=""
                  className="mx-auto max-h-14 max-w-44 object-contain"
                />
              )}
              {branding.brandText && (
                <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[#555]">
                  {branding.brandText}
                </p>
              )}
              <h2 className="mt-8 text-2xl font-medium uppercase tracking-[0.18em]">
                {heading || collection.name}
              </h2>
            </div>
            {coverImage && (
              <img
                src={mediaUrl(coverImage)}
                alt=""
                className="max-h-[430px] w-full object-cover"
              />
            )}
            <div className="px-10 py-10">
              <p className="whitespace-pre-line text-sm leading-7 text-[#666]">
                {message}
              </p>
              <span
                className="mt-8 inline-flex min-h-11 items-center justify-center px-8 text-xs font-bold uppercase tracking-[0.13em] text-white"
                style={{ backgroundColor: accent }}
              >
                {buttonText || "View Gallery"}
              </span>
              {footerText && (
                <p className="mt-8 text-xs leading-6 text-[#777]">{footerText}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

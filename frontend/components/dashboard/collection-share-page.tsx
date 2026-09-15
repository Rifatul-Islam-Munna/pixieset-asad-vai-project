"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  FileUp,
  Loader2,
  Search,
  Send,
  X,
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardSection } from "@/components/dashboard/client-dashboard";
import { baseEmailTemplates, type EmailTemplateItem } from "@/lib/dashboard-store";
import {
  buildGalleryEmailHtml,
  canInlineEmailAsset,
} from "@/lib/gallery-email";
import type { BrandSettings, HomeCmsData } from "@/lib/home-cms";
import { publicCollectionUrl } from "@/lib/public-site-url";

const defaultBranding: BrandSettings = {
  logoUrl: "",
  brandText: "",
  brandImageUrl: "",
  accentColor: "#22bda7",
  brandingPosition: "top",
};

const brandingPositionOptions = [
  { value: "top", label: "Top of email" },
  { value: "bottom", label: "Bottom of email" },
] as const;

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

const subscribeToOrigin = () => () => undefined;
const readBrowserOrigin = () => window.location.origin;
const readServerOrigin = () => "";

async function sendCollectionEmail(payload: {
  to: string[];
  subject: string;
  text: string;
  html: string;
  senderName?: string;
  inlineImages?: { url: string; cid: string; filename: string }[];
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
  senderName,
}: {
  section: DashboardSection;
  collectionId: string;
  senderName: string;
}) {
  const router = useRouter();
  const { collectionQuery } = useCollectionDetail(collectionId);
  const emailTemplateSettings =
    useDashboardSettings<EmailTemplateItem>("email-template");
  const brandingSettings = useDashboardSettings<BrandSettings>("branding");
  const homepageQuery = useHomepageSettings().query;
  const globalTemplatesQuery = useQuery({
    queryKey: ["global-email-templates"],
    queryFn: async () => {
      const response = await fetch("/api/home-cms", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Pre-built templates could not be loaded");
      }
      const payload = (await response.json()) as { data?: HomeCmsData };
      return payload.data?.emailTemplates ?? baseEmailTemplates;
    },
    staleTime: 60_000,
  });

  const collection = collectionQuery.data?.data;
  const images = collection?.images ?? [];
  const emailTemplateRows = emailTemplateSettings.query.data?.data;
  const templates = useMemo(() => {
    const custom = Array.isArray(emailTemplateRows)
      ? emailTemplateRows.map((setting) => setting.data)
      : [];
    const global = globalTemplatesQuery.data ?? baseEmailTemplates;
    return [
      ...global.map((template) => ({ ...template, source: "admin" as const })),
      ...custom.map((template) => ({ ...template, source: "user" as const })),
    ];
  }, [emailTemplateRows, globalTemplatesQuery.data]);
  const branding =
    brandingSettings.query.data?.data?.[0]?.data ?? defaultBranding;

  const origin = useSyncExternalStore(
    subscribeToOrigin,
    readBrowserOrigin,
    readServerOrigin,
  );
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [buttonText, setButtonText] = useState("View Gallery");
  const [footerText, setFooterText] = useState("");
  const [showBranding, setShowBranding] = useState(true);
  const [showImage, setShowImage] = useState(true);
  const [brandingPosition, setBrandingPosition] = useState<"top" | "bottom">(
    branding.brandingPosition ?? "top",
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [initialised, setInitialised] = useState(false);

  const collectionSlug = collection?.slug ?? collectionId;
  const homepageSlug = homepageQuery.data?.data?.slug;
  const publicLink = homepageSlug
    ? publicCollectionUrl(homepageSlug, collectionSlug, origin)
    : `${origin}/collection/${encodeURIComponent(collection?.name ?? collectionId)}/${encodeURIComponent(collectionSlug)}`;

  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    templates[0];

  const applyTemplate = (template?: EmailTemplateItem) => {
    setSelectedTemplateId(template?.id ?? "");
    setSubject(
      template?.subject?.trim() ||
        `Photos for ${collection?.name ?? "your collection"} are ready`,
    );
    setMessage(
      plainText(template?.message) ||
        "Your photos are ready. Use the button below to view the gallery.",
    );
    setButtonText(template?.buttonText?.trim() || "View Gallery");
    setFooterText(template?.footerText?.trim() || "");
    setShowBranding(template?.showBranding !== false);
    setShowImage(template?.showImage !== false);
  };

  useEffect(() => {
    if (!collection || initialised) return;
    const template = templates[0];
    const timer = window.setTimeout(() => {
      setSelectedTemplateId(template?.id ?? "");
      setSubject(
        template?.subject?.trim() ||
          `Photos for ${collection.name || "your collection"} are ready`,
      );
      setMessage(
        plainText(template?.message) ||
          "Your photos are ready. Use the button below to view the gallery.",
      );
      setButtonText(template?.buttonText?.trim() || "View Gallery");
      setFooterText(template?.footerText?.trim() || "");
      setShowBranding(template?.showBranding !== false);
      setShowImage(template?.showImage !== false);
      setInitialised(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [collection, initialised, templates]);

  const filteredTemplates = templates.filter((template) =>
    [
      template.name,
      template.subject,
      template.previewText,
      template.galleryCategory,
      template.language,
    ]
      .join(" ")
      .toLowerCase()
      .includes(templateSearch.toLowerCase()),
  );

  const rawCoverImage =
    selectedTemplate?.image ||
    collection?.coverImage ||
    images.find((image) => image.mediaType !== "video")?.url ||
    "";
  const coverImage = showImage ? rawCoverImage : "";
  const logo = branding.logoUrl || branding.brandImageUrl || "";
  const logoUrl = mediaUrl(logo);
  const coverImageUrl = mediaUrl(coverImage);
  const accent =
    showBranding && selectedTemplate?.useBrandColor !== false
      ? branding.accentColor || selectedTemplate?.buttonColor || "#444444"
      : selectedTemplate?.buttonColor || "#444444";
  const configuredButtonLink = selectedTemplate?.buttonLink?.trim() || "";
  const buttonLink = /^(https?:\/\/|mailto:)/i.test(configuredButtonLink)
    ? configuredButtonLink
    : publicLink;
  const emailTitle = collection?.name || selectedTemplate?.title || "Your photos";
  const eyebrowText =
    selectedTemplate?.eyebrowText ||
    selectedTemplate?.galleryCategory ||
    "Client Gallery";

  const previewHtml = useMemo(
    () =>
      buildGalleryEmailHtml({
        previewText: selectedTemplate?.previewText,
        eyebrowText,
        title: emailTitle,
        message,
        buttonText,
        buttonLink,
        buttonColor: accent,
        footerText,
        logoUrl,
        brandText: branding.brandText,
        imageUrl: coverImageUrl,
        showBranding,
        showImage,
        brandingPosition,
      }),
    [
      accent,
      branding.brandText,
      brandingPosition,
      buttonLink,
      buttonText,
      coverImageUrl,
      emailTitle,
      eyebrowText,
      footerText,
      logoUrl,
      message,
      selectedTemplate?.previewText,
      showBranding,
      showImage,
    ],
  );

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

    const inlineLogo = Boolean(logoUrl && canInlineEmailAsset(logoUrl));
    const inlineCover = Boolean(coverImageUrl && canInlineEmailAsset(coverImageUrl));
    const html = buildGalleryEmailHtml({
      previewText: selectedTemplate?.previewText,
      eyebrowText,
      title: emailTitle,
      message,
      buttonText,
      buttonLink,
      buttonColor: accent,
      footerText,
      logoUrl: inlineLogo ? "cid:gallery-logo" : logoUrl,
      brandText: branding.brandText,
      imageUrl: inlineCover ? "cid:gallery-cover" : coverImageUrl,
      showBranding,
      showImage,
      brandingPosition,
    });

    setSending(true);
    try {
      await sendCollectionEmail({
        to: recipients,
        subject: subject.trim(),
        text: [message.trim(), publicLink, footerText.trim()]
          .filter(Boolean)
          .join("\n\n"),
        html,
        senderName,
        inlineImages: [
          ...(showBranding && inlineLogo
            ? [{ url: logoUrl, cid: "gallery-logo", filename: "brand-logo" }]
            : []),
          ...(showImage && inlineCover
            ? [
                {
                  url: coverImageUrl,
                  cid: "gallery-cover",
                  filename: "gallery-cover",
                },
              ]
            : []),
        ],
      });
      await recordEmailUsage(recipients.length).catch(() => null);
      toast.success(
        `Collection shared with ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Email could not be sent",
      );
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
      <header className="flex h-[88px] shrink-0 items-center justify-between border-b border-[#e7e7e7] px-5 md:px-10">
        <div className="flex items-center gap-4 md:gap-5">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/${section}/collections/${collectionId}`,
              )
            }
            className="flex size-9 items-center justify-center text-[#555] transition hover:bg-[#f6f6f6]"
            aria-label="Close sharing"
          >
            <X className="size-5" />
          </button>
          <h1 className="text-[17px] font-medium">Share Collection</h1>
        </div>
        <div className="flex items-center gap-4 text-sm md:gap-8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-[#333]"
              >
                More <ChevronDown className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Email appearance</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={showBranding}
                onCheckedChange={(checked) => setShowBranding(checked === true)}
              >
                Show studio branding
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showImage}
                onCheckedChange={(checked) => setShowImage(checked === true)}
              >
                Show gallery cover
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Branding position</DropdownMenuLabel>
              {brandingPositionOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={brandingPosition === option.value}
                  onCheckedChange={() => setBrandingPosition(option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void copyLink()}>
                Copy direct gallery link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="hidden font-medium text-[#333] sm:block"
          >
            Get direct link
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(390px,0.92fr)_minmax(0,1.08fr)]">
        <section className="flex min-h-[calc(100vh-5.5rem)] flex-col border-r border-[#ececec] bg-white">
          <div className="flex-1 px-6 py-8 md:px-10 lg:px-12">
            <FieldGroup className="gap-0">
              <div className="grid grid-cols-[52px_1fr] items-center border-b border-[#ececec] py-1">
                <span className="text-sm text-[#777]">From:</span>
                <span className="truncate py-3 text-sm font-medium text-[#333]">
                  {senderName || "Account owner"}
                </span>
              </div>
              <Field className="grid grid-cols-[52px_1fr] items-start border-b border-[#ececec] py-1">
                <FieldLabel className="pt-3 text-sm font-normal text-[#777]">
                  To:
                </FieldLabel>
                <Textarea
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="guest@email.com"
                  className="min-h-12 resize-none rounded-none border-0 px-0 py-3 text-sm shadow-none focus-visible:ring-0"
                />
              </Field>
              <Field className="border-b border-[#ececec] py-8">
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Email subject"
                  className="h-auto rounded-none border-0 px-0 py-0 text-[17px] font-semibold shadow-none focus-visible:ring-0"
                />
              </Field>
              <Field className="pt-8">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write a message for your client..."
                  className="min-h-[290px] resize-none rounded-none border-0 px-0 text-[15px] leading-8 shadow-none focus-visible:ring-0"
                />
              </Field>
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
              <DropdownMenuContent
                align="start"
                className="w-[min(360px,calc(100vw-32px))] rounded-xl p-3"
              >
                <div className="mb-3 flex h-10 items-center gap-2 rounded-lg border px-3">
                  <Search className="size-4 text-[#888]" />
                  <Input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Find template"
                    className="h-9 rounded-none border-0 px-0 focus-visible:ring-0"
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {filteredTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      className="block h-auto px-3 py-3"
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

            <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#777]">
              <span className="rounded-full bg-[#f4f4f2] px-3 py-1.5">
                {showBranding ? "Branding on" : "Branding off"}
              </span>
              <span className="rounded-full bg-[#f4f4f2] px-3 py-1.5">
                {showImage ? "Cover image on" : "Cover image off"}
              </span>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end border-t px-5 py-4 md:px-8">
            <Button
              className="h-11 min-w-32 rounded-none bg-[#22bda7] text-white hover:bg-[#19a995]"
              disabled={sending || !recipient.trim() || !subject.trim()}
              onClick={() => void send()}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {sending ? "Sending..." : "Send"}
            </Button>
          </footer>
        </section>

        <aside className="min-h-[calc(100vh-5.5rem)] overflow-y-auto bg-[#f3f2ef] px-3 py-6 md:px-8 md:py-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#777]">
              Live email preview
            </p>
            <p className="text-xs text-[#8b8782]">Matches the sent email</p>
          </div>
          <div
            className="mx-auto max-w-[760px] overflow-hidden rounded-sm shadow-[0_24px_70px_rgba(40,35,25,0.12)]"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) {
                event.preventDefault();
              }
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </aside>
      </div>
    </main>
  );
}

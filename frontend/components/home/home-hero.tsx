"use client";

import { ArrowRight, Play, Sparkles, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/components/home/site-nav";
import { useHomeCms } from "@/api-hooks/use-home-cms";
import type { HomeCmsData, HomeLanguage } from "@/lib/home-cms";

function compactRichHeading(html: string) {
  return String(html ?? "")
    .replace(/<(p|div)(?:\s[^>]*)?>\s*(?:<br\s*\/?\s*>|&nbsp;|\u00a0|\s)*<\/\1>/gi, "")
    .replace(/(?:<br\s*\/?\s*>\s*){2,}/gi, "<br />")
    .trim();
}
function getVideoEmbed(url?: string | null) {
  const value = String(url ?? "")?.trim();
  if (!value) return { kind: "empty" as const, src: "" };
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return {
        kind: "iframe" as const,
        src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
      };
    }
    if (host.includes("youtube.com")) {
      const id =
        parsed.searchParams.get("v") ||
        parsed.pathname.split("/").filter(Boolean).pop();
      return {
        kind: "iframe" as const,
        src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
      };
    }
    if (host.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return {
        kind: "iframe" as const,
        src: `https://player.vimeo.com/video/${id}?autoplay=1`,
      };
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(value))
      return { kind: "video" as const, src: value };
    return { kind: "iframe" as const, src: value };
  } catch {
    return { kind: "empty" as const, src: "" };
  }
}

export function HomeHero({
  initialCms,
  requestedLanguage,
  dashboardHref,
}: {
  initialCms: HomeCmsData;
  requestedLanguage?: string;
  dashboardHref?: string;
}) {
  const cms = useHomeCms(initialCms);
  const lang: HomeLanguage =
    requestedLanguage === "gr" || requestedLanguage === "en"
      ? requestedLanguage
      : cms.defaultLanguage;
  const t = cms.content[lang] ?? cms.content.en;
  const workflowTabs = Array.isArray(t?.workflow?.tabs) ? t.workflow.tabs : [];
  const galleryTabs = Array.isArray(t?.gallery?.tabs) ? t.gallery.tabs : [];
  const ctaImages = Array.isArray(t?.cta?.images) ? t.cta.images : [];
  const avatarImages = Array.isArray(t?.hero?.avatarImages)
    ? t.hero.avatarImages
    : [];
  const images = [
    ...workflowTabs.map((item) => item?.image),
    ...galleryTabs.map((item) => item?.image),
    ...ctaImages,
  ].filter(Boolean);
  const hero = cms.media.heroMediaUrl || images[0];
  const [videoOpen, setVideoOpen] = useState(false);
  const video = useMemo(
    () => getVideoEmbed(t.hero.videoUrl),
    [t.hero.videoUrl],
  );
  const heroTitleSize = Number(t.hero.titleFontSizePx) || 46;
  const heroSubtitleSize = Number(t.hero.subtitleFontSizePx) || 16;

  useEffect(() => {
    if (!videoOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVideoOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [videoOpen]);

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_45%,rgba(120,82,255,.18),transparent_54%)]" />
      <SiteNav
        brand={cms.brand}
        nav={t.nav}
        lang={lang}
        dashboardHref={dashboardHref}
      />
      <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 px-4 pb-14 pt-10 sm:px-5 sm:pb-16 sm:pt-12 md:grid-cols-[.9fr_1.1fr] md:px-8 md:pb-24 md:pt-24">
        <div className="z-10">
          <p className="inline-flex rounded-[5px] bg-[#f1edff] px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#6941d9]">
            <Sparkles className="mr-2 size-3.5" />
            {t.hero.eyebrow}
          </p>
          <h1
            className={lang === "gr" ? "mt-6 max-w-[620px] font-bold leading-[0.9] tracking-[-.04em] text-[#080808] sm:mt-7 [&_div]:m-0 [&_div]:block [&_div]:leading-[0.9] [&_p]:m-0 [&_p]:leading-[0.9]" : "mt-6 max-w-[620px] font-bold leading-[1.04] tracking-[-.04em] text-[#080808] sm:mt-7 [&_div]:m-0 [&_div]:block [&_div]:leading-[1.04] [&_p]:m-0 [&_p]:leading-[1.04]"}
            style={{
              fontSize: lang === "gr" ? `clamp(${Math.min(32, heroTitleSize)}px, 7vw, ${heroTitleSize}px)` : `clamp(${Math.min(32, heroTitleSize)}px, 4vw, ${heroTitleSize}px)`,
            }}
            dangerouslySetInnerHTML={{ __html: compactRichHeading(t.hero.title) }}
          />
          <p
            className="mt-6 max-w-[470px] whitespace-pre-line leading-7 text-[#5f5f67] sm:mt-7 sm:leading-8"
            style={{
              fontSize: `clamp(${Math.min(15, heroSubtitleSize)}px, 2vw, ${heroSubtitleSize}px)`,
            }}
          >
            {t.hero.subtitle}
          </p>
          <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap sm:gap-4">
            <a
              href={dashboardHref ?? "/login"}
              className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-[6px] bg-[#5e36d6] px-6 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(94,54,214,.22)] sm:h-[52px] sm:w-auto sm:px-7"
            >
              {dashboardHref ? "Dashboard" : t.hero.cta}
              <ArrowRight className="size-4" />
            </a>
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#dad7e5] bg-white px-6 text-sm font-semibold text-[#222] transition hover:border-[#6337d8] hover:text-[#6337d8] sm:h-[52px] sm:w-auto sm:px-7"
            >
              <span className="grid size-6 place-items-center rounded-full border border-current">
                <Play className="ml-px size-3" />
              </span>
              {t.hero.secondaryCta}
            </button>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
            <div className="flex -space-x-2">
              {avatarImages
                .filter(Boolean)
                .slice(0, 6)
                .map((src, i) => (
                  <img
                    key={`${src}-${i}`}
                    src={src}
                    alt={`Reviewer ${i + 1}`}
                    className="size-9 rounded-full border-2 border-white object-cover"
                  />
                ))}
            </div>
            <div>
              <div className="flex text-[#6040d8]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3 fill-current" />
                ))}
              </div>
              <p className="mt-1 text-[10px] text-[#666]">
                {t.hero.ratingText}
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center">
          {cms.media.heroMediaType === "video" ? (
            <video
              key={cms.media.heroMediaUrl}
              src={cms.media.heroMediaUrl}
              className="block h-auto w-full object-contain"
              autoPlay
              muted
              loop
              playsInline
              controls
            />
          ) : (
            <img
              key={hero}
              src={hero}
              alt="Nikoset hero media"
              className="block h-auto w-full object-contain"
            />
          )}
        </div>
      </div>

      {videoOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setVideoOpen(false);
          }}
        >
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[14px] bg-black shadow-[0_30px_90px_rgba(0,0,0,.45)]">
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-black/60 text-white transition hover:bg-[#6337d8]"
              aria-label="Close video"
            >
              <X className="size-5" />
            </button>
            <div className="aspect-video w-full bg-black">
              {video.kind === "iframe" && (
                <iframe
                  key={video.src}
                  src={video.src}
                  title={t.hero.secondaryCta}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )}
              {video.kind === "video" && (
                <video
                  key={video.src}
                  src={video.src}
                  className="h-full w-full"
                  controls
                  autoPlay
                  playsInline
                />
              )}
              {video.kind === "empty" && (
                <div className="grid h-full place-items-center px-6 text-center text-white">
                  <div>
                    <Play className="mx-auto size-12 text-[#8b63ee]" />
                    <p className="mt-4 text-lg font-semibold">
                      Video is not configured yet.
                    </p>
                    <p className="mt-2 text-sm text-white/65">
                      Add a YouTube, Vimeo, MP4, WebM, or OGG URL in Admin â†’
                      Homepage CMS â†’ Hero section.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


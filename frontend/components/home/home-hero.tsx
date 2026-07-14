"use client";

import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/home/site-nav";
import { useHomeCms } from "@/api-hooks/use-home-cms";
import type { HomeCmsData, HomeLanguage } from "@/lib/home-cms";

function lines(text: string) {
  return text.split("\n").map((line, index, all) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < all.length - 1 && <br />}
    </span>
  ));
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
  const heroImage = cms.media.heroMediaUrl || t.workflow.tabs[0]?.image || t.gallery.tabs[0]?.image;
  const previewImages = [heroImage, ...t.workflow.tabs.map((tab) => tab.image), ...t.cta.images].filter(Boolean).slice(0, 3);

  return (
    <section className="relative overflow-hidden bg-[#F8F7F4]">
      <SiteNav brand={cms.brand} nav={t.nav} lang={lang} dashboardHref={dashboardHref} />
      <div className="mx-auto grid min-h-[620px] max-w-[1240px] items-center gap-10 px-5 pb-10 pt-8 md:grid-cols-[0.86fr_1.14fr] md:px-7 md:pb-0 lg:px-8">
        <div className="relative z-10 max-w-[520px]">
          <p className="mb-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#7A5CE8]">
            <Sparkles className="size-3" />
            {t.hero.eyebrow}
          </p>
          <h1 className="text-[46px] leading-[0.98] text-[#111] sm:text-[64px] lg:text-[76px]">
            {lines(t.hero.title)}
          </h1>
          <p className="mt-7 max-w-[390px] text-[15px] leading-7 text-[#57524C]">{t.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Button asChild className="h-12 rounded-[6px] bg-[#050505] px-6 text-sm font-bold text-white hover:bg-[#252525]">
              <a href={dashboardHref ?? "/register"}>
                {dashboardHref ? "Dashboard" : t.hero.cta}
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <a href="/pricing" className="inline-flex h-12 items-center gap-3 text-sm font-bold text-[#151515]">
              Watch Demo
              <Play className="size-4 fill-transparent" />
            </a>
          </div>
          <div className="mt-9 flex max-w-[430px] flex-wrap gap-x-4 gap-y-3 pb-8 pr-4 text-[11px] font-medium leading-5 text-[#77716A] sm:pb-10 md:pb-14">
            <span>No credit card required</span>
            <span className="text-[#C7A56B]">+</span>
            <span>Free forever plan</span>
            <span className="text-[#C7A56B]">+</span>
            <span>Cancel anytime</span>
          </div>
        </div>
        <div className="relative min-h-[420px] md:min-h-[620px]">
          {cms.media.heroMediaType === "video" && heroImage ? (
            <video className="absolute inset-0 h-full w-full object-cover object-center md:object-[58%_center]" src={heroImage} autoPlay muted loop playsInline />
          ) : (
            <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center md:object-[58%_center]" />
          )}
          <div className="absolute inset-y-0 left-0 hidden w-48 bg-gradient-to-r from-[#F8F7F4] to-transparent md:block" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F8F7F4] to-transparent" />
          <div className="absolute bottom-8 right-2 w-[300px] rounded-[8px] bg-white/95 p-4 shadow-[0_18px_55px_rgba(45,38,30,0.18)] backdrop-blur md:right-8">
            <p className="text-[10px] font-black text-[#7A5CE8]">+ New Gallery</p>
            <h3 className="mt-1 font-heading text-2xl leading-none text-[#111]">{t.gallery.tabs[0]?.title || t.gallery.tabs[0]?.label}</h3>
            <p className="mt-1 text-[11px] font-medium text-[#6B655F]">124 Photos · Client Access</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {previewImages.map((image, index) => (
                <img key={`${image}-${index}`} src={image} alt="" className="h-16 rounded-[5px] object-cover" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/home/site-nav";
import { useHomeCms } from "@/api-hooks/use-home-cms";
import type { HomeCmsData, HomeLanguage } from "@/lib/home-cms";

function lines(text: string) {
  return text.split("\n").map((line, index, all) => (
    <span key={`${line}-${index}`}>{line}{index < all.length - 1 && <br />}</span>
  ));
}

export function HomeHero({ initialCms, requestedLanguage, dashboardHref }: {
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

  return (
    <section className="relative min-h-[720px] overflow-hidden text-white md:min-h-[820px]">
      {cms.media.heroMediaType === "video" && cms.media.heroMediaUrl ? (
        <video className="absolute inset-0 h-full w-full object-cover" src={cms.media.heroMediaUrl} autoPlay muted loop playsInline />
      ) : (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${cms.media.heroMediaUrl}')` }} />
      )}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.68),rgba(0,0,0,0.18)_55%,rgba(0,0,0,0.5))]" />
      <SiteNav brand={cms.brand} nav={t.nav} lang={lang} dashboardHref={dashboardHref} />
      <div className="relative z-10 mx-auto flex min-h-[620px] w-full max-w-[1240px] items-center px-5 pt-6 md:min-h-[720px] md:px-7 lg:px-8">
        <div className="max-w-[760px] pt-10 md:pt-16">
          <p className="mb-5 text-xs font-bold tracking-wide sm:text-sm md:mb-7">{t.hero.eyebrow}</p>
          <h1 className="max-w-[760px] text-4xl font-semibold leading-[1.18] tracking-normal sm:text-5xl md:text-[52px] md:leading-[1.28]">{lines(t.hero.title)}</h1>
          <p className="mt-5 max-w-[760px] text-base font-semibold leading-7 text-white/90 sm:text-lg md:mt-6">{t.hero.subtitle}</p>
          <Button asChild className="mt-8 h-11 min-w-40 rounded-none bg-[#22bda7] text-base font-bold text-white hover:bg-[#19a995]">
            <a href="/register">{t.hero.cta}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

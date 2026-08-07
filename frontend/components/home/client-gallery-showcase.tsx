"use client";

import { useEffect, useState } from "react";
import type { HomeContent } from "@/lib/home-cms";

export function ClientGalleryShowcase({ section }: { section: HomeContent["clientGallery"] }) {
  const tabs = Array.isArray(section.tabs) ? section.tabs.filter((tab) => tab?.label) : [];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= tabs.length) setActive(0);
  }, [active, tabs.length]);

  const current = tabs[active] ?? tabs[0];
  if (!current) return null;

  return (
    <section className="overflow-hidden bg-white px-4 py-16 sm:px-5 sm:py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1180px] text-center">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6337d8]">{section.eyebrow}</p>
        <h2 className="mx-auto mt-5 max-w-[720px] text-3xl font-bold leading-[1.08] tracking-[-.035em] sm:text-4xl md:text-[44px]">{section.title}</h2>
        <p className="mx-auto mt-5 max-w-[700px] text-sm leading-7 text-[#666]">{section.subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
          {tabs.map((tab, index) => (
            <button
              key={`${tab.value}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition ${active === index ? "bg-[#6337d8] text-white shadow-[0_8px_24px_rgba(99,55,216,.22)]" : "bg-[#f7f5fb] text-[#4e485b] hover:bg-[#efeafd] hover:text-[#6337d8]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative mx-auto mt-10 max-w-[1000px] overflow-hidden rounded-[22px] border border-[#e8e3f2] bg-[#f5f2fb] p-3 shadow-[0_28px_70px_rgba(47,28,93,.14)] sm:p-5">
          <div className="overflow-hidden rounded-[16px] bg-white">
            <img
              key={current.image}
              src={current.image}
              alt={current.title || current.label}
              className="aspect-[16/9] w-full object-cover transition duration-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

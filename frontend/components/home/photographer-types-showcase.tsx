"use client";

import { useMemo, useState } from "react";
import type { GalleryTab, HomeContent } from "@/lib/home-cms";

type Props = {
  section: HomeContent["photographerTypes"];
};

export function PhotographerTypesShowcase({ section }: Props) {
  const tabs = Array.isArray(section?.tabs) ? section.tabs.filter((tab) => tab?.label) : [];
  const [activeValue, setActiveValue] = useState(tabs[0]?.value ?? "");
  const active = useMemo<GalleryTab | undefined>(
    () => tabs.find((tab) => tab.value === activeValue) ?? tabs[0],
    [tabs, activeValue],
  );

  if (!tabs.length) return null;

  return (
    <section className="bg-white px-4 py-16 sm:px-5 sm:py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1180px]">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6337d8]">{section.eyebrow}</p>
          <h2 className="mt-5 text-3xl font-bold tracking-[-.035em] sm:text-4xl">{section.title}</h2>
          <p className="mx-auto mt-5 max-w-[660px] text-sm leading-7 text-[#666]">{section.subtitle}</p>
        </div>

        <div className="mt-12 grid items-stretch gap-8 lg:grid-cols-[1fr_250px] lg:gap-14">
          <div className="overflow-hidden bg-[#f6f1ff]">
            {active?.image ? (
              <img src={active.image} alt={active.label} className="aspect-[1.22] w-full object-cover" />
            ) : (
              <div className="grid aspect-[1.22] place-items-center bg-[#f6f1ff] text-sm text-[#7b6f98]">Upload an image for this tab</div>
            )}
          </div>

          <div className="flex flex-col justify-center gap-1 sm:grid sm:grid-cols-2 lg:flex">
            {tabs.map((tab) => {
              const selected = tab.value === active?.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveValue(tab.value)}
                  className={`w-full border-0 bg-transparent px-0 py-3 text-left text-lg font-semibold transition sm:text-xl ${selected ? "text-[#6337d8] underline decoration-2 underline-offset-4" : "text-[#b3adb9] hover:text-[#7a63c9]"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { HomeContent } from "@/lib/home-cms";

const ease = [0.22, 1, 0.36, 1] as const;

export function ClientGalleryShowcase({ section }: { section: HomeContent["clientGallery"] }) {
  const reduceMotion = useReducedMotion();
  const tabs = useMemo(() => (Array.isArray(section.tabs) ? section.tabs.filter((tab) => tab?.label) : []), [section.tabs]);
  const [activeIndex, setActiveIndex] = useState(0);
  const current = tabs[activeIndex] ?? tabs[0];
  if (!current) return null;

  return (
    <section data-home-motion-managed className="relative overflow-hidden bg-white px-4 py-16 sm:px-5 sm:py-20 md:px-8 md:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[18%] w-[34rem] rounded-full bg-[#8f73ef]/10 blur-[110px]" />
      <div className="relative mx-auto w-full max-w-[1180px] text-center">
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 38 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.9, ease }}>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6337d8]">{section.eyebrow}</p>
          <h2 className="mx-auto mt-5 max-w-[760px] text-3xl font-bold leading-[1.06] tracking-[-.04em] sm:text-4xl md:text-[46px]">{section.title}</h2>
          <p className="mx-auto mt-5 max-w-[700px] text-sm leading-7 text-[#666]">{section.subtitle}</p>
        </motion.div>
        <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
          {tabs.map((tab, index) => {
            const selected = index === activeIndex;
            return <motion.button key={`${tab.value}-${index}`} type="button" onClick={() => setActiveIndex(index)} whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }} whileTap={reduceMotion ? undefined : { scale: 0.96 }} className={`relative overflow-hidden rounded-full px-5 py-3 text-sm font-semibold ${selected ? "text-white" : "bg-[#f7f5fb] text-[#4e485b]"}`}>
              {selected && <motion.span layoutId="client-gallery-active-tab" className="absolute inset-0 bg-[#6337d8] shadow-[0_10px_28px_rgba(99,55,216,.28)]" transition={{ type: "spring", stiffness: 300, damping: 26 }} />}
              <span className="relative z-10">{tab.label}</span>
            </motion.button>;
          })}
        </div>
        <div className="relative mx-auto mt-9 max-w-[1000px] overflow-hidden rounded-[24px] border border-[#e6e0f2] bg-[#f5f2fb] p-3 shadow-[0_34px_90px_rgba(47,28,93,.16)] sm:p-5">
          <div className="overflow-hidden rounded-[17px] bg-white">
            <AnimatePresence mode="wait" initial={false}>
              {current.mediaType === "video" ? <motion.video key={current.image || current.value} src={current.image} className="aspect-[16/9] w-full object-cover" autoPlay muted loop playsInline initial={reduceMotion ? false : { opacity: 0, scale: 1.08, filter: "blur(14px)", x: 70 }} animate={reduceMotion ? undefined : { opacity: 1, scale: 1, filter: "blur(0px)", x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, scale: .96, filter: "blur(10px)", x: -55 }} transition={{ duration: .72, ease }} /> : <motion.img key={current.image || current.value} src={current.image} alt={current.title || current.label} className="aspect-[16/9] w-full object-cover" initial={reduceMotion ? false : { opacity: 0, scale: 1.08, filter: "blur(14px)", x: 70 }} animate={reduceMotion ? undefined : { opacity: 1, scale: 1, filter: "blur(0px)", x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, scale: .96, filter: "blur(10px)", x: -55 }} transition={{ duration: .72, ease }} />}
            </AnimatePresence>
          </div>
          <motion.div className="absolute bottom-0 left-0 h-1 bg-[#6337d8]" animate={{ width: `${((activeIndex + 1) / tabs.length) * 100}%` }} transition={{ type: "spring", stiffness: 180, damping: 26 }} />
        </div>
      </div>
    </section>
  );
}
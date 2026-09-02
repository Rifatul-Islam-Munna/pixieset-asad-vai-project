"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { GalleryTab, HomeContent } from "@/lib/home-cms";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = { section: HomeContent["photographerTypes"] };

export function PhotographerTypesShowcase({ section }: Props) {
  const reduceMotion = useReducedMotion();
  const tabs = Array.isArray(section.tabs) ? section.tabs.filter((tab) => tab?.label) : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const active: GalleryTab | undefined = tabs[activeIndex] ?? tabs[0];
  if (!active) return null;

  return (
    <section data-home-motion-managed className="relative overflow-hidden bg-white px-4 py-16 sm:px-5 sm:py-20 md:px-8 md:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgba(99,55,216,.08),transparent_34%),radial-gradient(circle_at_82%_45%,rgba(99,55,216,.05),transparent_30%)]" />
      <div className="relative mx-auto w-full max-w-[1180px]">
        <motion.div className="text-center" initial={reduceMotion ? false : { opacity: 0, y: 34 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .4 }} transition={{ duration: .85, ease }}>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6337d8]">{section.eyebrow}</p>
          <h2 className="mt-5 text-3xl font-bold tracking-[-.04em] sm:text-4xl md:text-[44px]">{section.title}</h2>
          <p className="mx-auto mt-5 max-w-[660px] text-sm leading-7 text-[#666]">{section.subtitle}</p>
        </motion.div>
        <div className="mt-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-14">
          <div className="relative overflow-hidden rounded-[22px] bg-[#f6f1ff] shadow-[0_32px_90px_rgba(54,35,95,.14)]">
            <AnimatePresence mode="wait" initial={false}>
              {active.image ? (active.mediaType === "video" ? <motion.video key={active.image || active.value} src={active.image} className="aspect-[1.28] w-full object-cover" autoPlay muted loop playsInline initial={reduceMotion ? false : { opacity: 0, scale: 1.12, x: 80, filter: "blur(16px)" }} animate={reduceMotion ? undefined : { opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }} exit={reduceMotion ? undefined : { opacity: 0, scale: .95, x: -65, filter: "blur(12px)" }} transition={{ duration: .76, ease }} /> : <motion.img key={active.image || active.value} src={active.image} alt={active.label} className="aspect-[1.28] w-full object-cover" initial={reduceMotion ? false : { opacity: 0, scale: 1.12, x: 80, filter: "blur(16px)" }} animate={reduceMotion ? undefined : { opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }} exit={reduceMotion ? undefined : { opacity: 0, scale: .95, x: -65, filter: "blur(12px)" }} transition={{ duration: .76, ease }} />) : <motion.div key="empty" className="grid aspect-[1.28] place-items-center bg-[#f6f1ff] text-sm text-[#7b6f98]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Upload an image, GIF, or video for this tab</motion.div>}
            </AnimatePresence>
            <motion.div className="absolute inset-x-0 bottom-0 h-1 bg-[#6337d8]" animate={{ scaleX: (activeIndex + 1) / tabs.length }} style={{ transformOrigin: "left" }} transition={{ type: "spring", stiffness: 180, damping: 25 }} />
          </div>
          <div className="relative flex flex-col justify-center gap-1">
            {tabs.map((tab, index) => {
              const selected = index === activeIndex;
              return <motion.button key={tab.value} type="button" onClick={() => setActiveIndex(index)} whileHover={reduceMotion ? undefined : { x: 8 }} whileTap={reduceMotion ? undefined : { scale: .98 }} className={`group relative w-full overflow-hidden px-0 py-3 text-left text-lg font-semibold transition sm:text-xl ${selected ? "text-[#6337d8]" : "text-[#b2acba] hover:text-[#7a63c9]"}`}>
                {selected && <motion.span layoutId="photographer-active-line" className="absolute bottom-1 left-0 h-[2px] bg-[#6337d8]" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: .55, ease }} />}
                <span className="mr-3 text-xs tabular-nums opacity-45">{String(index + 1).padStart(2, "0")}</span>{tab.label}
              </motion.button>;
            })}
            <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.18em] text-[#9d95a8]"><span>{activeIndex + 1}</span><div className="h-px flex-1 bg-[#ddd8e4]" /><span>{tabs.length}</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
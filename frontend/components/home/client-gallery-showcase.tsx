"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { HomeContent } from "@/lib/home-cms";

const ease = [0.22, 1, 0.36, 1] as const;

export function ClientGalleryShowcase({ section }: { section: HomeContent["clientGallery"] }) {
  const reduceMotion = useReducedMotion();
  const tabs = useMemo(
    () => (Array.isArray(section.tabs) ? section.tabs.filter((tab) => tab?.label) : []),
    [section.tabs],
  );
  const [activeValue, setActiveValue] = useState(tabs[0]?.value ?? "");
  const current = tabs.find((tab) => tab.value === activeValue) ?? tabs[0];
  if (!current) return null;

  return (
    <motion.section
      data-home-motion-managed
      className="overflow-hidden bg-white px-4 py-16 sm:px-5 sm:py-20 md:px-8 md:py-24"
      initial={reduceMotion ? false : { opacity: 0 }}
      whileInView={reduceMotion ? undefined : { opacity: 1 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.55 }}
    >
      <div className="mx-auto max-w-[1180px] text-center">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.7, ease }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6337d8]">{section.eyebrow}</p>
          <h2 className="mx-auto mt-5 max-w-[720px] text-3xl font-bold leading-[1.08] tracking-[-.035em] sm:text-4xl md:text-[44px]">{section.title}</h2>
          <p className="mx-auto mt-5 max-w-[700px] text-sm leading-7 text-[#666]">{section.subtitle}</p>
        </motion.div>
        <motion.div
          className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.65, delay: 0.12, ease }}
        >
          {tabs.map((tab, index) => {
            const selected = current.value === tab.value;
            return (
              <motion.button
                key={`${tab.value}-${index}`}
                type="button"
                onClick={() => setActiveValue(tab.value)}
                whileHover={reduceMotion ? undefined : { y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className={`relative overflow-hidden rounded-full px-5 py-3 text-sm font-semibold transition ${selected ? "text-white" : "bg-[#f7f5fb] text-[#4e485b] hover:bg-[#efeafd] hover:text-[#6337d8]"}`}
              >
                {selected && (
                  <motion.span
                    layoutId="client-gallery-active-tab"
                    className="absolute inset-0 bg-[#6337d8] shadow-[0_8px_24px_rgba(99,55,216,.22)]"
                    transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            );
          })}
        </motion.div>
        <motion.div
          className="relative mx-auto mt-10 max-w-[1000px] overflow-hidden rounded-[22px] border border-[#e8e3f2] bg-[#f5f2fb] p-3 shadow-[0_28px_70px_rgba(47,28,93,.14)] sm:p-5"
          initial={reduceMotion ? false : { opacity: 0, y: 34, scale: 0.985 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, delay: 0.18, ease }}
        >
          <div className="overflow-hidden rounded-[16px] bg-white">
            <AnimatePresence mode="wait" initial={false}>
              {current.mediaType === "video" ? (
                <motion.video
                  key={current.image || current.value}
                  src={current.image}
                  className="aspect-[16/9] w-full object-cover"
                  autoPlay muted loop playsInline
                  initial={reduceMotion ? false : { opacity: 0, scale: 1.035, x: 18 }}
                  animate={reduceMotion ? undefined : { opacity: 1, scale: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, scale: 0.985, x: -12 }}
                  transition={{ duration: 0.48, ease }}
                />
              ) : (
                <motion.img
                  key={current.image || current.value}
                  src={current.image}
                  alt={current.title || current.label}
                  className="aspect-[16/9] w-full object-cover"
                  initial={reduceMotion ? false : { opacity: 0, scale: 1.035, x: 18 }}
                  animate={reduceMotion ? undefined : { opacity: 1, scale: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, scale: 0.985, x: -12 }}
                  transition={{ duration: 0.48, ease }}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

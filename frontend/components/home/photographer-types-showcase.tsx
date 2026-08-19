"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { GalleryTab, HomeContent } from "@/lib/home-cms";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  section: HomeContent["photographerTypes"];
};

export function PhotographerTypesShowcase({ section }: Props) {
  const reduceMotion = useReducedMotion();
  const tabs = Array.isArray(section?.tabs) ? section.tabs.filter((tab) => tab?.label) : [];
  const [activeValue, setActiveValue] = useState(tabs[0]?.value ?? "");
  const active: GalleryTab | undefined = tabs.find((tab) => tab.value === activeValue) ?? tabs[0];

  if (!tabs.length) return null;

  return (
    <motion.section
      data-home-motion-managed
      className="bg-white px-4 py-16 sm:px-5 sm:py-20 md:px-8 md:py-24"
      initial={reduceMotion ? false : { opacity: 0 }}
      whileInView={reduceMotion ? undefined : { opacity: 1 }}
      viewport={{ once: true, amount: 0.12 }}
    >
      <div className="mx-auto max-w-[1180px]">
        <motion.div
          className="text-center"
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.7, ease }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6337d8]">{section.eyebrow}</p>
          <h2 className="mt-5 text-3xl font-bold tracking-[-.035em] sm:text-4xl">{section.title}</h2>
          <p className="mx-auto mt-5 max-w-[660px] text-sm leading-7 text-[#666]">{section.subtitle}</p>
        </motion.div>

        <div className="mt-12 grid items-stretch gap-8 lg:grid-cols-[1fr_250px] lg:gap-14">
          <motion.div
            className="overflow-hidden bg-[#f6f1ff]"
            initial={reduceMotion ? false : { opacity: 0, x: -34, scale: 0.985 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.8, delay: 0.08, ease }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {active?.image ? (
                active.mediaType === "video" ? (
                  <motion.video
                    key={active.image || active.value}
                    src={active.image}
                    className="aspect-[1.22] w-full object-cover"
                    autoPlay muted loop playsInline
                    initial={reduceMotion ? false : { opacity: 0, scale: 1.04 }}
                    animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, scale: 0.985 }}
                    transition={{ duration: 0.5, ease }}
                  />
                ) : (
                  <motion.img
                    key={active.image || active.value}
                    src={active.image}
                    alt={active.label}
                    className="aspect-[1.22] w-full object-cover"
                    initial={reduceMotion ? false : { opacity: 0, scale: 1.04 }}
                    animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, scale: 0.985 }}
                    transition={{ duration: 0.5, ease }}
                  />
                )
              ) : (
                <motion.div
                  key="empty"
                  className="grid aspect-[1.22] place-items-center bg-[#f6f1ff] text-sm text-[#7b6f98]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Upload an image, GIF, or video for this tab
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            className="flex flex-col justify-center gap-1 sm:grid sm:grid-cols-2 lg:flex"
            initial={reduceMotion ? false : { opacity: 0, x: 30 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.72, delay: 0.16, ease }}
          >
            {tabs.map((tab, index) => {
              const selected = tab.value === active?.value;
              return (
                <motion.button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveValue(tab.value)}
                  whileHover={reduceMotion ? undefined : { x: 6 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  className={`w-full border-0 bg-transparent px-0 py-3 text-left text-lg font-semibold transition sm:text-xl ${selected ? "text-[#6337d8] underline decoration-2 underline-offset-4" : "text-[#b3adb9] hover:text-[#7a63c9]"}`}
                >
                  <span className="mr-3 text-xs tabular-nums opacity-45">0{index + 1}</span>
                  {tab.label}
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

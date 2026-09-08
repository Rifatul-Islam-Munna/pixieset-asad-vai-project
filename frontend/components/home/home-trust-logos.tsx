"use client";

import { motion, useReducedMotion } from "motion/react";
import type { BrandLogo } from "@/lib/home-cms";

const ease = [0.22, 1, 0.36, 1] as const;

export function HomeTrustLogos({ heading, logos }: { heading: string; logos: BrandLogo[] }) {
  const reduceMotion = useReducedMotion();
  const visibleLogos = logos.filter((logo) => logo.name?.trim() || logo.image?.trim());
  if (!visibleLogos.length) return null;

  return (
    <section data-home-motion-managed className="bg-white px-4 py-9 text-center sm:px-5 sm:py-10 md:px-8">
      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.7 }}
        transition={{ duration: 0.55, ease }}
        className="text-[9px] font-bold uppercase tracking-[.18em] text-[#666]"
      >
        {heading}
      </motion.p>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.25 }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.075, delayChildren: 0.08 } } }}
        className="mx-auto mt-7 grid max-w-[1050px] grid-cols-2 items-center justify-items-center gap-7 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-12 sm:gap-y-6"
      >
        {visibleLogos.map((logo, index) => {
          const content = logo.image ? (
            <img src={logo.image} alt={logo.name} className="max-h-8 max-w-28 object-contain grayscale transition-[filter,opacity] duration-300 hover:grayscale-0" />
          ) : (
            <span className="text-xl font-bold text-[#888] transition-colors duration-300 hover:text-[#444]">{logo.name}</span>
          );
          return (
            <motion.div
              key={`${logo.name}-${index}`}
              variants={{
                hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.97 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.62, ease } },
              }}
              whileHover={reduceMotion ? undefined : { y: -3, scale: 1.025 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="will-change-transform"
            >
              {logo.url ? (
                <a href={logo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center" aria-label={logo.name}>
                  {content}
                </a>
              ) : content}
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

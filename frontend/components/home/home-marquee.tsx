"use client";

import FastMarquee from "react-fast-marquee";
import type { HomeContent, HomeMarqueeItem } from "@/lib/home-cms";

function MarqueeItem({ item }: { item: HomeMarqueeItem }) {
  const media = item.image?.trim();
  const content = item.type === "video" && media ? (
    <video
      src={media}
      className="h-10 w-auto max-w-44 shrink-0 object-contain sm:h-12 sm:max-w-52"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={item.text || "Marquee video"}
    />
  ) : item.type === "logo" || item.type === "image" ? (
    media ? (
      <img
        src={media}
        alt={item.text || (item.type === "logo" ? "Partner logo" : "Marquee media")}
        className="h-9 w-auto max-w-44 shrink-0 object-contain sm:h-11 sm:max-w-52"
      />
    ) : null
  ) : item.text ? (
    <span className="shrink-0 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.2em] text-[#40394f] sm:text-xs">
      {item.text}
    </span>
  ) : null;
  if (!content) return null;

  return item.url ? (
    <a href={item.url} className="mx-8 inline-flex items-center sm:mx-12" target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <span className="mx-8 inline-flex items-center sm:mx-12">{content}</span>
  );
}

export function HomeMarquee({ marquee }: { marquee: HomeContent["marquee"] }) {
  if (!marquee?.enabled || !marquee.items?.length) return null;
  const duration = Math.max(8, Number(marquee.durationSeconds) || 28);
  const speed = Math.max(24, Math.min(110, 1600 / duration));

  return (
    <section className="border-y border-[#eeeaf8] bg-[#fbfaff] py-3 sm:py-4" aria-label="Highlights">
      <FastMarquee
        direction="right"
        speed={speed}
        pauseOnHover
        autoFill
        gradient={false}
        className="overflow-hidden"
      >
        {marquee.items.map((item, index) => (
          <MarqueeItem key={item.id || `${item.type}-${index}`} item={item} />
        ))}
      </FastMarquee>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight, Check, Quote } from "lucide-react";
import type { DynamicPageSection, DynamicPageSectionItem } from "@/lib/dynamic-pages";
import { cn } from "@/lib/utils";

const toneClasses: Record<string, string> = {
  light: "bg-white text-[#171717]",
  soft: "bg-[#f7f5f1] text-[#171717]",
  dark: "bg-[#171717] text-white",
  brand: "bg-[#ede8fb] text-[#171717]",
};

const mutedClasses: Record<string, string> = {
  light: "text-[#68645f]",
  soft: "text-[#6d6962]",
  dark: "text-white/68",
  brand: "text-[#625b6f]",
};

function SectionHeading({ section }: { section: DynamicPageSection }) {
  const centered = section.alignment === "center";
  const muted = mutedClasses[section.tone || "light"] || mutedClasses.light;
  return (
    <div className={cn("max-w-3xl", centered && "mx-auto text-center")}>
      {section.eyebrow && (
        <p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#6337d8]">
          {section.eyebrow}
        </p>
      )}
      {section.title && (
        <h2 className="mt-3 text-3xl font-semibold leading-[1.05] tracking-[-.035em] sm:text-5xl">
          {section.title}
        </h2>
      )}
      {section.body && (
        <div className={cn("mt-5 whitespace-pre-line text-[16px] leading-8", muted)}>
          {section.body}
        </div>
      )}
    </div>
  );
}

function SectionButtons({ section }: { section: DynamicPageSection }) {
  const buttons = section.buttons?.length
    ? section.buttons.filter((button) => button.enabled !== false && button.label && button.url)
    : [
        section.buttonLabel && section.buttonUrl
          ? { id: undefined, newTab: false, label: section.buttonLabel, url: section.buttonUrl, style: "primary" }
          : null,
        section.secondaryButtonLabel && section.secondaryButtonUrl
          ? { id: undefined, newTab: false, label: section.secondaryButtonLabel, url: section.secondaryButtonUrl, style: "secondary" }
          : null,
      ].filter(Boolean);
  if (!buttons.length) return null;

  return (
    <div className={cn("mt-7 flex flex-wrap gap-3", section.alignment === "center" && "justify-center")}>
      {buttons.map((button, index) => {
        if (!button) return null;
        const style = button.style || "primary";
        return (
          <Link
            key={button.id || index}
            href={button.url || "#"}
            target={button.newTab ? "_blank" : undefined}
            rel={button.newTab ? "noopener noreferrer" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-bold transition hover:-translate-y-0.5",
              style === "primary" && "bg-[#171717] text-white hover:bg-[#6337d8]",
              style === "secondary" && "border border-current/15 hover:bg-black/5",
              style === "text" && "px-2 text-[#6337d8]",
            )}
          >
            {button.label}
            {style !== "secondary" && <ArrowRight className="size-4" />}
          </Link>
        );
      })}
    </div>
  );
}

function ItemGrid({
  section,
  children,
}: {
  section: DynamicPageSection;
  children: React.ReactNode;
}) {
  const columns = Math.max(2, Math.min(4, section.columns || 3));
  return (
    <div className={cn(
      "mt-10 grid gap-5",
      columns === 2 && "md:grid-cols-2",
      columns === 3 && "md:grid-cols-2 lg:grid-cols-3",
      columns === 4 && "md:grid-cols-2 lg:grid-cols-4",
    )}>
      {children}
    </div>
  );
}

function FeatureItem({ item, tone }: { item: DynamicPageSectionItem; tone: string }) {
  const dark = tone === "dark";
  return (
    <article className={cn(
      "rounded-[22px] border p-6",
      dark ? "border-white/10 bg-white/[.06]" : "border-black/[.07] bg-white/80 shadow-[0_14px_40px_rgba(34,28,23,.05)]",
    )}>
      {item.imageUrl && <img src={item.imageUrl} alt={item.title || ""} className="mb-5 aspect-[4/3] w-full rounded-[16px] object-cover" />}
      {item.eyebrow && <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#6337d8]">{item.eyebrow}</p>}
      {item.title && <h3 className="mt-2 text-xl font-semibold tracking-[-.02em]">{item.title}</h3>}
      {item.body && <p className={cn("mt-3 whitespace-pre-line text-sm leading-7", dark ? "text-white/65" : "text-[#6a665f]")}>{item.body}</p>}
      {item.linkLabel && item.linkUrl && (
        <Link href={item.linkUrl} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#6337d8]">
          {item.linkLabel}<ArrowRight className="size-4" />
        </Link>
      )}
    </article>
  );
}

export function DynamicSectionRenderer({ section }: { section: DynamicPageSection }) {
  if (section.enabled === false) return null;
  const tone = section.tone || "light";
  const toneClass = toneClasses[tone] || toneClasses.light;
  const items = section.items || [];

  if (section.type === "split") {
    const imageLeft = section.layout === "image-left";
    return (
      <section className={cn("px-5 py-16 sm:py-24", toneClass)}>
        <div className="mx-auto grid max-w-[1260px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className={cn(imageLeft ? "lg:order-2" : "lg:order-1")}>
            <SectionHeading section={section} />
            <SectionButtons section={section} />
          </div>
          <div className={cn(imageLeft ? "lg:order-1" : "lg:order-2")}>
            {section.imageUrl ? (
              <div className="overflow-hidden rounded-[28px] border border-black/[.06] bg-white shadow-[0_28px_75px_rgba(37,30,26,.12)]">
                <img src={section.imageUrl} alt={section.title || ""} className="aspect-[5/4] w-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[5/4] rounded-[28px] border border-dashed border-current/15 bg-black/[.03]" />
            )}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "rich-text") {
    return (
      <section className={cn("px-5 py-16 sm:py-24", toneClass)}>
        <div className="mx-auto max-w-[980px]">
          <SectionHeading section={section} />
          <SectionButtons section={section} />
        </div>
      </section>
    );
  }

  if (section.type === "feature-grid") {
    return (
      <section className={cn("px-5 py-16 sm:py-24", toneClass)}>
        <div className="mx-auto max-w-[1260px]">
          <SectionHeading section={section} />
          <ItemGrid section={section}>
            {items.map((item, index) => <FeatureItem key={item.id || index} item={item} tone={tone} />)}
          </ItemGrid>
          <SectionButtons section={section} />
        </div>
      </section>
    );
  }

  if (section.type === "gallery") {
    return (
      <section className={cn("px-5 py-16 sm:py-24", toneClass)}>
        <div className="mx-auto max-w-[1320px]">
          <SectionHeading section={section} />
          <ItemGrid section={section}>
            {items.map((item, index) => (
              <figure key={item.id || index} className="group">
                <div className="overflow-hidden rounded-[22px] bg-black/[.04]">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.title || section.title || ""} className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.035]" />}
                </div>
                {(item.title || item.body) && (
                  <figcaption className="px-1 pt-4">
                    {item.title && <p className="font-semibold">{item.title}</p>}
                    {item.body && <p className={cn("mt-1 text-sm leading-6", mutedClasses[tone] || mutedClasses.light)}>{item.body}</p>}
                  </figcaption>
                )}
              </figure>
            ))}
          </ItemGrid>
          <SectionButtons section={section} />
        </div>
      </section>
    );
  }

  if (section.type === "stats") {
    return (
      <section className={cn("px-5 py-14 sm:py-20", toneClass)}>
        <div className="mx-auto max-w-[1260px]">
          <SectionHeading section={{ ...section, alignment: section.alignment || "center" }} />
          <ItemGrid section={section}>
            {items.map((item, index) => (
              <div key={item.id || index} className="border-t border-current/15 pt-5">
                <p className="text-4xl font-semibold tracking-[-.045em] sm:text-5xl">{item.value || item.title}</p>
                <p className={cn("mt-2 text-sm font-semibold", mutedClasses[tone] || mutedClasses.light)}>{item.label || item.body}</p>
              </div>
            ))}
          </ItemGrid>
          <SectionButtons section={section} />
        </div>
      </section>
    );
  }

  if (section.type === "testimonial") {
    return (
      <section className={cn("px-5 py-16 sm:py-24", toneClass)}>
        <div className="mx-auto max-w-[1120px]">
          <SectionHeading section={{ ...section, alignment: "center" }} />
          <ItemGrid section={{ ...section, columns: Math.min(3, section.columns || 2) }}>
            {items.map((item, index) => (
              <blockquote key={item.id || index} className={cn("rounded-[24px] border p-7", tone === "dark" ? "border-white/10 bg-white/[.06]" : "border-black/[.07] bg-white")}>
                <Quote className="size-8 text-[#6337d8]" />
                <p className="mt-5 text-lg leading-8">“{item.body || item.title}”</p>
                <footer className="mt-6 flex items-center gap-3">
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="size-11 rounded-full object-cover" />}
                  <div>
                    {item.title && <p className="text-sm font-bold">{item.title}</p>}
                    {item.label && <p className={cn("text-xs", mutedClasses[tone] || mutedClasses.light)}>{item.label}</p>}
                  </div>
                </footer>
              </blockquote>
            ))}
          </ItemGrid>
          <SectionButtons section={{ ...section, alignment: "center" }} />
        </div>
      </section>
    );
  }

  if (section.type === "cta") {
    return (
      <section className="bg-white px-5 py-14 sm:py-20">
        <div className={cn("mx-auto max-w-[1180px] overflow-hidden rounded-[32px] px-6 py-12 sm:px-12 sm:py-16", toneClass, tone === "light" && "border border-black/[.07] bg-[#f7f5f1]")}>
          <SectionHeading section={{ ...section, alignment: "center" }} />
          <SectionButtons section={{ ...section, alignment: "center" }} />
        </div>
      </section>
    );
  }

  if (section.type === "logo-strip") {
    return (
      <section className={cn("px-5 py-12 sm:py-16", toneClass)}>
        <div className="mx-auto max-w-[1260px]">
          <SectionHeading section={{ ...section, alignment: "center" }} />
          <div className="mt-9 grid grid-cols-2 items-center gap-8 sm:grid-cols-3 lg:grid-cols-6">
            {items.map((item, index) => (
              <div key={item.id || index} className="flex min-h-16 items-center justify-center">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.title || "Brand"} className="max-h-10 max-w-[150px] object-contain grayscale opacity-75" /> : <span className="text-center text-sm font-semibold opacity-60">{item.title}</span>}
              </div>
            ))}
          </div>
          <SectionButtons section={{ ...section, alignment: "center" }} />
        </div>
      </section>
    );
  }

  if (section.type === "steps") {
    return (
      <section className={cn("px-5 py-16 sm:py-24", toneClass)}>
        <div className="mx-auto max-w-[1160px]">
          <SectionHeading section={section} />
          <div className="mt-12 grid gap-0">
            {items.map((item, index) => (
              <div key={item.id || index} className="grid gap-5 border-t border-current/10 py-7 sm:grid-cols-[70px_1fr]">
                <div className="text-3xl font-semibold tracking-[-.04em] text-[#6337d8]">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  {item.title && <h3 className="text-xl font-semibold">{item.title}</h3>}
                  {item.body && <p className={cn("mt-2 max-w-3xl whitespace-pre-line text-sm leading-7", mutedClasses[tone] || mutedClasses.light)}>{item.body}</p>}
                  {item.linkLabel && item.linkUrl && <Link href={item.linkUrl} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#6337d8]">{item.linkLabel}<ArrowRight className="size-4" /></Link>}
                </div>
              </div>
            ))}
          </div>
          <SectionButtons section={section} />
        </div>
      </section>
    );
  }

  return null;
}

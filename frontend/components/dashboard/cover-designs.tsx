import { cn } from "@/lib/utils";
import type { BrandSettings, CustomCoverTemplate } from "@/lib/home-cms";

export const coverOptions = [
  ["Center", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"],
  ["Left", "https://images.unsplash.com/photo-1508808787069-421e7986016e?auto=format&fit=crop&w=900&q=80"],
  ["Novel", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80"],
  ["Vintage", "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80"],
  ["Frame", "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=900&q=80"],
  ["Stripe", "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80"],
  ["Divider", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80"],
  ["Journal", "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80"],
  ["Stamp", "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=900&q=80"],
  ["Outline", "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=80"],
  ["Classic", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"],
  ["Split", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80"],
  ["Editorial", "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80"],
  ["Gallery", "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=80"],
  ["Minimal", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80"],
  ["Banner", "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=900&q=80"],
  ["Portal", "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=900&q=80"],
  ["Maison", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80"],
  ["Ceremony Wide", "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80"],
  ["Cinematic", "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1200&q=80"],
  ["Lower Left", "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80"],
  ["Lower Split", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"],
  ["Top Frame", "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1200&q=80"],
  ["Side Button", "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80"],
  ["Soft Center", "https://images.unsplash.com/photo-1523438097201-512ae7d59c44?auto=format&fit=crop&w=1200&q=80"],
  ["Edge Title", "https://images.unsplash.com/photo-1502635385003-ee1e6a1a742d?auto=format&fit=crop&w=1200&q=80"],
  ["Fine Art", "https://images.unsplash.com/photo-1513279922550-250c2129b13a?auto=format&fit=crop&w=1200&q=80"],
  ["Magazine", "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80"],
  ["Mono Frame", "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80"],
  ["Quiet Luxury", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"],
] as const;

export type CoverPreviewSettings = {
  cover: string;
  coverSmallTitle?: string;
  coverTitle?: string;
  coverDate?: string;
  coverButtonText?: string;
  showCoverSmallTitle?: boolean;
  showCoverTitle?: boolean;
  showCoverDate?: boolean;
  showCoverButton?: boolean;
  customCoverTemplate?: CustomCoverTemplate;
  branding?: Partial<BrandSettings>;
};

export function coverImage(name: string) {
  return coverOptions.find(([item]) => item === name)?.[1] ?? coverOptions[0][1];
}

export function CoverPreview({
  design,
  image,
  compact = false,
  className,
}: {
  design: CoverPreviewSettings;
  image?: string;
  compact?: boolean;
  className?: string;
}) {
  const src = image || coverImage(design.cover);
  if (design.customCoverTemplate) {
    return (
      <CustomCoverPreview
        template={design.customCoverTemplate}
        branding={design.branding}
        image={image}
        compact={compact}
        className={className}
        title={design.coverTitle}
        subtitle={design.coverSmallTitle}
        date={design.coverDate}
        buttonText={design.coverButtonText}
      />
    );
  }
  const showSmall = design.showCoverSmallTitle !== false;
  const showTitle = design.showCoverTitle !== false;
  const showDate = design.showCoverDate !== false;
  const showButton = design.showCoverButton !== false;
  const smallTitle = design.coverSmallTitle || "Avery Studio";
  const title = design.coverTitle || "Sarah & Daniel";
  const date = design.coverDate || "June 14, 2026";
  const buttonText = design.coverButtonText || "View Gallery";
  const sampleTitle = compact ? "TITLE" : title;
  const text = (
    <div className={cn("flex flex-col gap-2", compact && "gap-1")}>
      {!compact && showSmall && <p className="text-xs uppercase tracking-[0.28em]">{smallTitle}</p>}
      {showTitle && <h3 className={cn("break-words font-semibold uppercase", compact ? "text-[11px] tracking-[0.24em]" : "text-2xl tracking-[0.12em] sm:text-4xl sm:tracking-[0.18em] md:text-6xl")}>{sampleTitle}</h3>}
      {!compact && showDate && <p className="text-sm uppercase tracking-[0.22em]">{date}</p>}
      {!compact && showButton && (
        <span className="mt-4 inline-flex w-fit max-w-full border px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] sm:px-6 sm:tracking-[0.2em]">
          {buttonText}
        </span>
      )}
    </div>
  );

  if (design.cover === "Ceremony Wide") {
    return (
      <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-[#222] text-white", compact && "min-h-0", className)}>
        <img src={src} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/38 via-black/10 to-black/20" />
        <div className={cn("absolute left-5 top-[58%] max-w-[82%] -translate-y-1/2 sm:left-8 sm:max-w-[72%]", compact && "left-3 max-w-[68%]")}>
          {!compact && showSmall && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em]">{smallTitle}</p>}
          {showTitle && <h3 className={cn("break-words font-medium uppercase leading-[0.96]", compact ? "text-[13px] tracking-[0.12em]" : "text-3xl tracking-[0.04em] sm:text-4xl md:text-6xl")}>{sampleTitle}</h3>}
          {!compact && showDate && <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em]">{date}</p>}
        </div>
        {!compact && showButton && (
          <span className="absolute bottom-5 right-5 inline-flex max-w-[calc(100%-2.5rem)] border border-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] sm:bottom-10 sm:right-8 sm:px-7 sm:tracking-[0.16em]">
            {buttonText}
          </span>
        )}
      </div>
    );
  }

  if (design.cover === "Cinematic") {
    return (
      <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-black text-white", compact && "min-h-0", className)}>
        <img src={src} alt="" className="h-full w-full object-cover opacity-80" />
        <div className="absolute inset-x-0 top-0 h-[16%] bg-black/55" />
        <div className="absolute inset-x-0 bottom-0 h-[16%] bg-black/55" />
        <div className="absolute inset-x-[8%] top-[19%] border-t border-white/70" />
        <div className="absolute inset-x-[8%] bottom-[19%] border-t border-white/70" />
        <div className={cn("absolute bottom-[23%] left-[8%] max-w-[78%] sm:left-[10%] sm:max-w-[62%]", compact && "bottom-3 left-3 max-w-[70%]")}>{text}</div>
      </div>
    );
  }

  if (design.cover === "Lower Left" || design.cover === "Lower Split") {
    return (
      <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-[#1c1c1c] text-white", compact && "min-h-0", className)}>
        <img src={src} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {design.cover === "Lower Split" && <div className="absolute bottom-0 left-0 right-0 h-[34%] bg-white/92" />}
        <div className={cn("absolute bottom-5 left-5 max-w-[82%] sm:bottom-8 sm:left-8 sm:max-w-[64%]", design.cover === "Lower Split" && "text-[#222] [text-shadow:none]", compact && "bottom-3 left-3 max-w-[75%]")}>{text}</div>
      </div>
    );
  }

  if (design.cover === "Top Frame" || design.cover === "Side Button") {
    return (
      <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-[#222] text-white", compact && "min-h-0", className)}>
        <img src={src} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/24" />
        <div className={cn("absolute inset-6 border border-white/75", compact && "inset-2")} />
        <div className={cn("absolute left-5 top-5 max-w-[82%] sm:left-8 sm:top-8 sm:max-w-[70%]", compact && "left-3 top-3 max-w-[74%]")}>{text}</div>
        {design.cover === "Side Button" && !compact && showButton && (
          <span className="absolute bottom-5 right-5 max-w-[calc(100%-2.5rem)] border border-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] sm:bottom-8 sm:right-8 sm:px-6 sm:tracking-[0.18em]">
            {buttonText}
          </span>
        )}
      </div>
    );
  }

  if (["Soft Center", "Edge Title", "Fine Art", "Magazine", "Mono Frame", "Quiet Luxury"].includes(design.cover)) {
    return (
      <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-[#f8f5f1] text-white", compact && "min-h-0", className)}>
        <img
          src={src}
          alt=""
          className={cn(
            "h-full w-full object-cover",
            design.cover === "Mono Frame" && "grayscale",
            design.cover === "Quiet Luxury" && "scale-105 opacity-90",
          )}
        />
        <div className={cn("absolute inset-0", design.cover === "Soft Center" ? "bg-black/18" : "bg-black/30")} />
        {design.cover === "Fine Art" && <div className="absolute inset-[12%] border border-white/80" />}
        {design.cover === "Magazine" && <div className="absolute left-0 top-0 h-full w-[42%] bg-white/90" />}
        {design.cover === "Quiet Luxury" && <div className="absolute inset-x-[9%] bottom-[18%] border-t border-white/80" />}
        <div
          className={cn(
            "absolute p-6",
            design.cover === "Soft Center" && "left-1/2 top-1/2 max-w-[88%] -translate-x-1/2 -translate-y-1/2 text-center sm:max-w-[70%]",
            design.cover === "Edge Title" && "bottom-5 left-5 max-w-[82%] sm:bottom-8 sm:left-8 sm:max-w-[64%]",
            design.cover === "Fine Art" && "bottom-[16%] left-1/2 -translate-x-1/2 text-center",
            design.cover === "Magazine" && "left-4 top-1/2 max-w-[48%] -translate-y-1/2 text-[#222] [text-shadow:none] sm:left-6 sm:max-w-[36%]",
            design.cover === "Mono Frame" && "right-5 top-5 max-w-[70%] text-right sm:right-8 sm:top-8 sm:max-w-[52%]",
            design.cover === "Quiet Luxury" && "bottom-[20%] left-[8%] max-w-[78%] sm:left-[10%] sm:max-w-[62%]",
            compact && "p-2",
          )}
        >
          {text}
        </div>
      </div>
    );
  }

  if (design.cover === "Novel") {
    return (
      <div className={cn("relative grid h-full min-h-[62vh] grid-cols-1 bg-white text-[#222] sm:grid-cols-2", compact && "min-h-0", className)}>
        <div className={cn("flex items-center justify-center p-4 text-center", compact && "p-2")}>{text}</div>
        <img src={src} alt="" className={cn("h-full w-full object-cover p-3", compact && "p-2")} />
      </div>
    );
  }

  if (design.cover === "Split" || design.cover === "Journal" || design.cover === "Editorial") {
    return (
      <div className={cn("relative grid h-full min-h-[62vh] grid-cols-1 bg-white text-[#222] sm:grid-cols-2", compact && "min-h-0", className)}>
        <img src={src} alt="" className="h-full w-full object-cover" />
        <div className={cn("flex items-center p-6", design.cover === "Journal" ? "justify-start" : "justify-center text-center", compact && "p-2")}>{text}</div>
      </div>
    );
  }

  if (design.cover === "Stamp" || design.cover === "Minimal") {
    return (
      <div className={cn("relative flex h-full min-h-[62vh] flex-col items-center justify-center gap-5 bg-white text-center text-[#222]", compact && "min-h-0 gap-2", className)}>
        <img src={src} alt="" className={cn("aspect-square w-[34%] object-cover", compact && "w-[32%]")} />
        {text}
      </div>
    );
  }

  if (design.cover === "Stripe") {
    return (
      <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-[#222] text-white", compact && "min-h-0", className)}>
        <img src={src} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/28" />
        <div className="absolute left-[12%] right-[12%] top-[22%] border-t border-white" />
        <div className="absolute bottom-[22%] left-[12%] right-[12%] border-t border-white" />
        <div className={cn("absolute bottom-[22%] left-[12%] right-[12%] top-[22%] flex items-center justify-center p-6 text-center [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]", compact && "p-3")}>
          <div className={cn("flex max-w-full flex-col items-center gap-3", compact && "gap-1")}>
            {!compact && showSmall && <p className="text-xs uppercase tracking-[0.28em]">{smallTitle}</p>}
            {showTitle && <h3 className={cn("break-words font-semibold uppercase", compact ? "text-[11px] tracking-[0.24em]" : "text-2xl tracking-[0.12em] sm:text-4xl sm:tracking-[0.18em] md:text-6xl")}>{sampleTitle}</h3>}
            {!compact && showDate && <p className="text-sm uppercase tracking-[0.22em]">{date}</p>}
            {!compact && showButton && (
              <span className="mt-3 inline-flex w-fit max-w-full border px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] sm:px-6 sm:tracking-[0.2em]">
                {buttonText}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-[#222] text-white", compact && "min-h-0", className)}>
      <img src={src} alt="" className="h-full w-full object-cover" />
      <div className={cn("absolute inset-0", design.cover === "Vintage" ? "bg-white/55" : "bg-black/28")} />
      {design.cover === "Frame" && <div className={cn("absolute inset-4 border border-white", compact && "inset-2")} />}
      {design.cover === "Divider" && <div className="absolute bottom-0 left-1/2 top-0 border-l border-white" />}
      {design.cover === "Outline" && <div className={cn("absolute inset-[18%] border border-white", compact && "inset-[16%]")} />}
      {design.cover === "Banner" && <div className="absolute inset-x-0 bottom-[18%] bg-white/88 py-3 text-center text-[#222]" />}
      {design.cover === "Portal" && <div className="absolute inset-[13%] rounded-full border border-white/85" />}
      <div
        className={cn(
          "absolute p-6",
          ["Center", "Frame", "Outline", "Portal"].includes(design.cover) && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center",
          ["Left", "Classic"].includes(design.cover) && "bottom-5 left-5 max-w-[82%] text-left sm:bottom-8 sm:left-8 sm:max-w-none",
          ["Vintage", "Gallery"].includes(design.cover) && "bottom-5 left-1/2 max-w-[88%] -translate-x-1/2 text-center text-[#222] sm:bottom-8 sm:max-w-none",
          design.cover === "Divider" && "bottom-5 left-5 max-w-[82%] text-left sm:bottom-8 sm:left-8 sm:max-w-none",
          design.cover === "Banner" && "bottom-[18%] left-1/2 -translate-x-1/2 translate-y-1/2 text-center text-[#222]",
          design.cover === "Maison" && "right-5 top-5 max-w-[82%] text-right sm:right-8 sm:top-8 sm:max-w-none",
          !["Vintage", "Gallery", "Banner"].includes(design.cover) && "[text-shadow:0_2px_14px_rgba(0,0,0,0.55)]",
          compact && "p-3"
        )}
      >
        {text}
      </div>
    </div>
  );
}

function CustomCoverPreview({
  branding,
  buttonText,
  className,
  compact,
  date,
  image,
  subtitle,
  template,
  title,
}: {
  branding?: Partial<BrandSettings>;
  buttonText?: string;
  className?: string;
  compact?: boolean;
  date?: string;
  image?: string;
  subtitle?: string;
  template: CustomCoverTemplate;
  title?: string;
}) {
  const src = image || template.backgroundImage || coverOptions[0][1];
  const textMap = {
    title: title || "Gallery Title",
    subtitle: subtitle || branding?.brandText || "Studio",
    date: date || "June 14, 2026",
    button: buttonText || "View Gallery",
    brandText: branding?.brandText || template.elements.find((item) => item.type === "brandText")?.text || "Brand",
    logo: "",
    line: "",
  };

  return (
    <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-[#111] text-white", compact && "min-h-0", className)}>
      <img src={src} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black" style={{ opacity: template.overlayOpacity / 100 }} />
      {template.gridOpacity > 0 && (
        <div
          className="absolute inset-0"
          style={{
            opacity: template.gridOpacity / 100,
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.55) 1px, transparent 1px)",
            backgroundSize: compact ? "28px 28px" : "64px 64px",
          }}
        />
      )}
      {template.elements.map((element) => {
        const common = {
          left: `${element.x}%`,
          top: `${element.y}%`,
          width: `${element.width}%`,
          height: `${element.height}%`,
          opacity: element.opacity / 100,
          color: element.color,
          transform: "translate(-50%, -50%)",
        };
        if (element.type === "logo") {
          return branding?.logoUrl ? (
            <img
              key={element.id}
              src={branding.logoUrl}
              alt=""
              className="absolute object-contain"
              style={common}
            />
          ) : null;
        }
        if (element.type === "line") {
          return (
            <span
              key={element.id}
              className="absolute block border-t"
              style={{ ...common, borderColor: element.color, opacity: (element.opacity * template.lineOpacity) / 10000 }}
            />
          );
        }
        return (
          <span
            key={element.id}
            className={cn("absolute flex items-center leading-tight", element.type === "button" && "justify-center border px-3 font-semibold uppercase tracking-[0.18em]")}
            style={{
              ...common,
              fontSize: compact ? Math.max(8, element.fontSize / 3) : element.fontSize,
              textAlign: element.align ?? "center",
              justifyContent: element.align === "left" ? "flex-start" : element.align === "right" ? "flex-end" : "center",
              borderColor: element.color,
            }}
          >
            {textMap[element.type]}
          </span>
        );
      })}
    </div>
  );
}

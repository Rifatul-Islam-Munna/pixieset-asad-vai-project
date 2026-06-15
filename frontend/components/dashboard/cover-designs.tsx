import { cn } from "@/lib/utils";

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
  const showSmall = design.showCoverSmallTitle !== false;
  const showTitle = design.showCoverTitle !== false;
  const showDate = design.showCoverDate !== false;
  const showButton = design.showCoverButton !== false;
  const smallTitle = design.coverSmallTitle || "Avery Studio";
  const title = design.coverTitle || "Sarah & Daniel";
  const date = design.coverDate || "June 14, 2026";
  const buttonText = design.coverButtonText || "View Gallery";
  const text = (
    <div className={cn("flex flex-col gap-2", compact && "gap-1")}>
      {showSmall && <p className={cn("text-[10px] uppercase tracking-[0.28em]", !compact && "text-xs")}>{smallTitle}</p>}
      {showTitle && <h3 className={cn("font-semibold uppercase tracking-[0.18em]", compact ? "text-sm" : "text-4xl md:text-6xl")}>{title}</h3>}
      {showDate && <p className={cn("text-[10px] uppercase tracking-[0.22em]", !compact && "text-sm")}>{date}</p>}
      {showButton && (
        <span className={cn("mt-1 inline-flex border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.2em]", !compact && "mt-4 px-6 py-3 text-xs")}>
          {buttonText}
        </span>
      )}
    </div>
  );

  if (design.cover === "Novel") {
    return (
      <div className={cn("relative grid h-full min-h-[62vh] grid-cols-2 bg-white text-[#222]", compact && "min-h-0", className)}>
        <div className="flex items-center justify-center p-4 text-center">{text}</div>
        <img src={src} alt="" className="h-full w-full object-cover p-3" />
      </div>
    );
  }

  if (design.cover === "Split" || design.cover === "Journal" || design.cover === "Editorial") {
    return (
      <div className={cn("relative grid h-full min-h-[62vh] grid-cols-2 bg-white text-[#222]", compact && "min-h-0", className)}>
        <img src={src} alt="" className="h-full w-full object-cover" />
        <div className={cn("flex items-center p-6", design.cover === "Journal" ? "justify-start" : "justify-center text-center")}>{text}</div>
      </div>
    );
  }

  if (design.cover === "Stamp" || design.cover === "Minimal") {
    return (
      <div className={cn("relative flex h-full min-h-[62vh] flex-col items-center justify-center gap-5 bg-white text-center text-[#222]", compact && "min-h-0 gap-2", className)}>
        <img src={src} alt="" className={cn("aspect-square w-[34%] object-cover", compact && "w-[30%]")} />
        {text}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full min-h-[62vh] overflow-hidden bg-[#222] text-white", compact && "min-h-0", className)}>
      <img src={src} alt="" className="h-full w-full object-cover" />
      <div className={cn("absolute inset-0", design.cover === "Vintage" ? "bg-white/55" : "bg-black/28")} />
      {design.cover === "Frame" && <div className="absolute inset-4 border border-white" />}
      {design.cover === "Stripe" && <><div className="absolute left-[12%] right-[12%] top-[22%] border-t border-white" /><div className="absolute bottom-[22%] left-[12%] right-[12%] border-t border-white" /></>}
      {design.cover === "Divider" && <div className="absolute bottom-0 left-1/2 top-0 border-l border-white" />}
      {design.cover === "Outline" && <div className="absolute inset-[18%] border border-white" />}
      {design.cover === "Banner" && <div className="absolute inset-x-0 bottom-[18%] bg-white/88 py-3 text-center text-[#222]" />}
      {design.cover === "Portal" && <div className="absolute inset-[13%] rounded-full border border-white/85" />}
      <div
        className={cn(
          "absolute p-6",
          ["Center", "Frame", "Outline", "Portal"].includes(design.cover) && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center",
          ["Left", "Stripe", "Classic"].includes(design.cover) && "bottom-8 left-8 text-left",
          ["Vintage", "Gallery"].includes(design.cover) && "bottom-8 left-1/2 -translate-x-1/2 text-center text-[#222]",
          design.cover === "Divider" && "bottom-8 left-8 text-left",
          design.cover === "Banner" && "bottom-[18%] left-1/2 -translate-x-1/2 translate-y-1/2 text-center text-[#222]",
          design.cover === "Maison" && "right-8 top-8 text-right",
          compact && "p-3"
        )}
      >
        {text}
      </div>
    </div>
  );
}

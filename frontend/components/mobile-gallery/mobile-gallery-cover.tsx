import type { CSSProperties } from "react";
import type { MobileGalleryApp, MobileGalleryCoverText, MobileGalleryDesign, MobileGalleryImage } from "@/api-hooks/use-mobile-gallery";

export const mobileGalleryThemes = {
  echo: { fontFamily: "Georgia, serif", align: "center" as const },
  spring: { fontFamily: "'Times New Roman', serif", align: "left" as const },
  lark: { fontFamily: "Arial, sans-serif", align: "left" as const },
  sage: { fontFamily: "'Courier New', monospace", align: "center" as const },
} as const;

export type MobileGalleryThemeName = keyof typeof mobileGalleryThemes;
type ResolvedCoverText = Required<MobileGalleryCoverText>;

export function MobileGalleryCover({ app, design, images }: { app: MobileGalleryApp; design: MobileGalleryDesign; images: MobileGalleryImage[] }) {
  const themeName = (design.theme || "lark") as MobileGalleryThemeName;
  const coverStyle = design.coverStyle || "none";
  const cover = app.coverImage || images[0]?.url;
  const focal = design.focal || { x: 50, y: 50 };
  const text = getMobileGalleryCoverDefaults(app, themeName, coverStyle, design.coverText);

  if (coverStyle === "full" && cover) {
    const vertical = text.verticalPosition === "top" ? "items-start pt-12" : text.verticalPosition === "center" ? "items-center" : "items-end pb-12";
    return (
      <header className="relative h-[56vh] min-h-[360px] overflow-hidden">
        <img src={cover} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
        <div className="absolute inset-0" style={{ backgroundColor: hexToRgba(text.overlayColor, text.overlayOpacity / 100) }} />
        <div className={`absolute inset-0 flex px-6 ${vertical}`}><CoverCopy app={app} theme={themeName} text={text} inverse /></div>
      </header>
    );
  }

  if (coverStyle === "third" && cover) {
    return (
      <header>
        <div className="px-6 pb-8 pt-12"><CoverCopy app={app} theme={themeName} text={text} /></div>
        <div className="h-[34vh] min-h-[240px] overflow-hidden"><img src={cover} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} /></div>
      </header>
    );
  }

  return <header className="px-6 pb-9 pt-14"><CoverCopy app={app} theme={themeName} text={text} /></header>;
}

function CoverCopy({ app, theme, text, inverse = false }: { app: MobileGalleryApp; theme: MobileGalleryThemeName; text: ResolvedCoverText; inverse?: boolean }) {
  const date = text.dateLabel || (app.eventDate ? formatDate(app.eventDate) : "");
  const alignmentClass = text.alignment === "center" ? "text-center mx-auto" : text.alignment === "right" ? "text-right ml-auto" : "text-left";
  const fontFamily = fontPreset(text.fontPreset, mobileGalleryThemes[theme].fontFamily);
  const title = text.uppercase ? text.title.toUpperCase() : text.title;
  const color = text.textColor || (inverse ? "#ffffff" : undefined);
  const shadow = text.shadowStrength > 0 ? `0 2px ${Math.max(2, text.shadowStrength / 2)}px rgba(0,0,0,${Math.min(0.75, text.shadowStrength / 100)})` : undefined;
  const wrapperStyle: CSSProperties = { color, fontFamily, maxWidth: `${text.contentWidth}%`, textShadow: shadow };
  const titleStyle: CSSProperties = { fontSize: `clamp(${Math.max(22, text.titleSize * 0.72)}px, 8vw, ${text.titleSize}px)`, letterSpacing: `${text.letterSpacing}px`, lineHeight: 1.08 };
  const subtitleStyle: CSSProperties = { fontSize: `${text.subtitleSize}px` };

  return (
    <div className={`w-full ${alignmentClass}`} style={wrapperStyle}>
      {text.eyebrow && <p className="text-[10px] uppercase tracking-[0.24em] opacity-75">{text.eyebrow}</p>}
      {text.showDivider && text.eyebrow && <div className={`mt-4 h-px w-14 bg-current opacity-50 ${text.alignment === "center" ? "mx-auto" : text.alignment === "right" ? "ml-auto" : ""}`} />}
      <h1 className={`mt-4 break-words ${theme === "spring" ? "italic" : "font-semibold"}`} style={titleStyle}>{title}</h1>
      {text.subtitle && <p className="mt-4 whitespace-pre-line leading-6 opacity-80" style={subtitleStyle}>{text.subtitle}</p>}
      {text.showDivider && !text.eyebrow && <div className={`mt-5 h-px w-14 bg-current opacity-45 ${text.alignment === "center" ? "mx-auto" : text.alignment === "right" ? "ml-auto" : ""}`} />}
      {text.showDate && date && <p className="mt-5 text-[10px] uppercase tracking-[0.22em] opacity-70">{date}</p>}
    </div>
  );
}

export function getMobileGalleryCoverDefaults(
  app: MobileGalleryApp,
  theme: MobileGalleryThemeName,
  coverStyle: MobileGalleryDesign["coverStyle"] = "none",
  custom?: MobileGalleryCoverText,
): ResolvedCoverText {
  const defaults: Record<MobileGalleryThemeName, ResolvedCoverText> = {
    echo: { eyebrow: "Mobile Gallery", title: app.name, subtitle: "", showDate: true, dateLabel: "", alignment: "center", verticalPosition: "bottom", fontPreset: "serif", titleSize: 42, subtitleSize: 15, letterSpacing: 4, uppercase: true, showDivider: true, contentWidth: 88, textColor: "#ffffff", overlayColor: "#000000", overlayOpacity: 34, shadowStrength: 38 },
    spring: { eyebrow: "A collection of moments", title: app.name, subtitle: "", showDate: true, dateLabel: "", alignment: "left", verticalPosition: "bottom", fontPreset: "serif", titleSize: 50, subtitleSize: 16, letterSpacing: 0, uppercase: false, showDivider: false, contentWidth: 88, textColor: "#ffffff", overlayColor: "#000000", overlayOpacity: 30, shadowStrength: 32 },
    lark: { eyebrow: "", title: app.name, subtitle: "", showDate: true, dateLabel: "", alignment: "left", verticalPosition: "bottom", fontPreset: "sans", titleSize: 42, subtitleSize: 15, letterSpacing: 1, uppercase: false, showDivider: true, contentWidth: 88, textColor: "#ffffff", overlayColor: "#000000", overlayOpacity: 28, shadowStrength: 30 },
    sage: { eyebrow: "Private mobile gallery", title: app.name, subtitle: "", showDate: true, dateLabel: "", alignment: "center", verticalPosition: "center", fontPreset: "mono", titleSize: 40, subtitleSize: 14, letterSpacing: 3, uppercase: true, showDivider: false, contentWidth: 88, textColor: "#ffffff", overlayColor: "#1f2a25", overlayOpacity: 42, shadowStrength: 24 },
  };
  return {
    ...defaults[theme],
    ...(custom || {}),
    title: custom?.title || app.name,
    textColor: custom?.textColor ?? (coverStyle === "full" ? defaults[theme].textColor : ""),
  };
}

function fontPreset(preset: ResolvedCoverText["fontPreset"], themeFont: string) {
  if (preset === "serif") return "Georgia, 'Times New Roman', serif";
  if (preset === "sans") return "Arial, Helvetica, sans-serif";
  if (preset === "mono") return "'Courier New', monospace";
  if (preset === "script") return "'Brush Script MT', 'Segoe Script', cursive";
  return themeFont;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((part) => part + part).join("") : normalized;
  const number = Number.parseInt(value || "000000", 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function MobileGalleryThemePreview({ theme }: { theme: MobileGalleryThemeName }) {
  if (theme === "echo") return <div className="flex h-28 flex-col items-center justify-center bg-[#e8e1d8] px-2 text-center font-serif"><span className="text-[6px] uppercase tracking-[0.34em]">Mobile Gallery</span><span className="mt-3 h-px w-7 bg-current opacity-50" /><span className="mt-3 text-[10px] uppercase tracking-[0.16em]">Echo</span></div>;
  if (theme === "spring") return <div className="flex h-28 flex-col justify-center bg-[#e7eee4] px-4 text-left font-serif"><span className="text-[6px] uppercase tracking-[0.2em]">A collection</span><span className="mt-2 text-base italic">Spring</span><span className="mt-3 h-px w-7 bg-current opacity-45" /></div>;
  if (theme === "sage") return <div className="flex h-28 flex-col items-center justify-center bg-[#dddcd5] px-2 text-center font-mono"><span className="border border-current/40 px-2 py-1 text-[6px] uppercase tracking-[0.2em]">Gallery</span><span className="mt-3 text-[11px] uppercase tracking-[0.18em]">Sage</span></div>;
  return <div className="flex h-28 flex-col justify-center bg-[#dfe9ec] px-4 text-left font-sans"><span className="text-sm font-semibold tracking-wide">Lark</span><span className="mt-3 h-px w-7 bg-current opacity-45" /><span className="mt-3 text-[6px] uppercase tracking-[0.2em]">July 7, 2026</span></div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

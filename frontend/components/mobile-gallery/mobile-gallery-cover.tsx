import type { MobileGalleryApp, MobileGalleryDesign, MobileGalleryImage } from "@/api-hooks/use-mobile-gallery";

export const mobileGalleryThemes = {
  echo: {
    fontFamily: "Georgia, serif",
    titleClass: "uppercase tracking-[0.18em]",
    align: "text-center",
  },
  spring: {
    fontFamily: "'Times New Roman', serif",
    titleClass: "italic tracking-wide",
    align: "text-left",
  },
  lark: {
    fontFamily: "Arial, sans-serif",
    titleClass: "font-semibold tracking-[0.04em]",
    align: "text-left",
  },
  sage: {
    fontFamily: "'Courier New', monospace",
    titleClass: "uppercase tracking-[0.18em]",
    align: "text-center",
  },
} as const;

type ThemeName = keyof typeof mobileGalleryThemes;

export function MobileGalleryCover({
  app,
  design,
  images,
}: {
  app: MobileGalleryApp;
  design: MobileGalleryDesign;
  images: MobileGalleryImage[];
}) {
  const themeName = (design.theme || "lark") as ThemeName;
  const coverStyle = design.coverStyle || "none";
  const cover = app.coverImage || images[0]?.url;
  const focal = design.focal || { x: 50, y: 50 };
  const inverse = coverStyle === "full" && Boolean(cover);

  if (coverStyle === "full" && cover) {
    return (
      <header className="relative h-[56vh] min-h-[360px] overflow-hidden">
        <img
          src={cover}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-12 pt-24 text-white">
          <ThemeCopy app={app} theme={themeName} inverse />
        </div>
      </header>
    );
  }

  if (coverStyle === "third" && cover) {
    return (
      <header>
        <div className="px-6 pb-8 pt-12">
          <ThemeCopy app={app} theme={themeName} />
        </div>
        <div className="h-[34vh] min-h-[240px] overflow-hidden">
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
          />
        </div>
      </header>
    );
  }

  return (
    <header className="px-6 pb-9 pt-14">
      <ThemeCopy app={app} theme={themeName} inverse={inverse} />
    </header>
  );
}

function ThemeCopy({
  app,
  theme,
  inverse = false,
}: {
  app: MobileGalleryApp;
  theme: ThemeName;
  inverse?: boolean;
}) {
  const date = app.eventDate ? formatDate(app.eventDate) : "";

  if (theme === "echo") {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-[9px] uppercase tracking-[0.38em] opacity-75">Mobile Gallery</p>
        <div className="mx-auto mt-5 h-px w-14 bg-current opacity-55" />
        <h1 className="mt-6 break-words font-serif text-3xl uppercase tracking-[0.18em] sm:text-4xl">{app.name}</h1>
        {date && <p className="mt-5 text-[10px] uppercase tracking-[0.28em] opacity-75">{date}</p>}
      </div>
    );
  }

  if (theme === "spring") {
    return (
      <div className="max-w-xl text-left">
        <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">A collection of moments</p>
        <h1 className="mt-4 break-words font-serif text-4xl italic leading-tight sm:text-5xl">{app.name}</h1>
        {date && (
          <div className="mt-6 flex items-center gap-3">
            <span className="h-px w-12 bg-current opacity-45" />
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">{date}</p>
          </div>
        )}
      </div>
    );
  }

  if (theme === "sage") {
    return (
      <div className="mx-auto max-w-xl text-center font-mono">
        <div className={`mx-auto inline-block border px-4 py-2 text-[9px] uppercase tracking-[0.28em] ${inverse ? "border-white/55" : "border-current/35"}`}>
          Private mobile gallery
        </div>
        <h1 className="mt-6 break-words text-3xl font-medium uppercase tracking-[0.16em] sm:text-4xl">{app.name}</h1>
        {date && <p className="mt-5 text-[10px] uppercase tracking-[0.24em] opacity-70">[{date}]</p>}
      </div>
    );
  }

  return (
    <div className="max-w-xl text-left">
      <h1 className="break-words text-3xl font-semibold tracking-[0.035em] sm:text-4xl">{app.name}</h1>
      <div className="mt-5 h-px w-14 bg-current opacity-45" />
      {date && <p className="mt-5 text-[10px] uppercase tracking-[0.24em] opacity-65">{date}</p>}
    </div>
  );
}

export function MobileGalleryThemePreview({ theme }: { theme: ThemeName }) {
  if (theme === "echo") {
    return (
      <div className="flex h-28 flex-col items-center justify-center bg-[#e8e1d8] px-2 text-center font-serif">
        <span className="text-[6px] uppercase tracking-[0.34em]">Mobile Gallery</span>
        <span className="mt-3 h-px w-7 bg-current opacity-50" />
        <span className="mt-3 text-[10px] uppercase tracking-[0.16em]">Echo</span>
      </div>
    );
  }

  if (theme === "spring") {
    return (
      <div className="flex h-28 flex-col justify-center bg-[#e7eee4] px-4 text-left font-serif">
        <span className="text-[6px] uppercase tracking-[0.2em]">A collection</span>
        <span className="mt-2 text-base italic">Spring</span>
        <span className="mt-3 h-px w-7 bg-current opacity-45" />
      </div>
    );
  }

  if (theme === "sage") {
    return (
      <div className="flex h-28 flex-col items-center justify-center bg-[#dddcd5] px-2 text-center font-mono">
        <span className="border border-current/40 px-2 py-1 text-[6px] uppercase tracking-[0.2em]">Gallery</span>
        <span className="mt-3 text-[11px] uppercase tracking-[0.18em]">Sage</span>
      </div>
    );
  }

  return (
    <div className="flex h-28 flex-col justify-center bg-[#dfe9ec] px-4 text-left font-sans">
      <span className="text-sm font-semibold tracking-wide">Lark</span>
      <span className="mt-3 h-px w-7 bg-current opacity-45" />
      <span className="mt-3 text-[6px] uppercase tracking-[0.2em]">July 7, 2026</span>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

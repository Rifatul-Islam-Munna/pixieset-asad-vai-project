"use client";

export type ImageWatermark = {
  type: "text" | "image";
  text?: string;
  font?: string;
  color?: string;
  scale?: number;
  opacity?: number;
  position?: { x?: number; y?: number };
  image?: string;
};

function mediaUrl(value?: string) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return url.startsWith("/") ? `${baseUrl}${url}` : url;
}

export function ImageWatermarkOverlay({
  watermark,
}: {
  watermark?: ImageWatermark | null;
}) {
  if (!watermark) return null;

  const position = watermark.position ?? { x: 15, y: 85 };
  const left = Math.max(0, Math.min(100, Number(position.x ?? 15)));
  const top = Math.max(0, Math.min(100, Number(position.y ?? 85)));
  const opacity = Math.max(
    0,
    Math.min(1, Number(watermark.opacity ?? 90) / 100),
  );

  if (watermark.type === "image" && watermark.image) {
    return (
      <img
        src={mediaUrl(watermark.image)}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute z-20 max-h-[45%] max-w-[45%] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          opacity,
          width: `${Math.max(8, Math.min(70, Number(watermark.scale ?? 42)))}%`,
        }}
        draggable={false}
      />
    );
  }

  const text = String(watermark.text ?? "").trim();
  if (!text) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-bold"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        color: watermark.color ?? "#ffffff",
        fontFamily: watermark.font ?? "Times New Roman",
        fontSize: `clamp(12px, ${Math.max(
          1.4,
          Math.min(7, Number(watermark.scale ?? 42) / 10),
        )}vw, 48px)`,
        opacity,
        textShadow: "0 1px 2px rgba(0,0,0,0.35)",
      }}
    >
      {text}
    </span>
  );
}

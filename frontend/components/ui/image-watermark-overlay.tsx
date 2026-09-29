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

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function watermarkLayout(watermark: ImageWatermark) {
  const scale = clamp(Number(watermark.scale ?? 42), 10, 120);
  const text = String(watermark.text ?? "Watermark");
  const isImage = watermark.type === "image";

  // Keep this mapping identical to backend ImagorService.watermarkLayout.
  // Scale ~50 intentionally looks like a watermark instead of headline text.
  const fontPct = clamp(scale * 0.075, 1.2, 8.5);
  const widthPct = isImage
    ? clamp(scale * 0.28, 4, 34)
    : clamp(text.length * fontPct * 0.55, 8, 72);
  const heightPct = isImage
    ? widthPct
    : clamp(fontPct * 1.65, 2, 16);
  const rawX = Number(watermark.position?.x ?? 15);
  const rawY = Number(watermark.position?.y ?? 85);
  const x = clamp(rawX, widthPct / 2, 100 - widthPct / 2);
  const y = clamp(rawY, heightPct / 2, 100 - heightPct / 2);
  return { x, y, widthPct, heightPct, fontPct };
}

export function ImageWatermarkOverlay({
  watermark,
}: {
  watermark?: ImageWatermark | null;
}) {
  if (!watermark) return null;

  const layout = watermarkLayout(watermark);
  const opacity = Math.max(
    0,
    Math.min(1, Number(watermark.opacity ?? 90) / 100),
  );

  if (watermark.type === "image" && watermark.image) {
    return (
      <span
        className="pointer-events-none absolute inset-0 z-20"
        style={{ containerType: "inline-size" }}
      >
        <img
          src={mediaUrl(watermark.image)}
          alt=""
          aria-hidden="true"
          className="absolute -translate-x-1/2 -translate-y-1/2 select-none object-contain"
          style={{
            left: `${layout.x}%`,
            top: `${layout.y}%`,
            opacity,
            width: `${layout.widthPct}%`,
            maxHeight: `${layout.heightPct}%`,
          }}
          draggable={false}
        />
      </span>
    );
  }

  const text = String(watermark.text ?? "").trim();
  if (!text) return null;

  return (
    <span
      className="pointer-events-none absolute inset-0 z-20"
      style={{ containerType: "inline-size" }}
    >
      <span
        aria-hidden="true"
        className="absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-center font-bold"
        style={{
          left: `${layout.x}%`,
          top: `${layout.y}%`,
          width: `${layout.widthPct}%`,
          color: watermark.color ?? "#ffffff",
          fontFamily: watermark.font ?? "Times New Roman",
          fontSize: `max(12px, ${layout.fontPct}cqw)`,
          lineHeight: 1.1,
          opacity,
          textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        }}
      >
        {text}
      </span>
    </span>
  );
}

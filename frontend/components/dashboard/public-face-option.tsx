"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { facePreviewGeometry, type FaceBox } from "@/lib/face-preview-geometry";

type Props = {
  src: string;
  label: string;
  box?: FaceBox;
  photoCount: number;
  disabled: boolean;
  onSelect: () => void;
};

/** Only the small selector is zoomed. Gallery images and downloads stay full-frame. */
export function PublicFaceOption({ src, label, box, photoCount, disabled, onSelect }: Props) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const crop = dimensions && !failed
    ? facePreviewGeometry(box, dimensions.width, dimensions.height)
    : null;

  return (
    <button
      type="button"
      disabled={disabled || !crop}
      aria-label={label + ", " + photoCount + " indexed group photos"}
      title={failed ? "Face preview unavailable" : "Select this detected face"}
      onClick={onSelect}
      className="grid justify-items-center gap-2 text-center transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="relative block size-16 overflow-hidden rounded-full bg-[#eee] ring-2 ring-[#111]/10 sm:size-20">
        {!crop && <span className="absolute inset-0 grid place-items-center text-[#999]"><UserRound className="size-6" /></span>}
        {src && !failed && (
          // The source is an existing gallery derivative, not a newly saved crop.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={(event) => setDimensions({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })}
            onError={() => setFailed(true)}
            className="pointer-events-none absolute max-h-none max-w-none select-none"
            style={crop ? { ...crop, objectFit: "fill" } : { width: 1, height: 1, opacity: 0 }}
          />
        )}
      </span>
      <span className="text-xs font-bold" title="Indexed group size; the verified search count is shown after selection">
        {photoCount.toLocaleString()} {photoCount === 1 ? "grouped photo" : "grouped photos"}
      </span>
    </button>
  );
}

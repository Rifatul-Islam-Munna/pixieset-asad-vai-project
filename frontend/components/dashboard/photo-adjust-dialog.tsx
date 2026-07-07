"use client";

import { useState } from "react";
import { RotateCcw, RotateCw, X } from "lucide-react";
import { publicImageSrc, type PublicStoreCartItem, type StoreCrop } from "@/lib/public-store";

export function PhotoAdjustDialog({
  item,
  onClose,
  onSave,
}: {
  item: PublicStoreCartItem;
  onClose: () => void;
  onSave: (crop: StoreCrop) => void;
}) {
  const [crop, setCrop] = useState<StoreCrop>(
    item.crop ?? { x: 0, y: 0, width: 100, height: 100, zoom: 1, rotation: 0, aspectRatio: "4:3" },
  );

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 p-4">
      <div className="grid w-full max-w-[900px] overflow-hidden bg-white md:grid-cols-[1fr_330px]">
        <div className="flex min-h-[420px] items-center justify-center bg-[#e9e9e7] p-7">
          <div className="relative w-full overflow-hidden bg-white shadow-lg" style={{ aspectRatio: ratio(crop.aspectRatio) }}>
            <img
              src={publicImageSrc(item.image?.url)}
              alt="Crop preview"
              className="absolute left-1/2 top-1/2 h-full w-full max-w-none object-cover"
              style={{ transform: `translate(calc(-50% + ${crop.x}%), calc(-50% + ${crop.y}%)) scale(${crop.zoom}) rotate(${crop.rotation}deg)` }}
            />
            <div className="pointer-events-none absolute inset-0 border border-white/70" />
          </div>
        </div>
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-medium">Edit crop</h3>
            <button onClick={onClose} aria-label="Close"><X className="size-5" /></button>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#666]">Adjust the photograph without changing the original collection image.</p>
          <Range label="Horizontal" min={-50} max={50} step={1} value={crop.x} onChange={(x) => setCrop((value) => ({ ...value, x }))} />
          <Range label="Vertical" min={-50} max={50} step={1} value={crop.y} onChange={(y) => setCrop((value) => ({ ...value, y }))} />
          <Range label="Zoom" min={1} max={3} step={0.05} value={crop.zoom} onChange={(zoom) => setCrop((value) => ({ ...value, zoom }))} />
          <div className="mt-6 flex gap-2">
            <button className="flex h-10 flex-1 items-center justify-center gap-2 border text-sm" onClick={() => setCrop((value) => ({ ...value, rotation: value.rotation - 90 }))}><RotateCcw className="size-4" /> Left</button>
            <button className="flex h-10 flex-1 items-center justify-center gap-2 border text-sm" onClick={() => setCrop((value) => ({ ...value, rotation: value.rotation + 90 }))}><RotateCw className="size-4" /> Right</button>
          </div>
          <button className="mt-7 h-11 w-full bg-[#303030] text-sm font-semibold text-white" onClick={() => onSave(crop)}>Save crop</button>
        </div>
      </div>
    </div>
  );
}

function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="mt-6 block text-xs">
      <span className="flex justify-between"><span>{label}</span><span>{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span>
      <input className="mt-3 w-full accent-[#303030]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ratio(value: string) {
  const [width, height] = String(value || "4:3").split(":").map(Number);
  return width > 0 && height > 0 ? width / height : 4 / 3;
}

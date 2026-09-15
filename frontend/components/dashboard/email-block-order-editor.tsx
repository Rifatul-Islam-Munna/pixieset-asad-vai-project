"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import {
  EMAIL_BLOCK_LABELS,
  EMAIL_DEFAULT_BLOCK_ORDER,
  normalizeBlockOrder,
  type GalleryEmailBlockId,
} from "@/lib/gallery-email";

export function EmailBlockOrderEditor({
  value,
  onChange,
  hint,
  className = "",
}: {
  value?: string[];
  onChange: (order: GalleryEmailBlockId[]) => void;
  hint?: string;
  className?: string;
}) {
  const [dragging, setDragging] = useState<GalleryEmailBlockId | null>(null);
  const [dropTarget, setDropTarget] = useState<GalleryEmailBlockId | null>(null);
  const order = normalizeBlockOrder(value);

  const commit = (next: GalleryEmailBlockId[]) => onChange(normalizeBlockOrder(next));

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  const dropOn = (target: GalleryEmailBlockId) => {
    if (!dragging || dragging === target) return;
    move(order.indexOf(dragging), order.indexOf(target));
    setDragging(null);
    setDropTarget(null);
  };

  return (
    <div className={`grid gap-1.5 ${className}`}>
      {hint ? (
        <p className="mb-1 text-xs leading-5 text-[#888]">{hint}</p>
      ) : null}
      {order.map((block, index) => {
        const isDragging = dragging === block;
        const isTarget = dropTarget === block && dragging !== block;
        return (
          <div
            key={block}
            draggable
            onDragStart={(event) => {
              setDragging(block);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", block);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTarget(block);
            }}
            onDragLeave={() => setDropTarget((current) => (current === block ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              dropOn(block);
            }}
            onDragEnd={() => {
              setDragging(null);
              setDropTarget(null);
            }}
            className={`flex h-10 cursor-grab items-center gap-2 border bg-white px-2.5 text-xs ${
              isTarget
                ? "border-[#6337d8] bg-[#f7f4ff]"
                : "border-[#e4e4e0]"
            } ${isDragging ? "opacity-40" : ""}`}
          >
            <GripVertical className="size-4 shrink-0 text-[#b0b0aa]" />
            <span className="min-w-0 flex-1 truncate font-semibold text-[#333]">
              {EMAIL_BLOCK_LABELS[block]}
            </span>
            <button
              type="button"
              aria-label={`Move ${EMAIL_BLOCK_LABELS[block]} up`}
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
              className="flex size-6 items-center justify-center text-[#888] disabled:opacity-25"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Move ${EMAIL_BLOCK_LABELS[block]} down`}
              disabled={index === order.length - 1}
              onClick={() => move(index, index + 1)}
              className="flex size-6 items-center justify-center text-[#888] disabled:opacity-25"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => commit([...EMAIL_DEFAULT_BLOCK_ORDER])}
        className="mt-1 justify-self-start text-[11px] font-bold uppercase tracking-[0.12em] text-[#6337d8]"
      >
        Reset order
      </button>
    </div>
  );
}

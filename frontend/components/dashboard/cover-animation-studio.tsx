"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Play, RotateCcw, Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  COVER_ANIMATION_EFFECT_OPTIONS,
  COVER_ANIMATION_PRESETS,
  COVER_ANIMATION_TARGETS,
  resolveCoverAnimationSpec,
  type CoverAnimationEase,
  type CoverAnimationEffect,
  type CoverAnimationSplit,
  type CoverAnimationTarget,
} from "@/lib/cover-animation";
import type { PresetDesignSettings } from "@/lib/dashboard-store";
import { cn } from "@/lib/utils";

const nonePreset = {
  id: "none" as const,
  name: "Still",
  description: "No advanced cover animation. Your existing simple motion can still be used.",
  mood: "None",
};

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-3 text-xs font-bold text-[#555]">
        <span>{label}</span>
        <span className="font-mono text-[11px] font-normal text-[#777]">{Number(value.toFixed(2))}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-[#6337d8]"
      />
    </label>
  );
}

export function CoverAnimationStudio({
  design,
  onChange,
}: {
  design: PresetDesignSettings;
  onChange: (value: Partial<PresetDesignSettings>) => void;
}) {
  const [target, setTarget] = useState<CoverAnimationTarget>("title");
  const activePreset = design.coverAnimationPreset || "none";
  const selectedTarget = COVER_ANIMATION_TARGETS.find((item) => item.id === target) ?? COVER_ANIMATION_TARGETS[0];
  const spec = useMemo(
    () => resolveCoverAnimationSpec(design, target),
    [design, target],
  );
  const presets = [nonePreset, ...COVER_ANIMATION_PRESETS];

  const updateTarget = (patch: Partial<typeof spec>) => {
    onChange({
      coverAnimations: {
        ...(design.coverAnimations ?? {}),
        [target]: { ...spec, ...patch },
      },
      coverAnimationReplayKey: Date.now(),
    });
  };

  const clearTargetOverride = () => {
    const next = { ...(design.coverAnimations ?? {}) };
    delete next[target];
    onChange({ coverAnimations: next, coverAnimationReplayKey: Date.now() });
  };

  const selectPreset = (id: PresetDesignSettings["coverAnimationPreset"]) => {
    onChange({
      coverAnimationPreset: id,
      coverAnimations: {},
      coverAnimationReplayKey: Date.now(),
    });
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#e7e0f7] bg-gradient-to-br from-[#faf8ff] to-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#6337d8] text-white shadow-[0_8px_25px_rgba(99,55,216,.24)]">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Animated Cover Studio</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#6f6a78]">
                Motion is powered by Motion for React. Pick a designed sequence, then customize the photo/video, every text layer, logo and timing independently.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-lg bg-white"
            onClick={() => onChange({ coverAnimationReplayKey: Date.now() })}
          >
            <Play className="size-4" /> Replay
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-bold">Ready-made animated covers</p>
            <p className="mt-1 text-xs text-[#777]">Eight polished sequences plus a full custom starting point.</p>
          </div>
          <span className="rounded-full bg-[#f1ecff] px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#6337d8]">Live preview</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {presets.map((preset) => {
            const selected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                className={cn(
                  "group relative min-h-[112px] overflow-hidden rounded-xl border p-4 text-left transition-all",
                  selected
                    ? "border-[#6337d8] bg-[#f6f2ff] shadow-[0_8px_30px_rgba(99,55,216,.12)] ring-1 ring-[#6337d8]/20"
                    : "border-[#e5e5e5] bg-white hover:-translate-y-0.5 hover:border-[#b7a4eb] hover:shadow-sm",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold">{preset.name}</span>
                  <span className={cn("rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em]", selected ? "bg-[#6337d8] text-white" : "bg-[#f3f3f3] text-[#777]")}>{preset.mood}</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#777]">{preset.description}</p>
                <span className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform", selected ? "scale-x-100 bg-[#6337d8]" : "scale-x-0 bg-[#9a7be8] group-hover:scale-x-100")} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border bg-[#fbfbfb] p-4 sm:grid-cols-[1fr_240px] sm:p-5">
        <div>
          <p className="text-sm font-bold">Global animation speed</p>
          <p className="mt-1 text-xs text-[#777]">One control scales the timing of the whole sequence without destroying your individual timings.</p>
        </div>
        <RangeControl
          label="Speed"
          value={design.coverAnimationSpeed ?? 1}
          min={0.5}
          max={2}
          step={0.05}
          suffix="x"
          onChange={(coverAnimationSpeed) => onChange({ coverAnimationSpeed, coverAnimationReplayKey: Date.now() })}
        />
      </div>

      <div className="grid gap-4 rounded-xl border border-[#e7e0f7] bg-[#faf8ff] p-4 sm:grid-cols-[1fr_240px] sm:p-5">
        <div>
          <div className="flex items-center gap-3">
            <Switch
              checked={Boolean(design.coverParallaxEnabled)}
              onCheckedChange={(coverParallaxEnabled) => onChange({ coverParallaxEnabled })}
            />
            <p className="text-sm font-bold">Cover image parallax</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#777]">Moves the cover photo at a slower scroll rate for a layered depth effect in the live preview and published collection. Image covers only; video covers stay unchanged. Reduced-motion visitors get a still cover.</p>
        </div>
        <div className={cn(!design.coverParallaxEnabled && "pointer-events-none opacity-45")}>
          <RangeControl
            label="Parallax strength"
            value={design.coverParallaxStrength ?? 36}
            min={12}
            max={80}
            step={1}
            suffix="px"
            onChange={(coverParallaxStrength) => onChange({ coverParallaxStrength })}
          />
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-[#e7e0f7] bg-[#faf8ff] p-4 sm:grid-cols-[1fr_240px] sm:p-5">
        <div>
          <div className="flex items-center gap-3">
            <Switch
              checked={Boolean(design.galleryParallaxEnabled)}
              onCheckedChange={(galleryParallaxEnabled) => onChange({ galleryParallaxEnabled })}
            />
            <p className="text-sm font-bold">Gallery image parallax</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#777]">Adds visible scroll depth to gallery photos in both the live preview and the published public collection. Reduced-motion visitors automatically get a still image.</p>
        </div>
        <div className={cn(!design.galleryParallaxEnabled && "pointer-events-none opacity-45")}>
          <RangeControl
            label="Parallax strength"
            value={design.galleryParallaxStrength ?? 36}
            min={12}
            max={80}
            step={1}
            suffix="px"
            onChange={(galleryParallaxStrength) => onChange({ galleryParallaxStrength })}
          />
        </div>
      </div>

      {activePreset !== "none" && (
        <div className="overflow-hidden rounded-xl border border-[#dedede] bg-white">
          <div className="border-b bg-[#fafafa] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Advanced animation builder</p>
                <p className="mt-1 text-xs text-[#777]">Select a layer, then build its motion. Every control is independent.</p>
              </div>
              <Button type="button" variant="ghost" className="h-9 rounded-lg text-xs" onClick={clearTargetOverride}>
                <RotateCcw className="size-3.5" /> Reset selected layer
              </Button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {COVER_ANIMATION_TARGETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTarget(item.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition",
                    target === item.id ? "border-[#6337d8] bg-[#6337d8] text-white" : "bg-white text-[#555] hover:border-[#9c83df]",
                  )}
                >
                  {item.text ? <Type className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
            <div className="grid content-start gap-5">
              <label className="grid gap-2 text-xs font-bold text-[#555]">
                Animation effect
                <select
                  value={spec.effect}
                  onChange={(event) => updateTarget({ effect: event.target.value as CoverAnimationEffect })}
                  className="h-11 rounded-lg border bg-white px-3 text-sm font-normal outline-none focus:border-[#6337d8]"
                >
                  {COVER_ANIMATION_EFFECT_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>

              {selectedTarget.text && (
                <label className="grid gap-2 text-xs font-bold text-[#555]">
                  Animate text as
                  <select
                    value={spec.split}
                    onChange={(event) => updateTarget({ split: event.target.value as CoverAnimationSplit })}
                    className="h-11 rounded-lg border bg-white px-3 text-sm font-normal outline-none focus:border-[#6337d8]"
                  >
                    <option value="none">Whole text block</option>
                    <option value="words">Word by word</option>
                    <option value="characters">Letter by letter</option>
                  </select>
                </label>
              )}

              <label className="grid gap-2 text-xs font-bold text-[#555]">
                Easing
                <select
                  value={spec.ease}
                  onChange={(event) => updateTarget({ ease: event.target.value as CoverAnimationEase })}
                  className="h-11 rounded-lg border bg-white px-3 text-sm font-normal outline-none focus:border-[#6337d8]"
                >
                  <option value="smooth">Smooth cinematic</option>
                  <option value="soft">Soft</option>
                  <option value="dramatic">Dramatic</option>
                  <option value="spring">Spring</option>
                  <option value="linear">Linear</option>
                </select>
              </label>

              <label className="flex items-center justify-between gap-4 rounded-lg border bg-[#fafafa] p-3 text-sm font-semibold">
                <span><span className="block">Loop this layer</span><span className="mt-0.5 block text-[10px] font-normal text-[#777]">Best for media drift / Ken Burns. Use sparingly on text.</span></span>
                <Switch checked={spec.loop} onCheckedChange={(loop) => updateTarget({ loop })} />
              </label>
            </div>

            <div className="grid content-start gap-5 rounded-xl border bg-[#fafafa] p-4">
              <RangeControl label="Duration" value={spec.duration} min={0.15} max={15} step={0.05} suffix="s" onChange={(duration) => updateTarget({ duration })} />
              <RangeControl label="Delay" value={spec.delay} min={0} max={5} step={0.05} suffix="s" onChange={(delay) => updateTarget({ delay })} />
              <RangeControl label="Travel distance" value={spec.distance} min={0} max={180} step={1} suffix="px" onChange={(distance) => updateTarget({ distance })} />
              <RangeControl label="Start scale" value={spec.scale} min={0.5} max={1.4} step={0.01} suffix="x" onChange={(scale) => updateTarget({ scale })} />
              <RangeControl label="Rotation" value={spec.rotate} min={-90} max={90} step={1} suffix="°" onChange={(rotate) => updateTarget({ rotate })} />
              <RangeControl label="Blur" value={spec.blur} min={0} max={40} step={1} suffix="px" onChange={(blur) => updateTarget({ blur })} />
              {selectedTarget.text && <RangeControl label="Word / letter stagger" value={spec.stagger} min={0} max={0.35} step={0.005} suffix="s" onChange={(stagger) => updateTarget({ stagger })} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

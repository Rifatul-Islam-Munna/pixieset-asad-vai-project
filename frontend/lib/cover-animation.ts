export type CoverAnimationEffect =
  | "none"
  | "fade"
  | "rise"
  | "drop"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "blur-in"
  | "rotate-in"
  | "flip-up"
  | "mask-up"
  | "mask-left"
  | "elastic"
  | "drift"
  | "ken-burns";

export type CoverAnimationSplit = "none" | "words" | "characters";
export type CoverAnimationEase = "smooth" | "soft" | "dramatic" | "linear" | "spring";
export type CoverAnimationTarget = "media" | "smallTitle" | "title" | "date" | "button" | "logo" | "brandText" | "line";

export type CoverAnimationSpec = {
  effect: CoverAnimationEffect;
  duration: number;
  delay: number;
  distance: number;
  scale: number;
  rotate: number;
  blur: number;
  stagger: number;
  split: CoverAnimationSplit;
  ease: CoverAnimationEase;
  loop: boolean;
};

export type CoverAnimationOverrides = Partial<Record<CoverAnimationTarget, Partial<CoverAnimationSpec>>>;

export type CoverAnimationPresetId =
  | "none"
  | "cinematic-rise"
  | "editorial-swipe"
  | "letter-cascade"
  | "soft-focus"
  | "luxury-drift"
  | "split-story"
  | "gallery-pop"
  | "quiet-reveal"
  | "custom";

export type CoverAnimationDesign = {
  coverAnimationPreset?: CoverAnimationPresetId;
  coverAnimationSpeed?: number;
  coverAnimationReplayKey?: number;
  coverAnimations?: CoverAnimationOverrides;
};

export const DEFAULT_COVER_ANIMATION_SPEC: CoverAnimationSpec = {
  effect: "none",
  duration: 0.8,
  delay: 0,
  distance: 48,
  scale: 0.9,
  rotate: -6,
  blur: 14,
  stagger: 0.055,
  split: "none",
  ease: "smooth",
  loop: false,
};

const make = (effect: CoverAnimationEffect, value: Partial<CoverAnimationSpec> = {}): CoverAnimationSpec => ({
  ...DEFAULT_COVER_ANIMATION_SPEC,
  effect,
  ...value,
});

export const COVER_ANIMATION_EFFECT_OPTIONS: Array<{ id: CoverAnimationEffect; label: string }> = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "rise", label: "Rise" },
  { id: "drop", label: "Drop" },
  { id: "slide-left", label: "Slide from left" },
  { id: "slide-right", label: "Slide from right" },
  { id: "zoom-in", label: "Zoom in" },
  { id: "zoom-out", label: "Zoom out" },
  { id: "blur-in", label: "Focus / blur reveal" },
  { id: "rotate-in", label: "Rotate reveal" },
  { id: "flip-up", label: "3D flip up" },
  { id: "mask-up", label: "Mask reveal up" },
  { id: "mask-left", label: "Mask reveal sideways" },
  { id: "elastic", label: "Elastic pop" },
  { id: "drift", label: "Slow drift" },
  { id: "ken-burns", label: "Ken Burns" },
];

export const COVER_ANIMATION_TARGETS: Array<{ id: CoverAnimationTarget; label: string; text: boolean }> = [
  { id: "media", label: "Photo / video", text: false },
  { id: "smallTitle", label: "Small title", text: true },
  { id: "title", label: "Main title", text: true },
  { id: "date", label: "Date", text: true },
  { id: "button", label: "Button", text: true },
  { id: "logo", label: "Logo", text: false },
  { id: "brandText", label: "Brand text", text: true },
  { id: "line", label: "Decorative line", text: false },
];

export type CoverAnimationPreset = {
  id: CoverAnimationPresetId;
  name: string;
  description: string;
  mood: string;
  elements: CoverAnimationOverrides;
};

export const COVER_ANIMATION_PRESETS: CoverAnimationPreset[] = [
  {
    id: "cinematic-rise",
    name: "Cinematic Rise",
    description: "Slow camera push with staged, upward typography.",
    mood: "Film",
    elements: {
      media: make("ken-burns", { duration: 9, scale: 1.1, ease: "linear" }),
      smallTitle: make("fade", { duration: 0.75, delay: 0.18 }),
      title: make("rise", { duration: 1.05, delay: 0.28, distance: 64, split: "words", stagger: 0.09 }),
      date: make("rise", { duration: 0.8, delay: 0.55, distance: 34 }),
      button: make("fade", { duration: 0.7, delay: 0.78 }),
      logo: make("zoom-in", { duration: 0.9, delay: 0.1, scale: 0.84 }),
    },
  },
  {
    id: "editorial-swipe",
    name: "Editorial Swipe",
    description: "Directional image and text reveals inspired by magazine layouts.",
    mood: "Editorial",
    elements: {
      media: make("mask-left", { duration: 1.35, ease: "dramatic" }),
      smallTitle: make("slide-left", { duration: 0.7, delay: 0.18, distance: 55 }),
      title: make("mask-up", { duration: 0.95, delay: 0.28, split: "words", stagger: 0.065 }),
      date: make("slide-right", { duration: 0.65, delay: 0.58, distance: 38 }),
      button: make("slide-right", { duration: 0.7, delay: 0.72, distance: 38 }),
      logo: make("slide-left", { duration: 0.75, delay: 0.12, distance: 44 }),
    },
  },
  {
    id: "letter-cascade",
    name: "Letter Cascade",
    description: "Fine staggered character motion for a high-fashion title reveal.",
    mood: "Type",
    elements: {
      media: make("zoom-out", { duration: 1.8, scale: 1.14 }),
      smallTitle: make("fade", { duration: 0.55, delay: 0.1 }),
      title: make("rise", { duration: 0.75, delay: 0.2, distance: 46, rotate: 3, split: "characters", stagger: 0.035 }),
      date: make("fade", { duration: 0.7, delay: 0.68 }),
      button: make("elastic", { duration: 0.65, delay: 0.82, scale: 0.78, ease: "spring" }),
      logo: make("fade", { duration: 0.8, delay: 0.12 }),
    },
  },
  {
    id: "soft-focus",
    name: "Soft Focus",
    description: "Dreamy focus pull, blur clearing and gentle text entrance.",
    mood: "Romantic",
    elements: {
      media: make("blur-in", { duration: 1.9, blur: 22, scale: 1.04, ease: "soft" }),
      smallTitle: make("blur-in", { duration: 0.8, delay: 0.25, blur: 10 }),
      title: make("blur-in", { duration: 1.05, delay: 0.36, blur: 18, split: "words", stagger: 0.08 }),
      date: make("fade", { duration: 0.75, delay: 0.75 }),
      button: make("rise", { duration: 0.7, delay: 0.88, distance: 24 }),
      logo: make("blur-in", { duration: 1, delay: 0.16, blur: 14 }),
    },
  },
  {
    id: "luxury-drift",
    name: "Luxury Drift",
    description: "An almost still, premium image drift with restrained typography.",
    mood: "Luxury",
    elements: {
      media: make("drift", { duration: 13, scale: 1.055, loop: true, ease: "linear" }),
      smallTitle: make("fade", { duration: 1.1, delay: 0.15 }),
      title: make("fade", { duration: 1.25, delay: 0.32, split: "words", stagger: 0.12 }),
      date: make("fade", { duration: 1, delay: 0.68 }),
      button: make("fade", { duration: 1, delay: 0.95 }),
      logo: make("fade", { duration: 1.2, delay: 0.12 }),
    },
  },
  {
    id: "split-story",
    name: "Split Story",
    description: "Opposing directions create a layered story-like entrance.",
    mood: "Story",
    elements: {
      media: make("slide-left", { duration: 1.25, distance: 90 }),
      smallTitle: make("slide-right", { duration: 0.7, delay: 0.16, distance: 50 }),
      title: make("slide-right", { duration: 0.95, delay: 0.28, distance: 80, split: "words", stagger: 0.075 }),
      date: make("slide-left", { duration: 0.65, delay: 0.56, distance: 42 }),
      button: make("slide-left", { duration: 0.7, delay: 0.7, distance: 42 }),
      logo: make("slide-right", { duration: 0.8, delay: 0.1, distance: 55 }),
    },
  },
  {
    id: "gallery-pop",
    name: "Gallery Pop",
    description: "Confident scale, rotation and spring movement for energetic work.",
    mood: "Bold",
    elements: {
      media: make("zoom-out", { duration: 1.25, scale: 1.18, ease: "dramatic" }),
      smallTitle: make("rotate-in", { duration: 0.65, delay: 0.12, rotate: -8 }),
      title: make("elastic", { duration: 0.8, delay: 0.22, scale: 0.62, split: "words", stagger: 0.07, ease: "spring" }),
      date: make("rotate-in", { duration: 0.65, delay: 0.55, rotate: 6 }),
      button: make("elastic", { duration: 0.65, delay: 0.68, scale: 0.72, ease: "spring" }),
      logo: make("elastic", { duration: 0.75, delay: 0.08, scale: 0.72, ease: "spring" }),
    },
  },
  {
    id: "quiet-reveal",
    name: "Quiet Reveal",
    description: "Minimal masking and precise timing for fine-art galleries.",
    mood: "Fine art",
    elements: {
      media: make("fade", { duration: 1.6 }),
      smallTitle: make("mask-left", { duration: 0.8, delay: 0.25 }),
      title: make("mask-up", { duration: 1.1, delay: 0.38, split: "words", stagger: 0.1 }),
      date: make("mask-left", { duration: 0.8, delay: 0.7 }),
      button: make("fade", { duration: 0.9, delay: 0.95 }),
      logo: make("fade", { duration: 1, delay: 0.15 }),
    },
  },
  {
    id: "custom",
    name: "Custom Motion",
    description: "Start here, then tune every cover element independently.",
    mood: "Builder",
    elements: {
      media: make("zoom-out", { duration: 1.6, scale: 1.1 }),
      smallTitle: make("fade", { duration: 0.65, delay: 0.12 }),
      title: make("rise", { duration: 0.9, delay: 0.24, distance: 50, split: "words", stagger: 0.07 }),
      date: make("rise", { duration: 0.65, delay: 0.48, distance: 26 }),
      button: make("fade", { duration: 0.65, delay: 0.68 }),
      logo: make("fade", { duration: 0.8, delay: 0.1 }),
    },
  },
];

export function getCoverAnimationPreset(id?: CoverAnimationPresetId) {
  return COVER_ANIMATION_PRESETS.find((preset) => preset.id === id);
}

export function resolveCoverAnimationSpec(design: CoverAnimationDesign, target: CoverAnimationTarget): CoverAnimationSpec {
  if (!design.coverAnimationPreset || design.coverAnimationPreset === "none") return DEFAULT_COVER_ANIMATION_SPEC;
  const preset = getCoverAnimationPreset(design.coverAnimationPreset);
  const fromPreset = preset?.elements[target] ?? DEFAULT_COVER_ANIMATION_SPEC;
  return {
    ...DEFAULT_COVER_ANIMATION_SPEC,
    ...fromPreset,
    ...(design.coverAnimations?.[target] ?? {}),
  };
}

export function coverAnimationFingerprint(design: CoverAnimationDesign, target: CoverAnimationTarget) {
  const spec = resolveCoverAnimationSpec(design, target);
  return `${design.coverAnimationPreset || "none"}:${design.coverAnimationSpeed || 1}:${design.coverAnimationReplayKey || 0}:${target}:${JSON.stringify(spec)}`;
}


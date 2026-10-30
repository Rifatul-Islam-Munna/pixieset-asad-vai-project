"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { motion, useReducedMotion, type MotionProps } from "motion/react";
import {
  coverAnimationFingerprint,
  resolveCoverAnimationSpec,
  type CoverAnimationDesign,
  type CoverAnimationEase,
  type CoverAnimationSpec,
  type CoverAnimationTarget,
} from "@/lib/cover-animation";
import { cn } from "@/lib/utils";

const easeMap: Record<Exclude<CoverAnimationEase, "spring">, readonly [number, number, number, number] | "linear"> = {
  smooth: [0.22, 1, 0.36, 1],
  soft: [0.25, 0.7, 0.3, 1],
  dramatic: [0.16, 1, 0.3, 1],
  linear: "linear",
};

function clampSpeed(value?: number) {
  return Math.min(3, Math.max(0.25, Number(value) || 1));
}

function animationState(spec: CoverAnimationSpec) {
  const distance = Number(spec.distance) || 48;
  const scale = Number(spec.scale) || 0.9;
  const rotate = Number(spec.rotate) || -6;
  const blur = Number(spec.blur) || 14;
  switch (spec.effect) {
    case "fade":
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
    case "rise":
      return { initial: { opacity: 0, y: distance }, animate: { opacity: 1, y: 0 } };
    case "drop":
      return { initial: { opacity: 0, y: -distance }, animate: { opacity: 1, y: 0 } };
    case "slide-left":
      return { initial: { opacity: 0, x: -distance }, animate: { opacity: 1, x: 0 } };
    case "slide-right":
      return { initial: { opacity: 0, x: distance }, animate: { opacity: 1, x: 0 } };
    case "zoom-in":
      return { initial: { opacity: 0, scale }, animate: { opacity: 1, scale: 1 } };
    case "zoom-out":
      return { initial: { opacity: 0, scale: Math.max(1.01, scale) }, animate: { opacity: 1, scale: 1 } };
    case "blur-in":
      return { initial: { opacity: 0, filter: `blur(${blur}px)`, scale: Math.max(1, scale) }, animate: { opacity: 1, filter: "blur(0px)", scale: 1 } };
    case "rotate-in":
      return { initial: { opacity: 0, rotate, scale }, animate: { opacity: 1, rotate: 0, scale: 1 } };
    case "flip-up":
      return { initial: { opacity: 0, rotateX: 82, y: distance * 0.45, transformPerspective: 900 }, animate: { opacity: 1, rotateX: 0, y: 0, transformPerspective: 900 } };
    case "mask-up":
      return { initial: { opacity: 0, clipPath: "inset(100% 0 0 0)", y: distance * 0.25 }, animate: { opacity: 1, clipPath: "inset(0% 0 0 0)", y: 0 } };
    case "mask-left":
      return { initial: { opacity: 0, clipPath: "inset(0 100% 0 0)" }, animate: { opacity: 1, clipPath: "inset(0 0% 0 0)" } };
    case "elastic":
      return { initial: { opacity: 0, scale, y: distance * 0.2 }, animate: { opacity: 1, scale: 1, y: 0 } };
    case "drift":
      return { initial: { opacity: 1, scale: 1.015, x: "-0.8%", y: "0%" }, animate: { opacity: 1, scale: Math.max(1.025, scale), x: "0.9%", y: "-0.6%" } };
    case "ken-burns":
      return { initial: { opacity: 1, scale: 1.01, x: "0%", y: "0%" }, animate: { opacity: 1, scale: Math.max(1.04, scale), x: "-1.2%", y: "-0.7%" } };
    default:
      return { initial: { opacity: 1 }, animate: { opacity: 1 } };
  }
}

function transitionFor(spec: CoverAnimationSpec, speed: number, tokenIndex = 0) {
  const duration = Math.max(0.05, Number(spec.duration) || 0.8) / speed;
  const delay = (Math.max(0, Number(spec.delay) || 0) + tokenIndex * Math.max(0, Number(spec.stagger) || 0)) / speed;
  if (spec.ease === "spring" || spec.effect === "elastic") {
    return {
      type: "spring" as const,
      stiffness: 170,
      damping: 18,
      mass: 0.72,
      delay,
      repeat: spec.loop ? Infinity : 0,
      repeatType: "mirror" as const,
      repeatDelay: spec.loop ? 0.35 / speed : 0,
    };
  }
  return {
    duration,
    delay,
    ease: easeMap[spec.ease],
    repeat: spec.loop ? Infinity : 0,
    repeatType: "mirror" as const,
    repeatDelay: spec.loop ? 0.35 / speed : 0,
  };
}

function useAnimation(design: CoverAnimationDesign, target: CoverAnimationTarget, disabled = false) {
  const reducedMotion = useReducedMotion();
  const spec = resolveCoverAnimationSpec(design, target);
  const disabledMotion = disabled || reducedMotion || spec.effect === "none";
  const speed = clampSpeed(design.coverAnimationSpeed);
  const state = disabledMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : animationState(spec);
  return {
    ...state,
    spec,
    speed,
    disabledMotion,
    fingerprint: coverAnimationFingerprint(design, target),
  };
}

export function AnimatedCoverMedia({
  src,
  video,
  className,
  style,
  design,
  disabled,
}: {
  src: string;
  video?: boolean;
  className?: string;
  style?: CSSProperties;
  design: CoverAnimationDesign;
  disabled?: boolean;
}) {
  const animation = useAnimation(design, "media", disabled);
  const props = {
    key: animation.fingerprint,
    className,
    style,
    initial: animation.initial as any,
    animate: animation.animate as any,
    transition: transitionFor(animation.spec, animation.speed),
  };
  return video ? (
    <motion.video {...props} src={src} autoPlay muted loop playsInline preload="metadata" aria-label="Animated gallery cover" />
  ) : (
    <motion.img {...props} src={src} alt="" />
  );
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Smallest size a cover text may shrink to while fitting. */
const FIT_MIN_PX: Partial<Record<CoverAnimationTarget, number>> = { title: 14 };
/** Most lines a cover text may take before it shrinks (default 2). */
const FIT_MAX_LINES: Partial<Record<CoverAnimationTarget, number>> = { title: 3 };

/**
 * Shrinks cover text until it fits its box on every screen: no word wider
 * than the box, at most a few lines, and inside the box height when the box
 * clips (custom templates). It measures a hidden copy without animations, so
 * entrance motion never skews the result, and refits when the cover resizes
 * or web fonts finish loading. It always starts from the designed size, so
 * text never grows past what the photographer chose.
 */
function useFitCoverText(
  ref: RefObject<HTMLElement | null>,
  text: string,
  target: CoverAnimationTarget,
  baseFontSize: CSSProperties["fontSize"],
  fingerprint: string,
) {
  const base = typeof baseFontSize === "number" ? `${baseFontSize}px` : baseFontSize ?? "";
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;

    const fit = () => {
      frame = 0;
      const host = el.parentElement;
      if (!host || !el.isConnected || !text.trim()) return;
      el.style.fontSize = base;
      const width = el.offsetWidth;
      if (width <= 0) return;
      const clips = /hidden|clip/.test(getComputedStyle(el).overflow);
      const probe = el.cloneNode(false) as HTMLElement;
      probe.removeAttribute("id");
      probe.setAttribute("aria-hidden", "true");
      probe.textContent = text;
      Object.assign(probe.style, {
        position: "absolute",
        left: "0",
        top: "0",
        visibility: "hidden",
        pointerEvents: "none",
        transform: "none",
        opacity: "0",
        width: `${width}px`,
        maxWidth: "none",
        height: clips ? `${el.offsetHeight}px` : "auto",
        minHeight: "0",
        maxHeight: "none",
        overflowWrap: "normal",
        wordBreak: "normal",
      });
      host.appendChild(probe);
      const maxLines = FIT_MAX_LINES[target] ?? 2;
      const overflows = () => {
        if (probe.scrollWidth > probe.clientWidth + 1) return true;
        if (clips) return probe.scrollHeight > probe.clientHeight + 1;
        const style = getComputedStyle(probe);
        const fontPx = Number.parseFloat(style.fontSize) || 16;
        const linePx = Number.parseFloat(style.lineHeight) || fontPx * 1.2;
        const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
        return Math.round((probe.scrollHeight - padding) / linePx) > maxLines;
      };
      let size = Number.parseFloat(getComputedStyle(probe).fontSize) || 16;
      const min = Math.min(size, FIT_MIN_PX[target] ?? 9);
      let shrunk = false;
      for (let guard = 0; guard < 48 && size > min && overflows(); guard += 1) {
        size = Math.max(min, Math.floor(size * 0.93 * 10) / 10);
        probe.style.fontSize = `${size}px`;
        shrunk = true;
      }
      probe.remove();
      if (shrunk) el.style.fontSize = `${size}px`;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(fit);
    };
    fit();
    // Watch the cover, not the text's own box, so shrinking never re-triggers.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    const root = el.closest(".cover-preview-root") ?? el.parentElement;
    if (root) observer?.observe(root);
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    fonts?.ready.then(schedule).catch(() => undefined);
    fonts?.addEventListener?.("loadingdone", schedule);
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener?.("loadingdone", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [base, text, target, fingerprint]);
}

export function AnimatedCoverText({
  as = "span",
  target,
  text,
  className,
  style,
  design,
  disabled,
}: {
  as?: "span" | "p" | "h3";
  target: CoverAnimationTarget;
  text: string;
  className?: string;
  style?: CSSProperties;
  design: CoverAnimationDesign;
  disabled?: boolean;
}) {
  const animation = useAnimation(design, target, disabled);
  const ref = useRef<HTMLElement | null>(null);
  useFitCoverText(ref, text, target, style?.fontSize, animation.fingerprint);
  const MotionTag: any = as === "h3" ? motion.h3 : as === "p" ? motion.p : motion.span;
  const split = animation.disabledMotion ? "none" : animation.spec.split;
  if (split === "none") {
    return (
      <MotionTag
        ref={ref}
        key={animation.fingerprint}
        className={className}
        style={style}
        initial={animation.initial}
        animate={animation.animate}
        transition={transitionFor(animation.spec, animation.speed)}
      >
        {text}
      </MotionTag>
    );
  }

  // Letters animate one by one, but each word stays one unbreakable unit,
  // so lines only ever wrap between words (never mid-word on phones).
  const parts = text.split(/(\s+)/);
  const lengths = parts.map((part) => (split === "characters" ? Array.from(part).length : 1));
  const starts = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, n) => sum + n, 0));
  const tokenState = animationState(animation.spec);
  const tokenMotion = {
    initial: tokenState.initial,
    animate: tokenState.animate,
  } as unknown as Pick<MotionProps, "initial" | "animate">;
  return (
    <MotionTag ref={ref} key={animation.fingerprint} className={className} style={style} aria-label={text}>
      {parts.map((part, index) => {
        const start = starts[index];
        if (!part) return null;
        if (/^\s+$/.test(part)) return <span key={`${index}-space`} aria-hidden>{part}</span>;
        if (split === "characters") {
          return (
            <span key={`${part}-${index}`} aria-hidden className="inline-block whitespace-nowrap">
              {Array.from(part).map((char, offset) => (
                <motion.span
                  key={`${char}-${offset}`}
                  className="inline-block will-change-transform"
                  {...tokenMotion}
                  transition={transitionFor(animation.spec, animation.speed, start + offset)}
                >
                  {char}
                </motion.span>
              ))}
            </span>
          );
        }
        return (
          <motion.span
            key={`${part}-${index}`}
            aria-hidden
            className="inline-block will-change-transform"
            {...tokenMotion}
            transition={transitionFor(animation.spec, animation.speed, start)}
          >
            {part}
          </motion.span>
        );
      })}
    </MotionTag>
  );
}

export function AnimatedCoverBox({
  target,
  design,
  disabled,
  className,
  style,
  children,
}: {
  target: CoverAnimationTarget;
  design: CoverAnimationDesign;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const animation = useAnimation(design, target, disabled);
  return (
    <motion.div
      key={animation.fingerprint}
      className={cn("will-change-transform", className)}
      style={style}
      initial={animation.initial as any}
      animate={animation.animate as any}
      transition={transitionFor(animation.spec, animation.speed)}
    >
      {children}
    </motion.div>
  );
}

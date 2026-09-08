"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
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
  const MotionTag: any = as === "h3" ? motion.h3 : as === "p" ? motion.p : motion.span;
  const split = animation.disabledMotion ? "none" : animation.spec.split;
  if (split === "none") {
    return (
      <MotionTag
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

  const tokens = split === "characters" ? Array.from(text) : text.split(/(\s+)/);
  return (
    <MotionTag key={animation.fingerprint} className={className} style={style} aria-label={text}>
      {tokens.map((token, index) => {
        const whitespace = /^\s+$/.test(token);
        if (whitespace) return <span key={`${index}-space`} aria-hidden>{token}</span>;
        const tokenState = animationState(animation.spec);
        return (
          <motion.span
            key={`${token}-${index}`}
            aria-hidden
            className="inline-block will-change-transform"
            initial={tokenState.initial as any}
            animate={tokenState.animate as any}
            transition={transitionFor(animation.spec, animation.speed, index)}
          >
            {token}
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

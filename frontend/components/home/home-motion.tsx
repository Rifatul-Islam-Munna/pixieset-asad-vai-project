"use client";

import { useEffect, type ReactNode } from "react";
import { animate, inView } from "motion";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

export function HomeReveal({
  children,
  className,
  delay = 0,
  y = 34,
  amount = 0.18,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y, filter: "blur(8px)" }}
      whileInView={
        reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }
      }
      viewport={{ once: true, amount }}
      transition={{ duration: 0.78, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function HomeHoverLift({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduceMotion ? undefined : { y: -7, scale: 1.012 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}

export function HomeMotion() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const root = document.querySelector<HTMLElement>("main");
    if (!root) return;

    const selector =
      "main > section:not(:first-of-type):not([data-home-motion-managed]), main > footer";
    const revealSelector = "[data-home-reveal]";
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const revealNodes = Array.from(
      document.querySelectorAll<HTMLElement>(revealSelector),
    );
    nodes.forEach((node) => {
      node.style.opacity = "0";
      node.style.transform = "translateY(52px) scale(.992)";
      node.style.clipPath = "inset(7% 0 0 0 round 16px)";
      node.style.willChange = "transform, opacity, clip-path";
    });

    revealNodes.forEach((node) => {
      const siblingIndex = Array.from(
        node.parentElement?.children ?? [],
      ).indexOf(node);
      node.dataset.homeMotionIndex = String(Math.max(0, siblingIndex));
      node.style.opacity = "0";
      node.style.transform = "translateY(32px) scale(.985)";
      node.style.filter = "blur(7px)";
      node.style.willChange = "transform, opacity, filter";
    });

    const stop = inView(
      selector,
      (element) => {
        animate(
          element,
          {
            opacity: 1,
            transform: "translateY(0px) scale(1)",
            clipPath: "inset(0% 0 0 0 round 0px)",
          },
          { duration: 1.05, ease },
        );
      },
      { amount: 0.1, margin: "0px 0px -8% 0px" },
    );

    const stopReveal = inView(
      revealSelector,
      (element) => {
        const node = element as HTMLElement;
        const delay = Math.min(
          0.28,
          Number(node.dataset.homeMotionIndex ?? 0) * 0.055,
        );
        node.dataset.homeVisible = "true";
        animate(
          element,
          {
            opacity: 1,
            transform: "translateY(0px) scale(1)",
            filter: "blur(0px)",
          },
          { duration: 0.78, delay, ease },
        );
      },
      { amount: 0.14, margin: "0px 0px -5% 0px" },
    );

    const mediaNodes = Array.from(
      root.querySelectorAll<HTMLElement>(
        "section:not(:first-of-type) img, section:not(:first-of-type) video",
      ),
    ).filter((node) => !node.closest("footer"));

    mediaNodes.forEach((node) => {
      node.style.willChange = "transform";
      node.dataset.homeParallax = "true";
    });

    let frame = 0;
    const updateParallax = () => {
      frame = 0;
      const viewportHeight = window.innerHeight || 1;
      mediaNodes.forEach((node, index) => {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -120 || rect.top > viewportHeight + 120) return;
        const center = rect.top + rect.height / 2;
        const progress = Math.max(
          -1,
          Math.min(1, (center - viewportHeight / 2) / viewportHeight),
        );
        const y = progress * (index % 2 === 0 ? -18 : 18);
        const scale = 1.018 + Math.abs(progress) * 0.012;
        node.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      });
    };

    const requestParallax = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateParallax);
    };

    updateParallax();
    window.addEventListener("scroll", requestParallax, { passive: true });
    window.addEventListener("resize", requestParallax);

    return () => {
      stop();
      stopReveal();
      window.removeEventListener("scroll", requestParallax);
      window.removeEventListener("resize", requestParallax);
      if (frame) window.cancelAnimationFrame(frame);

      revealNodes.forEach((node) => {
        delete node.dataset.homeVisible;
        delete node.dataset.homeMotionIndex;
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
        node.style.removeProperty("filter");
        node.style.removeProperty("will-change");
      });

      nodes.forEach((node) => {
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
        node.style.removeProperty("clip-path");
        node.style.removeProperty("will-change");
      });
      mediaNodes.forEach((node) => {
        delete node.dataset.homeParallax;
        node.style.removeProperty("transform");
        node.style.removeProperty("will-change");
      });
    };
  }, [reduceMotion]);

  return null;
}

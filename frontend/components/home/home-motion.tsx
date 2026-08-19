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
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.72, delay, ease }}
    >
      {children}
    </motion.div>
  );
}
export function HomeHoverLift({ children, className }: { children: ReactNode; className?: string }) {
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
    const selector = "main > section:not(:first-of-type):not([data-home-motion-managed]), main > footer";
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    nodes.forEach((node) => {
      node.style.opacity = "0";
      node.style.transform = "translateY(30px)";
    });
    const stop = inView(
      selector,
      (element) => {
        animate(element, { opacity: 1, transform: "translateY(0px)" }, { duration: 0.72, ease });
      },
      { amount: 0.12, margin: "0px 0px -6% 0px" },
    );
    const revealSelector = "[data-home-reveal]";
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>(revealSelector));
    revealNodes.forEach((node) => {
      node.style.opacity = "0";
      node.style.transform = "translateY(22px) scale(.985)";
    });
    const stopReveal = inView(revealSelector, (element) => {
      (element as HTMLElement).dataset.homeVisible = "true";
      animate(element, { opacity: 1, transform: "translateY(0px) scale(1)" }, { duration: 0.6, ease });
    }, { amount: 0.2 });

    return () => {
      stop();
      stopReveal();
      revealNodes.forEach((node) => {
        delete node.dataset.homeVisible;
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
      });
      nodes.forEach((node) => {
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
      });
    };
  }, [reduceMotion]);

  return null;
}

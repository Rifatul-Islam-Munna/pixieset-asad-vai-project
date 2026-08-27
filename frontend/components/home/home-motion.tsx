"use client";

import { useEffect, type ReactNode } from "react";
import { animate, inView } from "motion";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

export function HomeReveal({ children, className, delay = 0, y = 34, amount = 0.18 }: {
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
      transition={{ duration: 0.82, delay, ease }}
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
    const root = document.querySelector<HTMLElement>("main");
    if (!root) return;

    const sectionSelector = "main > section:not(:first-of-type):not([data-home-motion-managed]), main > footer";
    const scrollSectionSelector = "main > section:not([data-home-motion-managed]), main > footer";
    const explicitRevealSelector = "[data-home-reveal]";
    const sections = Array.from(document.querySelectorAll<HTMLElement>(sectionSelector));
    const scrollSections = Array.from(document.querySelectorAll<HTMLElement>(scrollSectionSelector));
    const explicitReveals = Array.from(document.querySelectorAll<HTMLElement>(explicitRevealSelector));

    sections.forEach((node) => {
      node.style.opacity = "0";
      node.style.transform = "translateY(64px) scale(.986)";
      node.style.clipPath = "inset(9% 0 0 0 round 24px)";
      node.style.filter = "blur(5px)";
      node.style.willChange = "transform, opacity, clip-path, filter, translate";
    });

    const autoRevealNodes = sections.flatMap((section) =>
      Array.from(section.querySelectorAll<HTMLElement>("h2, h3, h4, p, li, a, button"))
        .filter((node) => !node.closest("[data-home-reveal]") && !node.closest("nav") && !node.closest("footer nav")),
    );
    const revealNodes = [...new Set([...explicitReveals, ...autoRevealNodes])];
    revealNodes.forEach((node) => {
      const siblings = Array.from(node.parentElement?.children ?? []);
      const siblingIndex = Math.max(0, siblings.indexOf(node));
      node.dataset.homeMotionIndex = String(siblingIndex);
      node.style.opacity = "0";
      node.style.translate = `0 ${Math.min(42, 20 + siblingIndex * 3)}px`;
      node.style.filter = "blur(8px)";
      node.style.willChange = "opacity, translate, filter";
    });

    const mediaNodes = Array.from(root.querySelectorAll<HTMLElement>(
      "section:not([data-home-motion-managed]) img, section:not([data-home-motion-managed]) video",
    ));
    mediaNodes.forEach((node) => {
      node.dataset.homeParallax = "true";
      node.style.willChange = "translate, scale, rotate, transform";
      node.style.transformOrigin = "50% 50%";
    });

    const depthNodes = sections.flatMap((section) =>
      Array.from(section.querySelectorAll<HTMLElement>(
        ":scope > div, :scope > article, :scope > figure, .grid > article, .grid > div[data-home-reveal]",
      )),
    ).filter((node) => !node.closest("[data-home-motion-managed]"));
    depthNodes.forEach((node, index) => {
      node.dataset.homeDepthIndex = String(index);
      node.style.willChange = "translate, scale, rotate, transform";
      node.style.transformOrigin = "50% 50%";
    });

    const stopSections = inView(sectionSelector, (element) => {
      animate(element, {
        opacity: 1,
        transform: "translateY(0px) scale(1)",
        clipPath: "inset(0% 0 0 0 round 0px)",
        filter: "blur(0px)",
      }, { duration: 1.12, ease });
    }, { amount: 0.08, margin: "0px 0px -5% 0px" });

    const stopReveal = inView(revealNodes, (element) => {
      const node = element as HTMLElement;
      const delay = Math.min(0.34, Number(node.dataset.homeMotionIndex ?? 0) * 0.052);
      node.dataset.homeVisible = "true";
      animate(element, {
        opacity: 1,
        translate: "0 0px",
        filter: "blur(0px)",
      }, { duration: 0.86, delay, ease });
    }, { amount: 0.12, margin: "0px 0px -4% 0px" });

    let frame = 0;
    let currentScroll = window.scrollY;
    let targetScroll = currentScroll;
    let settling = false;

    const applyScrollMotion = () => {
      frame = 0;
      currentScroll += (targetScroll - currentScroll) * 0.16;
      const viewportHeight = window.innerHeight || 1;

      scrollSections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        if (rect.bottom < -viewportHeight * 0.35 || rect.top > viewportHeight * 1.35) return;
        const center = rect.top + rect.height / 2;
        const range = Math.max(viewportHeight, (viewportHeight + rect.height) / 2);
        const progress = Math.max(-1, Math.min(1, (center - viewportHeight / 2) / range));
        const y = progress * (index % 2 === 0 ? 16 : -16);
        const x = progress * (index % 3 === 0 ? 8 : index % 3 === 1 ? -6 : 4);
        const scale = 1 - Math.min(0.022, Math.abs(progress) * 0.018);
        section.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
        section.style.scale = scale.toFixed(4);
        section.style.setProperty("--home-scroll-progress", progress.toFixed(4));
      });

      depthNodes.forEach((node, index) => {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -160 || rect.top > viewportHeight + 160) return;
        const center = rect.top + rect.height / 2;
        const progress = Math.max(-1, Math.min(1, (center - viewportHeight / 2) / viewportHeight));
        const direction = index % 2 === 0 ? 1 : -1;
        const x = progress * direction * (10 + (index % 4) * 2);
        const y = progress * (8 + (index % 3) * 3);
        const rotate = progress * direction * 0.32;
        const scale = 1 - Math.min(0.018, Math.abs(progress) * 0.014);
        node.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
        node.style.rotate = `${rotate.toFixed(3)}deg`;
        node.style.scale = scale.toFixed(4);
      });

      mediaNodes.forEach((node, index) => {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -180 || rect.top > viewportHeight + 180) return;
        const center = rect.top + rect.height / 2;
        const progress = Math.max(-1, Math.min(1, (center - viewportHeight / 2) / viewportHeight));
        const direction = index % 2 === 0 ? -1 : 1;
        const y = progress * 38 * direction;
        const x = progress * (index % 3 === 0 ? 12 : index % 3 === 1 ? -8 : 5);
        const scale = 1.032 + Math.abs(progress) * 0.034;
        const rotate = progress * direction * 0.55;
        const tiltX = progress * direction * -1.15;
        const tiltY = progress * (index % 3 === 0 ? 1.2 : -0.8);
        const depth = Math.max(0, 16 - Math.abs(progress) * 12);
        node.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
        node.style.scale = scale.toFixed(4);
        node.style.rotate = `${rotate.toFixed(3)}deg`;
        node.style.transform = `perspective(1000px) rotateX(${tiltX.toFixed(3)}deg) rotateY(${tiltY.toFixed(3)}deg) translateZ(${depth.toFixed(2)}px)`;
      });

      revealNodes.forEach((node, index) => {
        if (node.dataset.homeVisible !== "true") return;
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > viewportHeight + 100) return;
        const center = rect.top + rect.height / 2;
        const progress = Math.max(-1, Math.min(1, (center - viewportHeight / 2) / viewportHeight));
        const drift = progress * (index % 2 === 0 ? 5 : -5);
        node.style.translate = `0 ${drift.toFixed(2)}px`;
      });

      const distance = Math.abs(targetScroll - currentScroll);
      settling = distance > 0.25;
      if (settling) frame = window.requestAnimationFrame(applyScrollMotion);
    };

    const requestMotion = () => {
      targetScroll = window.scrollY;
      if (!frame) frame = window.requestAnimationFrame(applyScrollMotion);
    };
    const requestResize = () => {
      targetScroll = window.scrollY;
      currentScroll = targetScroll;
      if (!frame) frame = window.requestAnimationFrame(applyScrollMotion);
    };

    applyScrollMotion();
    window.addEventListener("scroll", requestMotion, { passive: true });
    window.addEventListener("resize", requestResize);

    return () => {
      stopSections();
      stopReveal();
      window.removeEventListener("scroll", requestMotion);
      window.removeEventListener("resize", requestResize);
      if (frame) window.cancelAnimationFrame(frame);

      scrollSections.forEach((node) => {
        node.style.removeProperty("translate");
        node.style.removeProperty("scale");
        node.style.removeProperty("--home-scroll-progress");
      });
      depthNodes.forEach((node) => {
        delete node.dataset.homeDepthIndex;
        node.style.removeProperty("translate");
        node.style.removeProperty("scale");
        node.style.removeProperty("rotate");
        node.style.removeProperty("transform");
        node.style.removeProperty("transform-origin");
        node.style.removeProperty("will-change");
      });
      sections.forEach((node) => {
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
        node.style.removeProperty("clip-path");
        node.style.removeProperty("filter");
        node.style.removeProperty("will-change");
      });
      revealNodes.forEach((node) => {
        delete node.dataset.homeVisible;
        delete node.dataset.homeMotionIndex;
        node.style.removeProperty("opacity");
        node.style.removeProperty("translate");
        node.style.removeProperty("filter");
        node.style.removeProperty("will-change");
      });
      mediaNodes.forEach((node) => {
        delete node.dataset.homeParallax;
        node.style.removeProperty("translate");
        node.style.removeProperty("scale");
        node.style.removeProperty("rotate");
        node.style.removeProperty("transform");
        node.style.removeProperty("transform-origin");
        node.style.removeProperty("will-change");
      });
    };
  }, [reduceMotion]);

  return null;
}

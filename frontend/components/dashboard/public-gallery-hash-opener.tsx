"use client";

import { useEffect } from "react";

export function PublicGalleryHashOpener() {
  useEffect(() => {
    let timer: number | undefined;

    const openHashPhoto = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#photo-")) return;
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) {
        timer = window.setTimeout(openHashPhoto, 180);
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      const previewButton = target.querySelector<HTMLButtonElement>("button");
      window.setTimeout(() => previewButton?.click(), 260);
    };

    openHashPhoto();
    window.addEventListener("hashchange", openHashPhoto);
    return () => {
      window.removeEventListener("hashchange", openHashPhoto);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}

"use client";

import { useEffect, useState } from "react";
import hotkeys from "hotkeys-js";

export function ScreenCaptureGuard({ enabled = true }: { enabled?: boolean }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof window.setTimeout> | undefined;
    const showBriefly = () => {
      setActive(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setActive(false), 1800);
    };
    const show = () => setActive(true);
    const hide = () => setActive(false);
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "printscreen" || ((event.ctrlKey || event.metaKey) && key === "p")) {
        event.preventDefault();
        void navigator.clipboard?.writeText("");
        showBriefly();
      }
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onDragStart = (event: DragEvent) => event.preventDefault();
    const onVisibilityChange = () => {
      if (document.hidden) show();
      else hide();
    };
    const hotkeyHandler = (event: KeyboardEvent) => {
      event.preventDefault();
      void navigator.clipboard?.writeText("");
      showBriefly();
    };

    hotkeys.filter = () => true;
    hotkeys("printscreen,ctrl+p,command+p,ctrl+s,command+s,ctrl+shift+s,command+shift+s", hotkeyHandler);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", show);
    window.addEventListener("focus", hide);
    window.addEventListener("beforeprint", show);
    window.addEventListener("afterprint", hide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("dragstart", onDragStart, true);
    return () => {
      if (timer) window.clearTimeout(timer);
      hotkeys.unbind("printscreen,ctrl+p,command+p,ctrl+s,command+s,ctrl+shift+s,command+shift+s", hotkeyHandler);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", show);
      window.removeEventListener("focus", hide);
      window.removeEventListener("beforeprint", show);
      window.removeEventListener("afterprint", hide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          body::before {
            content: "";
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            display: block;
            background: #000;
            visibility: visible !important;
          }
        }
      `}</style>
      {active && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[2147483647] bg-black"
        />
      )}
    </>
  );
}

"use client";

import { useEffect } from "react";
import hotkeys from "hotkeys-js";

type ScreenCaptureGuardProps = {
  enabled?: boolean;
};

const BLOCKED_HOTKEYS =
  "printscreen,ctrl+p,command+p,ctrl+s,command+s,ctrl+shift+s,command+shift+s,command+shift+3,command+shift+4,command+shift+5";

export function ScreenCaptureGuard({ enabled = true }: ScreenCaptureGuardProps) {
  useEffect(() => {
    if (!enabled) return;

    const blockEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const hotkeyHandler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    hotkeys.filter = () => true;
    hotkeys(BLOCKED_HOTKEYS, hotkeyHandler);
    document.addEventListener("contextmenu", blockEvent, true);
    document.addEventListener("dragstart", blockEvent, true);
    document.addEventListener("copy", blockEvent, true);

    return () => {
      hotkeys.unbind(BLOCKED_HOTKEYS, hotkeyHandler);
      document.removeEventListener("contextmenu", blockEvent, true);
      document.removeEventListener("dragstart", blockEvent, true);
      document.removeEventListener("copy", blockEvent, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <style>{`
      @media print {
        body * { visibility: hidden !important; }
        body::before {
          content: "Protected collection";
          position: fixed; inset: 0; z-index: 2147483647;
          display: grid; place-items: center;
          background: #000; color: #fff;
          visibility: visible !important;
        }
      }
      img, video { -webkit-user-drag: none; user-select: none; }
    `}</style>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import hotkeys from "hotkeys-js";

type ScreenCaptureGuardProps = {
  enabled?: boolean;
  watermark?: string;
};

const BLOCKED_HOTKEYS =
  "printscreen,ctrl+p,command+p,ctrl+s,command+s,ctrl+shift+s,command+shift+s,command+shift+3,command+shift+4,command+shift+5";

export function ScreenCaptureGuard({
  enabled = true,
  watermark = "Protected collection",
}: ScreenCaptureGuardProps) {
  const [shielded, setShielded] = useState(false);
  const sessionMark = useMemo(() => {
    if (typeof window === "undefined") return "";
    const existing = window.sessionStorage.getItem("gallery-protection-id");
    if (existing) return existing;
    const id = crypto.randomUUID().slice(0, 8).toUpperCase();
    window.sessionStorage.setItem("gallery-protection-id", id);
    return id;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const showBriefly = () => {
      setShielded(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShielded(false), 1800);
    };
    const show = () => setShielded(true);
    const hide = () => setShielded(false);
    const clearClipboard = () => {
      void navigator.clipboard?.writeText("").catch(() => undefined);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const screenshotCombo =
        key === "printscreen" ||
        (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key)) ||
        (event.shiftKey && key === "s" && event.metaKey);
      const browserExport =
        (event.ctrlKey || event.metaKey) && ["p", "s"].includes(key);
      if (!screenshotCombo && !browserExport) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clearClipboard();
      showBriefly();
    };
    const blockEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const onVisibilityChange = () => setShielded(document.hidden);
    const hotkeyHandler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearClipboard();
      showBriefly();
    };

    hotkeys.filter = () => true;
    hotkeys(BLOCKED_HOTKEYS, hotkeyHandler);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", show);
    window.addEventListener("focus", hide);
    window.addEventListener("beforeprint", show);
    window.addEventListener("afterprint", hide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("contextmenu", blockEvent, true);
    document.addEventListener("dragstart", blockEvent, true);
    document.addEventListener("copy", blockEvent, true);

    return () => {
      if (timer) clearTimeout(timer);
      hotkeys.unbind(BLOCKED_HOTKEYS, hotkeyHandler);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", show);
      window.removeEventListener("focus", hide);
      window.removeEventListener("beforeprint", show);
      window.removeEventListener("afterprint", hide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("contextmenu", blockEvent, true);
      document.removeEventListener("dragstart", blockEvent, true);
      document.removeEventListener("copy", blockEvent, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
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
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[2147483000] overflow-hidden select-none">
        <div className="absolute -inset-[30%] grid rotate-[-24deg] grid-cols-3 gap-x-24 gap-y-28 opacity-[0.075]">
          {Array.from({ length: 36 }, (_, index) => (
            <span key={index} className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-black mix-blend-multiply">
              {watermark} · {sessionMark}
            </span>
          ))}
        </div>
      </div>
      {shielded && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[2147483647] grid place-items-center bg-black text-white"
        >
          <p className="px-6 text-center text-sm font-semibold uppercase tracking-[0.2em]">
            Protected collection
          </p>
        </div>
      )}
    </>
  );
}

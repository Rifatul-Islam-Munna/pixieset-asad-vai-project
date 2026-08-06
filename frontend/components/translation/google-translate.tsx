"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const AUTO_LANGUAGES = "fr,de,ar";

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement?: new (
          options: Record<string, unknown>,
          elementId: string,
        ) => unknown;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

export function GoogleTranslate() {
  const pathname = usePathname();

  useEffect(() => {
    const clearTranslationCookie = () => {
      document.cookie = "googtrans=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie = `googtrans=; Domain=.${window.location.hostname}; Path=/; Max-Age=0; SameSite=Lax`;
    };

    if (pathname !== "/") {
      const wasTranslated =
        document.cookie.includes("googtrans=") ||
        document.documentElement.classList.contains("translated-ltr") ||
        document.documentElement.classList.contains("translated-rtl");
      clearTranslationCookie();
      if (wasTranslated && !window.sessionStorage.getItem("translation_cleanup_reload")) {
        window.sessionStorage.setItem("translation_cleanup_reload", "1");
        window.location.reload();
        return;
      }
      window.sessionStorage.removeItem("translation_cleanup_reload");
    } else {
      window.sessionStorage.removeItem("translation_cleanup_reload");
      const saved = window.localStorage.getItem("home_selected_language");
      if (saved === "fr" || saved === "de" || saved === "ar") {
        document.cookie = `googtrans=/en/${saved}; Path=/; Max-Age=31536000; SameSite=Lax`;
      }
    }

    const hideGoogleUi = () => {
      document
        .querySelectorAll(
          "iframe.goog-te-banner-frame, iframe.skiptranslate, body > .skiptranslate, #goog-gt-tt, .goog-te-balloon-frame",
        )
        .forEach((element) => {
          (element as HTMLElement).style.setProperty("display", "none", "important");
        });
      document.documentElement.style.setProperty("top", "0px", "important");
      document.body.style.setProperty("top", "0px", "important");
      document.body.style.setProperty("position", "static", "important");
      document.body.style.setProperty("margin-top", "0px", "important");
    };

    hideGoogleUi();
    const observer = new MutationObserver(hideGoogleUi);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const interval = window.setInterval(hideGoogleUi, 250);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [pathname]);

  if (pathname !== "/") return null;

  return (
    <>
      <div id="google_translate_element" className="hidden" aria-hidden="true" />
      <Script
        id="google-translate-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.googleTranslateElementInit = function () {
              if (!window.google?.translate?.TranslateElement) return;
              new window.google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: '${AUTO_LANGUAGES}',
                autoDisplay: false
              }, 'google_translate_element');
            };
          `,
        }}
      />
      <Script
        id="google-translate-library"
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  );
}

"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const AUTO_LANGUAGES = "es,fr,de,el,ar";
const GOOGLE_LANGUAGE_CODES = new Set(AUTO_LANGUAGES.split(","));

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
    applyGoogleTranslation?: () => void;
  }
}

function initializeGoogleTranslation() {
  window.googleTranslateElementInit?.();
}

export function GoogleTranslate() {
  const pathname = usePathname();
  const routeEnabled = pathname === "/" || pathname.startsWith("/collection/");
  const [automaticLanguage, setAutomaticLanguage] = useState("");

  useEffect(() => {
    const isCollection = pathname.startsWith("/collection/");
    const clearTranslationCookie = () => {
      document.cookie = "googtrans=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie = `googtrans=; Domain=.${window.location.hostname}; Path=/; Max-Age=0; SameSite=Lax`;
    };

    const selectedLanguage = () => {
      if (isCollection) {
        return document
          .querySelector<HTMLElement>("[data-gallery-language]")
          ?.dataset.galleryLanguage;
      }
      return window.localStorage.getItem("home_selected_language");
    };

    if (!routeEnabled) {
      setAutomaticLanguage("");
      clearTranslationCookie();
      delete window.applyGoogleTranslation;
      document.documentElement.style.removeProperty("top");
      document.body.style.removeProperty("top");
      document.body.style.removeProperty("position");
      document.body.style.removeProperty("margin-top");
      return;
    }

    const requestedLanguage = selectedLanguage() ?? "en";
    const shouldLoadTranslator = GOOGLE_LANGUAGE_CODES.has(requestedLanguage);
    setAutomaticLanguage(shouldLoadTranslator ? requestedLanguage : "");
    if (!shouldLoadTranslator) {
      clearTranslationCookie();
      delete window.applyGoogleTranslation;
      return;
    }

    const applyTranslation = () => {
      const selected = selectedLanguage();
      const language = selected && GOOGLE_LANGUAGE_CODES.has(selected) ? selected : "en";
      const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");

      if (language === "en") {
        clearTranslationCookie();
      } else {
        document.cookie = `googtrans=/en/${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
      }

      if (combo && combo.value !== language) {
        combo.value = language;
        combo.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    window.applyGoogleTranslation = applyTranslation;

    if (pathname === "/") {
      const saved = window.localStorage.getItem("home_selected_language");
      if (saved === "fr" || saved === "de" || saved === "ar") {
        document.cookie = `googtrans=/en/${saved}; Path=/; Max-Age=31536000; SameSite=Lax`;
      }
    } else {
      applyTranslation();
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
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      hideGoogleUi();
      applyTranslation();
      if (
        document.querySelector(".goog-te-combo") ||
        attempts >= 12
      ) {
        window.clearInterval(interval);
      }
    }, 1000);
    return () => {
      window.clearInterval(interval);
      delete window.applyGoogleTranslation;
    };
  }, [pathname, routeEnabled]);

  if (!routeEnabled || !automaticLanguage) return null;

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
              var element = document.getElementById('google_translate_element');
              if (!element || element.querySelector('.goog-te-combo')) {
                window.applyGoogleTranslation?.();
                return;
              }
              new window.google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: '${AUTO_LANGUAGES}',
                autoDisplay: false
              }, 'google_translate_element');
              window.applyGoogleTranslation?.();
            };
          `,
        }}
      />
      <Script
        id="google-translate-library"
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
        onReady={initializeGoogleTranslation}
      />
    </>
  );
}

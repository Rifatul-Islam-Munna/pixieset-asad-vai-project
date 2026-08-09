"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Globe2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrandSettings } from "@/lib/home-cms";

type NavCopy = {
  brand: string;
  products: string;
  examples: string;
  pricing: string;
  login: string;
  cta: string;
};

const productLinks = [
  {
    title: "Client Gallery",
    text: "Share, deliver, proof and sell",
    href: "/dashboard/client-gallery",
  },
  {
    title: "Store Gallery",
    text: "Prints, downloads and products",
    href: "/dashboard/store-gallery",
  },
  {
    title: "Mobile Gallery App",
    text: "Installable photo apps for clients",
    href: "/dashboard/mobile-gallery",
  },
];

export function SiteNav({
  brand,
  nav,
  lang,
  dashboardHref,
}: {
  brand?: Partial<BrandSettings>;
  nav: NavCopy;
  lang: "en" | "gr";
  dashboardHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<"en" | "gr" | "fr" | "de" | "ar">(lang);
  const brandText = brand?.brandText?.trim() || "";
  const logoUrl = brand?.logoUrl?.trim() || brand?.brandImageUrl?.trim() || "";
  const brandLabel = logoUrl ? "Home" : brandText;
  const productHref = (href: string) =>
    dashboardHref ? href : `/login?next=${encodeURIComponent(href)}`;

  useEffect(() => {
    const saved = window.localStorage.getItem("home_selected_language");
    if (saved === "en" || saved === "gr" || saved === "fr" || saved === "de" || saved === "ar") {
      setActiveLanguage(saved);
      return;
    }

    const detected = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("home_geo_language="))
      ?.split("=")[1];
    const initial =
      detected === "gr" || detected === "fr" || detected === "de" || detected === "ar"
        ? detected
        : "en";

    setActiveLanguage(initial);
    window.localStorage.setItem("home_selected_language", initial);
    if (initial !== "en") {
      window.location.assign(initial === "gr" ? "/?lang=gr" : "/?lang=en");
    }
  }, [lang]);

  const clearGoogleTranslation = () => {
    document.cookie = "googtrans=; Path=/; Max-Age=0; SameSite=Lax";
    document.cookie = `googtrans=; Domain=.${window.location.hostname}; Path=/; Max-Age=0; SameSite=Lax`;
  };

  const switchLanguage = (value: "en" | "gr") => {
    clearGoogleTranslation();
    window.localStorage.setItem("home_selected_language", value);
    setActiveLanguage(value);
    document.cookie = `home_language=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.assign(`/?lang=${value}`);
  };

  const switchAutomaticLanguage = (value: "fr" | "de" | "ar") => {
    window.localStorage.setItem("home_selected_language", value);
    setActiveLanguage(value);
    document.cookie = "home_language=en; Path=/; Max-Age=31536000; SameSite=Lax";
    document.cookie = `googtrans=/en/${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.assign("/?lang=en");
  };

  const languages = [
    { code: "en", label: "English", official: true },
    { code: "gr", label: "Greek", official: true },
    { code: "fr", label: "French", official: false },
    { code: "de", label: "Deutsch", official: false },
    { code: "ar", label: "العربية", official: false },
  ] as const;

  return (
    <header className="relative z-30 mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:h-20 sm:px-5 md:px-7 lg:px-8">
      <Link
        href="/"
        className="inline-flex min-w-0 items-center text-[#101010]"
        aria-label={brandLabel || "Home"}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-auto max-w-[180px] object-contain sm:h-11 sm:max-w-[220px]" />
        ) : brandText ? (
          <span className="max-w-[210px] truncate font-heading text-lg font-semibold tracking-[0.12em] sm:max-w-[320px] sm:text-2xl sm:tracking-[0.18em]">
            {brandText}
          </span>
        ) : null}
      </Link>

      <nav className="hidden items-center gap-9 text-[13px] font-semibold text-[#151515] md:flex">
        <Link href="/pricing">{nav.pricing}</Link>
        <Link href="/blog">Blog</Link>
        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={() => setProductsOpen((value) => !value)}
          >
            {nav.products}
            <ChevronDown className="size-3.5" />
          </button>
          {productsOpen && (
            <div className="absolute right-0 top-9 w-[310px] rounded-[8px] border border-[#EEEAE5] bg-white p-3 text-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.14)]">
              {productLinks.map((item) => (
                <Link
                  key={item.title}
                  href={productHref(item.href)}
                  className="block rounded-[6px] px-4 py-3 hover:bg-[#F8F7F4]"
                  onClick={() => setProductsOpen(false)}
                >
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#77716A]">
                    {item.text}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="hidden items-center gap-5 md:flex">
        <div className="relative notranslate">
          <button
            type="button"
            onClick={() => setLanguageOpen((value) => !value)}
            className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-[#e7e3ee] bg-white px-3 text-[12px] font-bold text-[#151515]"
            aria-label="Choose language"
          >
            <Globe2 className="size-4 text-[#6337d8]" />
            {activeLanguage.toUpperCase()}
            <ChevronDown className="size-3.5" />
          </button>
          {languageOpen && (
            <div className="absolute right-0 top-12 w-52 rounded-[8px] border border-[#EEEAE5] bg-white p-2 shadow-[0_18px_45px_rgba(0,0,0,0.14)]">
              {languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setLanguageOpen(false);
                    item.official
                      ? switchLanguage(item.code)
                      : switchAutomaticLanguage(item.code);
                  }}
                  className="flex w-full items-center justify-between rounded-[6px] px-3 py-2.5 text-left text-sm hover:bg-[#F8F7F4]"
                >
                  <span>{item.label}</span>
                  {item.code === activeLanguage && <Check className="size-4 text-[#6337d8]" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {!dashboardHref && (
          <Link
            href="/login"
            className="text-[13px] font-semibold text-[#151515]"
          >
            {nav.login}
          </Link>
        )}
        <Button
          asChild
          className="h-11 rounded-[7px] bg-gradient-to-r from-[#4f24bd] to-[#7936d2] px-6 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(95,53,200,.22)] hover:opacity-95"
        >
          <Link href={dashboardHref ?? "/login"}>
            {dashboardHref ? "Dashboard" : nav.cta}
          </Link>
        </Button>
      </div>

      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-[6px] bg-[#111] text-white md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#F8F7F4] px-5 py-5 text-[#111] md:hidden">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex min-w-0 items-center"
              onClick={() => setOpen(false)}
              aria-label={brandLabel || "Home"}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-10 w-auto max-w-[190px] object-contain" />
              ) : brandText ? (
                <span className="max-w-[220px] truncate font-heading text-2xl tracking-[0.18em]">{brandText}</span>
              ) : null}
            </Link>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-[6px] bg-[#111] text-white"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="mt-12 grid gap-6 text-3xl font-semibold">
            <Link href="/pricing" onClick={() => setOpen(false)}>
              {nav.pricing}
            </Link>
            <Link href="/blog" onClick={() => setOpen(false)}>Blog</Link>
            <span>{nav.products}</span>
            <div className="grid gap-4 text-base font-semibold">
              {productLinks.map((item) => (
                <Link
                  key={item.title}
                  href={productHref(item.href)}
                  onClick={() => setOpen(false)}
                >
                  <span className="block">{item.title}</span>
                  <span className="block text-sm font-normal leading-5 text-[#777]">
                    {item.text}
                  </span>
                </Link>
              ))}
            </div>
            {!dashboardHref && (
              <Link href="/login" onClick={() => setOpen(false)}>
                {nav.login}
              </Link>
            )}
          </nav>
          <div className="notranslate mt-10 border-t border-[#ded9ea] pt-6">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Globe2 className="size-4 text-[#6337d8]" /> Language
            </p>
            <div className="grid grid-cols-2 gap-2">
              {languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() =>
                    item.official
                      ? switchLanguage(item.code)
                      : switchAutomaticLanguage(item.code)
                  }
                  className="flex items-center justify-between rounded-[7px] border border-[#ddd7e8] bg-white px-3 py-3 text-sm font-semibold"
                >
                  {item.label}
                  {item.code === activeLanguage && <Check className="size-4 text-[#6337d8]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
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
  { title: "Client Gallery", text: "Share, deliver, proof and sell", href: "/dashboard/client-gallery" },
  { title: "Store Gallery", text: "Prints, downloads and products", href: "/dashboard/store-gallery" },
  { title: "Mobile Gallery App", text: "Installable photo apps for clients", href: "/dashboard/mobile-gallery" },
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
  const brandText = brand?.brandText?.trim() || nav.brand;
  const logoUrl = brand?.logoUrl?.trim() || brand?.brandImageUrl?.trim();
  const productHref = (href: string) => dashboardHref ? href : `/login?next=${encodeURIComponent(href)}`;

  const switchLanguage = (value: "en" | "gr") => {
    document.cookie = `home_language=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.assign(`/?lang=${value}`);
  };

  return (
    <header className="relative z-30 mx-auto flex h-20 max-w-[1240px] items-center justify-between px-5 md:px-7 lg:px-8">
      <Link href="/" className="inline-flex min-w-0 items-center gap-3 text-[#101010]" aria-label={brandText}>
        {logoUrl && <img src={logoUrl} alt="" className="h-8 max-w-28 object-contain" />}
        {brandText && <span className="font-heading text-2xl font-semibold tracking-[0.18em]">{brandText}</span>}
        <span className="font-heading text-2xl font-semibold text-[#7A5CE8]">G</span>
      </Link>

      <nav className="hidden items-center gap-9 text-[13px] font-semibold text-[#151515] md:flex">
        <Link href="/pricing">{nav.pricing}</Link>
        <div className="relative">
          <button type="button" className="inline-flex items-center gap-1" onClick={() => setProductsOpen((value) => !value)}>
            {nav.products}
            <ChevronDown className="size-3.5" />
          </button>
          {productsOpen && (
            <div className="absolute right-0 top-9 w-[310px] rounded-[8px] border border-[#EEEAE5] bg-white p-3 text-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.14)]">
              {productLinks.map((item) => (
                <Link key={item.title} href={productHref(item.href)} className="block rounded-[6px] px-4 py-3 hover:bg-[#F8F7F4]" onClick={() => setProductsOpen(false)}>
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#77716A]">{item.text}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="hidden items-center gap-5 md:flex">
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#7D7670]">
          <button type="button" onClick={() => switchLanguage("en")} className={lang === "en" ? "text-[#151515]" : ""}>EN</button>
          <span>/</span>
          <button type="button" onClick={() => switchLanguage("gr")} className={lang === "gr" ? "text-[#151515]" : ""}>GR</button>
        </div>
        {!dashboardHref && <Link href="/login" className="text-[13px] font-semibold text-[#151515]">{nav.login}</Link>}
        <Button asChild className="h-11 rounded-[6px] bg-[#050505] px-6 text-[13px] font-bold text-white hover:bg-[#252525]">
          <Link href={dashboardHref ?? "/register"}>{dashboardHref ? "Dashboard" : nav.cta}</Link>
        </Button>
      </div>

      <button type="button" className="inline-flex size-11 items-center justify-center rounded-[6px] bg-[#111] text-white md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#F8F7F4] px-5 py-5 text-[#111] md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-heading text-2xl tracking-[0.18em]" onClick={() => setOpen(false)}>{brandText}</Link>
            <button type="button" className="inline-flex size-11 items-center justify-center rounded-[6px] bg-[#111] text-white" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
          <nav className="mt-12 grid gap-6 text-3xl font-semibold">
            <Link href="/pricing" onClick={() => setOpen(false)}>{nav.pricing}</Link>
            <span>{nav.products}</span>
            <div className="grid gap-4 text-base font-semibold">
            {productLinks.map((item) => (
              <Link key={item.title} href={productHref(item.href)} onClick={() => setOpen(false)}>
                <span className="block">{item.title}</span>
                <span className="block text-sm font-normal leading-5 text-[#777]">{item.text}</span>
              </Link>
            ))}
            </div>
            {!dashboardHref && <Link href="/login" onClick={() => setOpen(false)}>{nav.login}</Link>}
          </nav>
          <div className="mt-10 flex items-center gap-4 text-sm font-bold">
            <button type="button" onClick={() => switchLanguage("en")} className={lang === "en" ? "text-[#7A5CE8]" : "text-[#777]"}>EN</button>
            <button type="button" onClick={() => switchLanguage("gr")} className={lang === "gr" ? "text-[#7A5CE8]" : "text-[#777]"}>GR</button>
          </div>
        </div>
      )}
    </header>
  );
}

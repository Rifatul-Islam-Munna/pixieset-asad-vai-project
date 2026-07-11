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
  { title: "Client Gallery", text: "Share, deliver, proof and sell", href: "/dashboard/client-gallery", mark: "bg-[#0dc6b5]" },
  { title: "Store Gallery", text: "Your online store for prints and downloads", href: "/dashboard/store-gallery", mark: "bg-[#ff6b7a]" },
  { title: "Mobile Gallery App", text: "Create installable mobile-first photo apps", href: "/dashboard/mobile-gallery", mark: "bg-[#f5c84b]" },
];

export function SiteNav({ brand, nav, lang, dashboardHref }: { brand?: Partial<BrandSettings>; nav: NavCopy; lang: "en" | "gr"; dashboardHref?: string }) {
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const brandText = brand?.brandText?.trim() || nav.brand;
  const logoUrl = brand?.logoUrl?.trim() || brand?.brandImageUrl?.trim();
  const rememberLanguage = (value: "en" | "gr") => {
    document.cookie = `home_language=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };
  const switchLanguage = (value: "en" | "gr") => {
    rememberLanguage(value);
    window.location.assign(`/?lang=${value}`);
  };
  const productHref = (href: string) => dashboardHref ? href : `/login?next=${encodeURIComponent(href)}`;

  return (
    <header className="relative z-20 flex h-16 items-center justify-between px-5 md:px-7 lg:px-8">
      <Link href="/" className="inline-flex min-w-0 items-center gap-3 text-white" aria-label={brandText}>
        {logoUrl && <img src={logoUrl} alt="" className="h-9 max-w-28 object-contain" />}
        {brandText && <span className="font-serif text-xl tracking-[0.3em] sm:text-2xl sm:tracking-[0.36em]">{brandText}</span>}
      </Link>

      <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
        <div className="relative">
        <button type="button" className="inline-flex items-center gap-1" onClick={() => setProductsOpen((value) => !value)}>
          {nav.products} <ChevronDown data-icon="inline-end" />
        </button>
        {productsOpen && (
          <div className="absolute left-0 top-9 w-[340px] border bg-white py-6 text-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
            {productLinks.map((item) => (
              <Link key={item.title} href={productHref(item.href)} className="grid grid-cols-[44px_1fr] gap-4 px-7 py-4 hover:bg-[#f7f7f7]" onClick={() => setProductsOpen(false)}>
                <span className={`mt-1 size-10 rounded-full ${item.mark}`} />
                <span>
                  <span className="block font-bold">{item.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-[#777]">{item.text}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
        </div>
        <Link href="/pricing">{nav.pricing}</Link>
      </nav>

      <div className="hidden items-center gap-3 md:flex">
        <button type="button" onClick={() => switchLanguage("en")} className={lang === "en" ? "text-sm font-bold" : "text-sm text-white/75"}>EN</button>
        <button type="button" onClick={() => switchLanguage("gr")} className={lang === "gr" ? "text-sm font-bold" : "text-sm text-white/75"}>GR</button>
        {!dashboardHref && <Link href="/login" className="text-sm font-semibold">{nav.login}</Link>}
        <Button asChild className="h-11 min-w-36 rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]">
          <Link href={dashboardHref ?? "/register"}>{dashboardHref ? "Dashboard" : nav.cta}</Link>
        </Button>
      </div>

      <button type="button" className="inline-flex size-11 items-center justify-center bg-white/10 text-white md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#171918] px-5 py-5 text-white md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
              {logoUrl && <img src={logoUrl} alt="" className="h-9 max-w-28 object-contain" />}
              {brandText && <span className="font-serif text-xl tracking-[0.3em]">{brandText}</span>}
            </Link>
            <button type="button" className="inline-flex size-11 items-center justify-center bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
              <X />
            </button>
          </div>
          <nav className="mt-12 grid gap-6 text-3xl font-semibold">
            <span>{nav.products}</span>
            <div className="grid gap-4 text-base font-semibold">
              {productLinks.map((item) => (
                <Link key={item.title} href={productHref(item.href)} onClick={() => setOpen(false)} className="grid grid-cols-[36px_1fr] gap-3">
                  <span className={`mt-1 size-8 rounded-full ${item.mark}`} />
                  <span><span className="block">{item.title}</span><span className="block text-sm font-normal leading-5 text-white/65">{item.text}</span></span>
                </Link>
              ))}
            </div>
            <Link href="/pricing" onClick={() => setOpen(false)}>{nav.pricing}</Link>
            {!dashboardHref && <Link href="/login" onClick={() => setOpen(false)}>{nav.login}</Link>}
          </nav>
          <div className="mt-10 flex items-center gap-4 text-sm font-bold">
            <button type="button" onClick={() => { setOpen(false); switchLanguage("en"); }} className={lang === "en" ? "text-[#22bda7]" : "text-white/70"}>EN</button>
            <button type="button" onClick={() => { setOpen(false); switchLanguage("gr"); }} className={lang === "gr" ? "text-[#22bda7]" : "text-white/70"}>GR</button>
          </div>
          <Button asChild className="mt-10 h-12 w-full rounded-none bg-[#22bda7] text-base font-bold text-white hover:bg-[#19a995]">
            <Link href={dashboardHref ?? "/register"} onClick={() => setOpen(false)}>{dashboardHref ? "Dashboard" : nav.cta}</Link>
          </Button>
        </div>
      )}
    </header>
  );
}

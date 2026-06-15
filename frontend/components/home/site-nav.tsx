"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavCopy = {
  brand: string;
  products: string;
  examples: string;
  pricing: string;
  login: string;
  cta: string;
};

export function SiteNav({ nav, lang }: { nav: NavCopy; lang: "en" | "gr" }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-20 flex h-16 items-center justify-between px-5 md:px-7 lg:px-8">
      <Link href="/" className="font-serif text-xl tracking-[0.3em] text-white sm:text-2xl sm:tracking-[0.36em]" aria-label={nav.brand}>
        {nav.brand}
      </Link>

      <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
        <Link href="#" className="inline-flex items-center gap-1">
          {nav.products} <ChevronDown data-icon="inline-end" />
        </Link>
        <Link href="#">{nav.examples}</Link>
        <Link href="/pricing">{nav.pricing}</Link>
      </nav>

      <div className="hidden items-center gap-3 md:flex">
        <Link href="/?lang=en" className={lang === "en" ? "text-sm font-bold" : "text-sm text-white/75"}>EN</Link>
        <Link href="/?lang=gr" className={lang === "gr" ? "text-sm font-bold" : "text-sm text-white/75"}>GR</Link>
        <Link href="/login" className="text-sm font-semibold">{nav.login}</Link>
        <Button asChild className="h-11 min-w-36 rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]">
          <Link href="/register">{nav.cta}</Link>
        </Button>
      </div>

      <button type="button" className="inline-flex size-11 items-center justify-center bg-white/10 text-white md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#171918] px-5 py-5 text-white md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-serif text-xl tracking-[0.3em]" onClick={() => setOpen(false)}>
              {nav.brand}
            </Link>
            <button type="button" className="inline-flex size-11 items-center justify-center bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
              <X />
            </button>
          </div>
          <nav className="mt-12 grid gap-6 text-3xl font-semibold">
            <Link href="#" onClick={() => setOpen(false)}>{nav.products}</Link>
            <Link href="#" onClick={() => setOpen(false)}>{nav.examples}</Link>
            <Link href="/pricing" onClick={() => setOpen(false)}>{nav.pricing}</Link>
            <Link href="/login" onClick={() => setOpen(false)}>{nav.login}</Link>
          </nav>
          <div className="mt-10 flex items-center gap-4 text-sm font-bold">
            <Link href="/?lang=en" onClick={() => setOpen(false)} className={lang === "en" ? "text-[#22bda7]" : "text-white/70"}>EN</Link>
            <Link href="/?lang=gr" onClick={() => setOpen(false)} className={lang === "gr" ? "text-[#22bda7]" : "text-white/70"}>GR</Link>
          </div>
          <Button asChild className="mt-10 h-12 w-full rounded-none bg-[#22bda7] text-base font-bold text-white hover:bg-[#19a995]">
            <Link href="/register" onClick={() => setOpen(false)}>{nav.cta}</Link>
          </Button>
        </div>
      )}
    </header>
  );
}

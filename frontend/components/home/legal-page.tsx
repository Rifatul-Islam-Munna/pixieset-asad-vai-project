import Link from "next/link";
import { cookies } from "next/headers";
import { getHomeCms } from "@/lib/home-cms-server";
import type { HomeLanguage } from "@/lib/home-cms";

export async function LegalPage({ type, searchParams }: { type: "terms" | "privacy"; searchParams?: Promise<{ lang?: string }> }) {
  const [cms, params, cookieStore] = await Promise.all([getHomeCms(), searchParams, cookies()]);
  const saved = cookieStore.get("home_language")?.value;
  const lang: HomeLanguage = params?.lang === "gr" || (!params?.lang && saved === "gr") ? "gr" : "en";
  const page = cms.legal[lang][type];
  return <main className="min-h-screen bg-[#f5f5f2] px-5 py-14 text-[#181818] md:py-24"><article className="mx-auto max-w-4xl bg-white px-7 py-10 shadow-[0_18px_55px_rgba(0,0,0,.06)] md:px-16 md:py-16"><div className="flex items-center justify-between gap-5"><Link href={`/?lang=${lang}`} className="text-sm font-bold text-[#00a997]">← {lang === "gr" ? "Αρχική" : "Home"}</Link><div className="flex gap-3 text-sm"><Link href="?lang=en">EN</Link><Link href="?lang=gr">GR</Link></div></div><h1 className="mt-12 text-4xl font-medium md:text-5xl">{page.title}</h1><div className="mt-10 whitespace-pre-line text-base leading-8 text-[#555] md:text-lg">{page.content}</div></article></main>;
}

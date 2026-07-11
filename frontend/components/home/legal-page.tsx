import Link from "next/link";
import { cookies } from "next/headers";
import { getHomeCms } from "@/lib/home-cms-server";
import type { HomeLanguage } from "@/lib/home-cms";

function sanitizeLegalHtml(value: string) {
  return value
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(["'])\s*(javascript:|data:)[\s\S]*?\2/gi, "");
}

export async function LegalPage({ type, searchParams }: { type: "terms" | "privacy"; searchParams?: Promise<{ lang?: string }> }) {
  const [cms, params, cookieStore] = await Promise.all([getHomeCms(), searchParams, cookies()]);
  const saved = cookieStore.get("home_language")?.value;
  const lang: HomeLanguage = params?.lang === "gr" || (!params?.lang && saved === "gr") ? "gr" : "en";
  const page = cms.legal[lang][type];
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(page.content);
  return <main className="min-h-screen bg-[#f5f5f2] px-5 py-14 text-[#181818] md:py-24"><article className="mx-auto max-w-4xl bg-white px-7 py-10 shadow-[0_18px_55px_rgba(0,0,0,.06)] md:px-16 md:py-16"><div className="flex items-center justify-between gap-5"><Link href={`/?lang=${lang}`} className="text-sm font-bold text-[#00a997]">← {lang === "gr" ? "Αρχική" : "Home"}</Link><div className="flex gap-3 text-sm"><Link href="?lang=en">EN</Link><Link href="?lang=gr">GR</Link></div></div><h1 className="mt-12 text-4xl font-medium md:text-5xl">{page.title}</h1>{isHtml ? <div className="mt-10 text-base leading-8 text-[#555] md:text-lg [&_a]:text-[#008f7f] [&_a]:underline [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_li]:ml-6 [&_ol]:list-decimal [&_p]:my-5 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: sanitizeLegalHtml(page.content) }} /> : <div className="mt-10 whitespace-pre-line text-base leading-8 text-[#555] md:text-lg">{page.content}</div>}</article></main>;
}

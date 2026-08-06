import {
  ArrowRight,
  Check,
  CloudUpload,
  Globe2,
  Image as ImageIcon,
  LockKeyhole,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { HomeHero } from "@/components/home/home-hero";
import { getUser } from "@/actions/auth";
import { UserType } from "@/@types/user";
import { type FooterLink, type HomeLanguage } from "@/lib/home-cms";
import { getHomeCms } from "@/lib/home-cms-server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const icons = [CloudUpload, LockKeyhole, Sparkles, ShoppingBag, Smartphone];

function footerHref(label: string, configured?: string) {
  if (configured && configured !== "#") return configured;
  const routes: Record<string, string> = {
    "Client Gallery": "/login?next=/dashboard/client-gallery",
    "Store Gallery": "/login?next=/dashboard/store-gallery",
    "Mobile Gallery App": "/login?next=/dashboard/mobile-gallery",
    Pricing: "/pricing",
    "Terms of Service": "/terms-of-service",
    "Privacy Policy": "/privacy-policy",
  };
  return routes[label] || "/";
}

async function getDashboardHref() {
  const user = await getUser();
  if (!user) return undefined;
  return user.role === UserType.ADMIN ? "/admin" : "/dashboard/overview";
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const [cms, dashboardHref] = await Promise.all([
    getHomeCms(),
    getDashboardHref(),
  ]);
  const params = await searchParams;
  const savedLanguage = (await cookies()).get("home_language")?.value;
  const lang: HomeLanguage =
    params?.lang === "gr" || (!params?.lang && savedLanguage === "gr")
      ? "gr"
      : "en";
  const t = cms.content[lang] ?? cms.content.en;
  const images = [
    ...t.workflow.tabs.map((x) => x.image),
    ...t.gallery.tabs.map((x) => x.image),
    ...t.cta.images,
  ].filter(Boolean);
  const showcaseTabs = t.gallery.tabs.slice(0, 5);
  const features = t.featureCards.slice(0, 5);

  return (
    <main className="min-h-screen bg-white text-[#111]">
      <HomeHero
        initialCms={cms}
        requestedLanguage={lang}
        dashboardHref={dashboardHref}
      />

      <section className="border-y border-[#eeeaf8] bg-white px-4 py-8 sm:px-5 sm:py-10 md:px-8 md:py-12">
        <div className="mx-auto grid max-w-[1320px] gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-5">
          {features.map((feature, i) => {
            const Icon = icons[i] ?? Sparkles;
            return (
              <article
                key={`${feature.title}-${i}`}
                className="flex gap-4 rounded-xl border border-[#ece9f3] bg-white p-4 sm:rounded-none sm:border-0 sm:p-0 lg:border-r lg:pr-5 last:border-0"
              >
                <Icon className="mt-1 size-8 shrink-0 text-[#6844df]" />
                <div>
                  <h3 className="text-sm font-bold">{feature.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#666]">
                    {feature.text}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="features"
        className="relative overflow-hidden bg-[#fbfaff] px-4 py-16 sm:px-5 sm:py-20 md:px-8 md:py-28"
      >
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle,rgba(104,68,223,.12),transparent_65%)]" />
        <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 sm:gap-12 lg:grid-cols-[.82fr_1.18fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6541d7]">
              {t.showcase.eyebrow}
            </p>
            <h2 className="mt-5 max-w-[540px] whitespace-pre-line text-3xl font-bold leading-[1.08] tracking-[-.035em] sm:mt-6 sm:text-4xl md:text-[42px]">
              {t.showcase.title}
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#666]">
              {t.showcase.subtitle}
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-[#555]">
              {t.showcase.bullets.map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <Check className="size-4 text-[#6643d9]" />
                  {x}
                </li>
              ))}
            </ul>
            <a
              href="/pricing"
              className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#6040d3]"
            >
              {t.showcase.button} <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[.8fr_1.2fr_.8fr]">
            <div className="hidden gap-7 sm:grid">
              {showcaseTabs.slice(1, 3).map((item, i) => (
                <a
                  key={`${item.value}-${i}`}
                  href={item.href || "/register"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group overflow-hidden rounded-xl bg-white shadow-[0_15px_30px_rgba(35,20,80,.14)]"
                >
                  <img
                    src={item.image}
                    alt={item.title || item.label}
                    className="aspect-[1.35] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <p className="truncate p-3 text-xs font-medium text-[#4f4960]">
                    {item.title || item.label}
                  </p>
                </a>
              ))}
            </div>
            <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-[0_20px_45px_rgba(35,20,80,.18)] sm:max-w-none">
              <a
                href={showcaseTabs[0]?.href || "/register"}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <img
                  src={showcaseTabs[0]?.image}
                  alt={
                    showcaseTabs[0]?.title ||
                    showcaseTabs[0]?.label ||
                    "Gallery"
                  }
                  className="aspect-[.95] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
                <div className="p-5 text-center">
                  <h3 className="text-xl font-medium">
                    {showcaseTabs[0]?.title || t.showcase.cardTitle}
                  </h3>
                  <p className="mt-1 text-[10px] text-[#777]">
                    {t.showcase.cardDate}
                  </p>
                  <span className="mt-4 inline-flex rounded-md bg-[#603bd8] px-5 py-3 text-xs font-semibold text-white">
                    {t.showcase.cardButton}
                  </span>
                </div>
              </a>
            </div>
            <div className="hidden gap-7 sm:grid">
              {showcaseTabs.slice(3, 5).map((item, i) => (
                <a
                  key={`${item.value}-${i}`}
                  href={item.href || "/register"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group overflow-hidden rounded-xl bg-white shadow-[0_15px_30px_rgba(35,20,80,.14)]"
                >
                  <img
                    src={item.image}
                    alt={item.title || item.label}
                    className="aspect-[1.35] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <p className="truncate p-3 text-xs font-medium text-[#4f4960]">
                    {item.title || item.label}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mx-auto mt-14 grid max-w-[1320px] overflow-hidden rounded-2xl border border-[#e6e1f3] bg-white py-4 sm:mt-20 sm:grid-cols-2 sm:py-8 lg:grid-cols-4">
          {t.stats.map((stat, i) => {
            const statIcons = [Users, ImageIcon, CloudUpload, Globe2];
            const I = statIcons[i] ?? Users;
            return (
              <div
                key={`${stat.label}-${i}`}
                className="flex items-center justify-start gap-5 border-b border-[#ece8f5] px-6 py-5 sm:justify-center sm:border-b-0 sm:py-3 lg:border-r last:border-0"
              >
                <I className="size-9 text-[#6944dc]" />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#f5f0ff] px-4 py-14 sm:px-5 sm:py-16 md:px-8 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(117,78,233,.28),transparent_48%)]" />
        <div className="relative mx-auto grid max-w-[930px] items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="whitespace-pre-line text-3xl font-bold tracking-[-.04em] sm:text-4xl">
              {t.cta.title}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#666]">
              {t.cta.subtitle}
            </p>
          </div>
          <div>
            <a
              href={dashboardHref ?? "/login"}
              className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#603bd8] px-6 text-sm font-semibold text-white sm:w-auto"
            >
              {dashboardHref ? "Dashboard" : t.cta.button}
              <ArrowRight className="size-4" />
            </a>
            <p className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#666]">
              ✓ {t.cta.trialText} &nbsp;&nbsp;&nbsp; ✓ {t.cta.noCardText}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-9 text-center sm:px-5 sm:py-10 md:px-8">
        <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#666]">
          {t.trustHeading}
        </p>
        <div className="mx-auto mt-7 grid max-w-[1050px] grid-cols-2 items-center justify-items-center gap-7 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-12 sm:gap-y-6">
          {t.brandLogos.map((logo, i) =>
            logo.image ? (
              <img
                key={i}
                src={logo.image}
                alt={logo.name}
                className="max-h-8 max-w-28 object-contain grayscale"
              />
            ) : (
              <span key={i} className="text-xl font-bold text-[#888]">
                {logo.name}
              </span>
            ),
          )}
        </div>
      </section>

      <footer
        id="resources"
        className="bg-[#171918] px-4 py-10 text-white sm:px-5 sm:py-12 md:px-8 md:py-16"
      >
        <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[1.15fr_1.85fr]">
          <div>
            {t.footer.logoUrl ? (
              <img src={t.footer.logoUrl} alt="" className="h-12 w-auto max-w-[240px] object-contain" />
            ) : t.footer.brandText ? (
              <p className="text-2xl tracking-[.18em]">{t.footer.brandText}</p>
            ) : null}
            <p className="mt-6 max-w-[520px] text-sm leading-6 text-white/70">
              {t.footer.description}
            </p>
            <p className="mt-10 text-xs text-white/55">{t.footer.copyright}</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.footer.columns.slice(0, 4).map((column, i) => (
              <div key={i}>
                <h3 className="text-sm font-bold">{column.title}</h3>
                <ul className="mt-5 grid gap-3 text-sm text-white/70">
                  {column.links.map((link: FooterLink, j) => {
                    const item =
                      typeof link === "string"
                        ? { label: link, url: "#" }
                        : link;
                    return (
                      <li key={j}>
                        <a
                          href={footerHref(item.label, item.url)}
                          className="hover:text-white"
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

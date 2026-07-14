import {
  ArrowRight,
  CalendarDays,
  Camera,
  Image as ImageIcon,
  Landmark,
  Plane,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Utensils,
  Volleyball,
  Zap,
} from "lucide-react";
import { HomeHero } from "@/components/home/home-hero";
import { getUser } from "@/actions/auth";
import { UserType } from "@/@types/user";
import { type FeatureCard, type FooterLink, type GalleryTab, type HomeLanguage } from "@/lib/home-cms";
import { getHomeCms } from "@/lib/home-cms-server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function lines(text: string) {
  return text.split("\n").map((line, index, all) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < all.length - 1 && <br />}
    </span>
  ));
}

function footerHref(label: string, configured?: string) {
  if (configured && configured !== "#") return configured;
  const routes: Record<string, string> = {
    "Client Gallery": "/login?next=/dashboard/client-gallery",
    "Store Gallery": "/login?next=/dashboard/store-gallery",
    Store: "/login?next=/dashboard/store-gallery",
    "Mobile Gallery App": "/login?next=/dashboard/mobile-gallery",
    Pricing: "/pricing",
    "Help & Support": "mailto:support@gallerista.app",
    "Terms of Service": "/terms-of-service",
    "Terms Of Service": "/terms-of-service",
    "Privacy Policy": "/privacy-policy",
  };
  return routes[label] || "/";
}

const allowedFooterLabels = new Set([
  "Client Gallery",
  "Store Gallery",
  "Mobile Gallery App",
  "Pricing",
  "Terms of Service",
  "Terms Of Service",
  "Privacy Policy",
]);

const fallbackFooterColumns = [
  {
    title: "Products",
    links: [
      { label: "Client Gallery", url: "/login?next=/dashboard/client-gallery" },
      { label: "Store Gallery", url: "/login?next=/dashboard/store-gallery" },
      { label: "Mobile Gallery App", url: "/login?next=/dashboard/mobile-gallery" },
    ],
  },
  {
    title: "Pages",
    links: [
      { label: "Pricing", url: "/pricing" },
      { label: "Terms of Service", url: "/terms-of-service" },
      { label: "Privacy Policy", url: "/privacy-policy" },
    ],
  },
];

async function getDashboardHref() {
  const user = await getUser();
  if (!user) return undefined;
  return user.role === UserType.ADMIN ? "/admin" : "/dashboard/overview";
}

const iconMap = {
  CalendarDays,
  Camera,
  Image: ImageIcon,
  Landmark,
  Plane,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Utensils,
  Volleyball,
  Zap,
};

function IconByName({ name, className }: { name?: string; className?: string }) {
  const Icon = iconMap[(name || "Camera") as keyof typeof iconMap] ?? Camera;
  return <Icon className={className} />;
}

function categoryCards(tabs: GalleryTab[]) {
  return tabs;
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const [cms, dashboardHref] = await Promise.all([getHomeCms(), getDashboardHref()]);
  const params = await searchParams;
  const savedLanguage = (await cookies()).get("home_language")?.value;
  const lang: HomeLanguage =
    params?.lang === "gr" || (!params?.lang && savedLanguage === "gr")
      ? "gr"
      : params?.lang === "en" || savedLanguage === "en"
        ? "en"
        : cms.defaultLanguage;
  const t = cms.content[lang] ?? cms.content.en;
  const categories = categoryCards(t.workflow.tabs.length ? t.workflow.tabs : t.gallery.tabs);
  const deviceImages = [...t.workflow.tabs.map((tab) => tab.image), ...t.gallery.tabs.map((tab) => tab.image), ...t.cta.images].filter(Boolean);
  const footerColumns = t.footer.columns
    .map((column) => ({
      ...column,
      links: column.links.filter((link) => allowedFooterLabels.has(typeof link === "string" ? link : link.label)),
    }))
    .filter((column) => column.title.trim() && column.links.length);
  const visibleFooterColumns = footerColumns.length ? footerColumns : fallbackFooterColumns;

  return (
    <main className="gallerista-editorial min-h-screen bg-[#F8F7F4] text-[#151515] [&_a]:whitespace-pre-line [&_button]:whitespace-pre-line [&_h1]:whitespace-pre-line [&_h2]:whitespace-pre-line [&_h3]:whitespace-pre-line [&_p]:whitespace-pre-line [&_span]:whitespace-pre-line">
      <HomeHero initialCms={cms} requestedLanguage={lang} dashboardHref={dashboardHref} />

      <section id="examples" className="bg-white px-5 py-16 md:px-7 md:py-24">
        <div className="mx-auto max-w-[1240px] text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#7A5CE8]">Perfect for every photographer</p>
          <h2 className="mt-4 text-[36px] leading-none md:text-[44px]">{lines(t.workflow.title || t.gallery.title)}</h2>
          <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((tab) => (
              <a key={tab.value} href="#features" className="group relative h-[220px] overflow-hidden rounded-[7px] bg-[#111] text-left shadow-[0_18px_34px_rgba(21,21,21,0.10)]">
                <img src={tab.image} alt={tab.label} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
                  <IconByName name={tab.icon} className="size-4" />
                </span>
                <h3 className="absolute bottom-4 left-4 text-sm font-bold text-white">{tab.label}</h3>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-white px-5 pb-16 md:px-7 md:pb-24">
        <div className="mx-auto grid max-w-[1240px] gap-1 border-y border-[#EEEAE5] md:grid-cols-4">
          {t.featureCards.map((item: FeatureCard) => {
            return (
              <article key={item.title} className="bg-white px-6 py-9 text-left">
                <IconByName name={item.icon} className="size-6 text-[#7A5CE8]" />
                <h3 className="mt-8 font-heading text-[22px] leading-none text-[#111]">{item.title}</h3>
                <p className="mt-4 text-sm leading-6 text-[#5F5A54]">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="templates" className="bg-[#F1EFEB] px-5 py-16 md:px-7 md:py-24">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 md:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#7A5CE8]">{t.workflow.eyebrow}</p>
            <h2 className="mt-5 text-[38px] leading-[0.98] md:text-[48px]">
              More time creating.<br />
              <span className="italic text-[#7A5CE8]">Less time managing.</span>
            </h2>
            <p className="mt-6 max-w-[430px] text-[15px] leading-7 text-[#5F5A54]">{t.workflow.subtitle}</p>
            <a href="/pricing" className="mt-8 inline-flex items-center gap-3 text-sm font-bold text-[#151515]">
              Explore all features
              <ArrowRight className="size-4" />
            </a>
          </div>

          <div className="relative min-h-[360px]">
            <div className="absolute bottom-4 left-0 z-10 hidden w-[160px] rounded-[28px] border-[8px] border-[#101010] bg-[#101010] shadow-[0_20px_50px_rgba(0,0,0,0.22)] sm:block">
              <div className="overflow-hidden rounded-[18px] bg-white">
                <div className="grid grid-cols-2 gap-1 p-2">
                  {deviceImages.slice(0, 6).map((image, index) => (
                    <img key={`${image}-phone-${index}`} src={image} alt="" className="h-20 w-full object-cover" />
                  ))}
                </div>
              </div>
            </div>
            <div className="ml-auto overflow-hidden rounded-[18px] border-[10px] border-[#101010] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] md:w-[88%]">
              <div className="flex items-center justify-between border-b border-[#ECE7E1] px-5 py-3 text-xs font-bold text-[#77716A]">
                <span>{t.gallery.tabs[0]?.title || t.nav.brand}</span>
                <span>+ -</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <aside className="hidden border-r border-[#ECE7E1] p-5 text-[11px] font-semibold text-[#77716A] sm:grid sm:gap-4">
                  <span>Dashboard</span>
                  <span>Galleries</span>
                  <span>Store</span>
                  <span>Payments</span>
                  <span>Settings</span>
                </aside>
                <div className="grid grid-cols-3 gap-2 p-4 sm:p-6">
                  {deviceImages.slice(0, 9).map((image, index) => (
                    <img key={`${image}-desk-${index}`} src={image} alt="" className="aspect-[1.25] w-full object-cover" />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 right-3 h-16 w-40 rounded-full bg-[#7A5CE8]/35 blur-xl" />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 text-center md:px-7 md:py-20">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#7A5CE8]">{t.testimonials.eyebrow}</p>
        <h2 className="mx-auto mt-5 max-w-[720px] text-[34px] leading-[1.05] md:text-[44px]">{t.testimonials.title}</h2>
        <div className="mx-auto mt-10 max-w-[1080px] overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-[brand-marquee_24s_linear_infinite] items-center gap-16">
            {[...t.brandLogos, ...t.brandLogos].map((logo, index) => {
              const content = logo.image ? <img src={logo.image} alt={logo.name} className="max-h-10 max-w-32 object-contain grayscale" /> : <span className="text-xl font-black text-[#6C6761] opacity-80">{logo.name}</span>;
              return logo.url ? (
                <a key={`${logo.name}-${index}`} href={logo.url} className="inline-flex min-w-28 items-center justify-center">{content}</a>
              ) : (
                <span key={`${logo.name}-${index}`} className="inline-flex min-w-28 items-center justify-center">{content}</span>
              );
            })}
          </div>
        </div>
      </section>

      <footer id="resources" className="bg-[#171918] px-5 py-12 text-white md:px-7 md:py-16">
        <div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-heading text-2xl tracking-[0.18em]">{cms.brand.brandText || t.nav.brand}</p>
            <p className="mt-6 max-w-[520px] text-sm leading-6 text-white/70">{t.footer.description}</p>
            <p className="mt-10 text-xs text-white/55">{t.footer.copyright}</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {visibleFooterColumns.map((column, columnIndex) => (
              <div key={`${column.title}-${columnIndex}`}>
                <h3 className="text-sm font-bold text-white">{column.title}</h3>
                <ul className="mt-5 grid gap-3 text-sm text-white/70">
                  {column.links.map((link: FooterLink) => {
                    const item = typeof link === "string" ? { label: link, url: "#" } : link;
                    return (
                      <li key={`${item.label}-${item.url}`}>
                        <a href={footerHref(item.label, item.url)} className="hover:text-white">{item.label}</a>
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

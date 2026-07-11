import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HomeHero } from "@/components/home/home-hero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUser } from "@/actions/auth";
import { UserType } from "@/@types/user";
import { type HomeLanguage } from "@/lib/home-cms";
import { getHomeCms } from "@/lib/home-cms-server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function lines(text: string) {
  return text.split("\n").map((line, index) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < text.split("\n").length - 1 && <br />}
    </span>
  ));
}

function footerHref(label: string, configured?: string) {
  if (configured && configured !== "#") return configured;
  const routes: Record<string, string> = {
    "Client Gallery": "/login?next=/dashboard/client-gallery", "Store Gallery": "/login?next=/dashboard/store-gallery", Store: "/login?next=/dashboard/store-gallery",
    "Mobile Gallery App": "/login?next=/dashboard/mobile-gallery", Pricing: "/pricing",
    "Help & Support": "mailto:support@gallerista.app", "Terms of Service": "/terms-of-service", "Terms Of Service": "/terms-of-service", "Privacy Policy": "/privacy-policy",
  };
  return routes[label] || "/";
}

function relevantFooterColumns(lang: HomeLanguage) {
  return lang === "gr" ? [
    { title: "Προϊόντα", links: [{ label: "Client Gallery", url: "/login?next=/dashboard/client-gallery" }, { label: "Store Gallery", url: "/login?next=/dashboard/store-gallery" }, { label: "Mobile Gallery App", url: "/login?next=/dashboard/mobile-gallery" }, { label: "Τιμές", url: "/pricing" }] },
    { title: "Υποστήριξη", links: [{ label: "Βοήθεια & Υποστήριξη", url: "mailto:support@gallerista.app" }] },
    { title: "Νομικά", links: [{ label: "Όροι Παροχής Υπηρεσιών", url: "/terms-of-service?lang=gr" }, { label: "Πολιτική Απορρήτου", url: "/privacy-policy?lang=gr" }] },
  ] : [
    { title: "Products", links: [{ label: "Client Gallery", url: "/login?next=/dashboard/client-gallery" }, { label: "Store Gallery", url: "/login?next=/dashboard/store-gallery" }, { label: "Mobile Gallery App", url: "/login?next=/dashboard/mobile-gallery" }, { label: "Pricing", url: "/pricing" }] },
    { title: "Support", links: [{ label: "Help & Support", url: "mailto:support@gallerista.app" }] },
    { title: "Legal", links: [{ label: "Terms of Service", url: "/terms-of-service" }, { label: "Privacy Policy", url: "/privacy-policy" }] },
  ];
}

async function getDashboardHref() {
  const user = await getUser();
  if (!user) return undefined;
  return user.role === UserType.ADMIN ? "/admin" : "/dashboard/overview";
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const [cms, dashboardHref] = await Promise.all([getHomeCms(), getDashboardHref()]);
  const params = await searchParams;
  const savedLanguage = (await cookies()).get("home_language")?.value;
  const lang: HomeLanguage = params?.lang === "gr" || (!params?.lang && savedLanguage === "gr") ? "gr" : params?.lang === "en" || savedLanguage === "en" ? "en" : cms.defaultLanguage;
  const t = cms.content[lang] ?? cms.content.en;
  const defaultGallery = t.gallery.tabs[0]?.value ?? "share";
  const defaultWorkflow = t.workflow.tabs[0]?.value ?? "wedding";

  return (
    <main className="min-h-screen bg-background text-foreground [&_a]:whitespace-pre-line [&_button]:whitespace-pre-line [&_h1]:whitespace-pre-line [&_h2]:whitespace-pre-line [&_h3]:whitespace-pre-line [&_p]:whitespace-pre-line [&_span]:whitespace-pre-line">
      <HomeHero initialCms={cms} requestedLanguage={lang} dashboardHref={dashboardHref} />

      <section className="border-t bg-white px-5 py-14 text-center md:px-6 md:py-20">
        <div className="mx-auto max-w-[1240px]">
          <h2 className="text-3xl font-semibold leading-[1.2] tracking-normal text-[#202020] md:text-[40px]">{lines(t.gallery.title)}</h2>
          <p className="mx-auto mt-5 max-w-[730px] text-base leading-7 text-[#666] md:mt-7 md:text-lg">{t.gallery.subtitle}</p>
          <Tabs defaultValue={defaultGallery} className="mt-12 w-full items-center gap-0">
            <TabsList className="flex h-auto w-full flex-wrap justify-center gap-2 bg-transparent p-0">
              {t.gallery.tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="h-11 min-w-[144px] rounded-full bg-[#fafafa] px-6 text-sm font-normal text-[#344054] data-active:bg-[#22bda7] data-active:text-white">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {t.gallery.tabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="w-full">
                <div className="mx-auto mt-8 grid max-w-[980px] gap-4 bg-[#eef4f3] p-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.09)] md:mt-12 md:grid-cols-[1fr_1.2fr] md:gap-6 md:p-8">
                  <img src={tab.image} alt={tab.label} className="h-72 w-full object-cover sm:h-[420px]" />
                  <div className="bg-white p-6 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
                    <h3 className="text-base font-semibold text-[#222]">{tab.title ?? tab.label}</h3>
                    <div className="mt-6 flex flex-wrap gap-5 text-[11px] font-semibold tracking-wide text-[#8a8a8a]">
                      {t.gallery.productTabs.map((item) => <span key={item}>{item}</span>)}
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-3 border-t pt-5 sm:grid-cols-3">
                      {t.products.slice(0, 3).map((product) => (
                        <a key={product.title} href={product.href || "#"}>
                          <img src={tab.image} alt={product.title} className="h-28 w-full object-cover" />
                          <p className="mt-3 text-sm font-medium text-[#333]">{product.title}</p>
                          <p className="mt-1 text-sm text-[#777]">{product.price}</p>
                        </a>
                      ))}
                    </div>
                    <p className="mt-6 text-2xl font-normal text-[#222]">{t.gallery.cartLabel}</p>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <section className="border-t bg-white px-5 py-14 md:px-6 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto max-w-[780px] text-center">
            <p className="text-sm font-bold tracking-[0.18em] text-[#008f7f]">{t.workflow.eyebrow}</p>
            <h2 className="mt-6 text-3xl font-semibold leading-[1.18] tracking-normal text-[#202020] md:mt-8 md:text-[40px]">{t.workflow.title}</h2>
            <p className="mt-5 text-base leading-7 text-[#666] md:mt-6 md:text-lg">{t.workflow.subtitle}</p>
          </div>
          <Tabs defaultValue={defaultWorkflow} className="mx-auto mt-10 grid max-w-[1060px] items-start gap-8 md:mt-16 lg:grid-cols-[minmax(0,760px)_220px] lg:gap-20">
            <div className="w-full">
              {t.workflow.tabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="mt-0">
                  <div className="relative mx-auto min-h-[380px] w-full max-w-[770px] overflow-hidden bg-[#ddecf5] sm:min-h-[520px] md:min-h-[575px]">
                    <img src={tab.image} alt={tab.label} className="absolute inset-0 h-full w-full object-cover opacity-65" />
                    <div className="absolute left-1/2 top-8 w-[82%] min-w-0 -translate-x-1/2 overflow-hidden rounded-md bg-white shadow-[0_12px_34px_rgba(0,0,0,0.18)] sm:top-10 sm:w-[60%] sm:min-w-[300px]">
                      <img src={tab.image} alt={tab.label} className="h-36 w-full object-cover opacity-85" />
                      <div className="p-6">
                        <h3 className="text-sm font-semibold text-[#222]">{tab.label}</h3>
                        <p className="mt-4 text-xs leading-5 text-[#555]">{t.workflow.cardText}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </div>
            <TabsList className="mx-auto grid h-auto w-full max-w-[520px] grid-cols-2 gap-x-8 gap-y-5 bg-transparent p-0 text-left lg:mx-0 lg:max-w-none lg:grid-cols-1 lg:gap-y-5">
              {t.workflow.tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="h-auto justify-start rounded-none border-0 bg-transparent p-0 text-xl font-semibold leading-tight text-[#adadad] shadow-none data-active:bg-transparent data-active:text-[#202020] data-active:underline data-active:decoration-2 data-active:underline-offset-4 sm:text-3xl">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </section>

      <section className="bg-[#f7f7f7] px-5 py-14 md:px-6 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto max-w-[780px] text-center">
            <p className="text-sm font-bold tracking-[0.18em] text-[#008f7f]">{t.testimonials.eyebrow}</p>
            <h2 className="mt-6 text-3xl font-semibold leading-[1.18] tracking-normal text-[#202020] md:mt-8 md:text-[40px]">{t.testimonials.title}</h2>
            <p className="mt-5 text-base leading-7 text-[#666] md:mt-6 md:text-lg">{t.testimonials.subtitle}</p>
          </div>
          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {t.testimonials.items.map((item) => (
              <Card key={item.name} className="rounded-none border-0 py-0 shadow-none">
                <CardHeader className="px-10 pt-10">
                  <div className="flex items-center gap-4">
                    <Avatar className="size-14"><AvatarImage src={item.image} alt={item.name} /><AvatarFallback>{item.name.slice(0, 2)}</AvatarFallback></Avatar>
                    <div><CardTitle className="text-base font-bold text-black">{item.name}</CardTitle><CardDescription className="mt-1 text-sm text-[#9b9b9b]">{item.site}</CardDescription></div>
                  </div>
                </CardHeader>
                <CardContent className="px-10 pb-10 pt-7"><p className="text-lg leading-7 text-black">"{item.quote}"</p></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-white px-5 py-14 text-center md:px-6 md:py-20">
        <h2 className="text-3xl font-semibold leading-[1.16] tracking-normal text-[#202020] md:text-[40px]">{t.cta.title}</h2>
        <p className="mt-7 text-lg text-[#666]">{t.cta.subtitle}</p>
        <Button asChild className="mt-9 h-11 min-w-40 rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]"><a href="/register">{t.cta.button}</a></Button>
        <div className="mx-auto mt-14 grid max-w-[1000px] gap-5 md:grid-cols-3">
          {t.cta.images.slice(0, 3).map((item, index) => <img key={item} src={item} alt={`${t.cta.title} ${index + 1}`} className="h-72 w-full object-cover shadow-[0_20px_45px_rgba(0,0,0,0.16)]" />)}
        </div>
      </section>

      <footer className="bg-[#171918] px-5 py-14 text-white md:px-6 md:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[1.5fr_2fr]">
          <div className="flex min-h-[360px] flex-col">
            <a href="/" className="inline-flex items-center gap-3 text-white" aria-label={cms.brand.brandText || t.nav.brand}>
              {(cms.brand.logoUrl || cms.brand.brandImageUrl) && <img src={cms.brand.logoUrl || cms.brand.brandImageUrl} alt="" className="h-10 max-w-32 object-contain" />}
              {(cms.brand.brandText || t.nav.brand) && <span className="font-serif text-2xl tracking-[0.36em]">{cms.brand.brandText || t.nav.brand}</span>}
            </a>
            <p className="mt-10 max-w-[470px] text-sm leading-6 text-white/80">{t.footer.description}</p>
            <p className="mt-auto pt-16 text-xs font-semibold text-white/80">{t.footer.copyright}</p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {relevantFooterColumns(lang).map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-bold text-white">{column.title}</h3>
                <ul className="mt-5 flex flex-col gap-5 text-sm text-white/80">
                  {column.links.map((link) => {
                    const item = typeof link === "string" ? { label: link, url: "#" } : link;
                    return <li key={`${item.label}-${item.url}`}><a href={footerHref(item.label, item.url)} className="hover:text-white">{item.label}</a></li>;
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

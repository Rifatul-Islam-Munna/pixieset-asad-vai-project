import type { Metadata } from "next";
import { Cormorant_Garamond, Geist_Mono, Manrope } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import QueryClint from "@/lib/queryclient";
import { Toaster } from "@/components/ui/sonner";
import { GoogleTranslate } from "@/components/translation/google-translate";
import { getHomeCms } from "@/lib/home-cms-server";
import {
  JsonLdScript,
  collectSeoText,
  defaultOrganizationJsonLd,
  parseJsonLd,
  siteMetadata,
} from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-cormorant",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getHomeCms();
  return siteMetadata(
    cms.seo,
    collectSeoText({ auth: cms.auth, content: cms.content, media: cms.media }),
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cms = await getHomeCms();
  const jsonLd =
    parseJsonLd(cms.seo.jsonLd) ?? defaultOrganizationJsonLd(cms.seo);
  const gtmId =
    String(cms.seo.googleTagManagerId ?? "")
      .trim()
      .match(/^GTM[-_][A-Z0-9]+$/i)?.[0] ?? "";

  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        manrope.variable,
        geistMono.variable,
        "font-sans",
        cormorant.variable,
      )}
    >
      <head>
        {(Array.isArray(cms.seo.extraMetaTags)
          ? cms.seo.extraMetaTags
          : []
        ).map((tag, index) => {
          if (
            !String(tag?.key ?? "").trim() ||
            !String(tag?.value ?? "").trim()
          )
            return null;
          if (tag.type === "property")
            return (
              <meta
                key={`${tag.key}-${index}`}
                property={tag.key}
                content={tag.value}
              />
            );
          if (tag.type === "httpEquiv")
            return (
              <meta
                key={`${tag.key}-${index}`}
                httpEquiv={tag.key}
                content={tag.value}
              />
            );
          return (
            <meta
              key={`${tag.key}-${index}`}
              name={tag.key}
              content={tag.value}
            />
          );
        })}
        <JsonLdScript data={jsonLd} id="site-json-ld" />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {gtmId && <GoogleTagManager gtmId={gtmId} />}
        <GoogleTranslate />
        <QueryClint>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryClint>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import QueryClint from "@/lib/queryclient";
import { Toaster } from "@/components/ui/sonner";
import { getHomeCms } from "@/lib/home-cms-server";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getHomeCms();
  const favicon = cms.seo.faviconUrl.trim();

  return {
    title: {
      default: cms.seo.siteTitle,
      template: `%s | ${cms.seo.siteTitle}`,
    },
    description: cms.seo.siteDescription,
    applicationName: cms.seo.siteTitle,
    icons: favicon ? { icon: [{ url: favicon, type: "image/png" }] } : undefined,
    openGraph: {
      title: cms.seo.siteTitle,
      description: cms.seo.siteDescription,
      siteName: cms.seo.siteTitle,
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <QueryClint>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryClint>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

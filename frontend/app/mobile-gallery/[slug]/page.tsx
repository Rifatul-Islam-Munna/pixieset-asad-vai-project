import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { MobileGalleryApp, MobileGalleryProfile } from "@/api-hooks/use-mobile-gallery";
import { MobileGalleryPublic } from "@/components/mobile-gallery/mobile-gallery-public";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

type PublicApp = MobileGalleryApp & { profile?: MobileGalleryProfile };

async function getApp(slug: string): Promise<PublicApp | null> {
  const response = await fetch(`${baseUrl}/public/mobile-gallery/apps/${encodeURIComponent(slug)}`, {
    next: { revalidate: 30, tags: [`mobile-gallery-${slug}`] },
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.data ?? null;
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = await getApp(slug);
  if (!app) return { title: "Mobile Gallery" };
  const icon180 = `/mobile-gallery/${app.slug}/icon/180`;
  const icon192 = `/mobile-gallery/${app.slug}/icon/192`;
  const icon512 = `/mobile-gallery/${app.slug}/icon/512`;
  const splash = (size: string) => `/mobile-gallery/${app.slug}/splash/${size}`;
  return {
    title: app.name,
    description: `Install and view the ${app.name} mobile photo gallery.`,
    applicationName: app.name,
    manifest: `/mobile-gallery/${app.slug}/manifest.webmanifest`,
    icons: {
      icon: [{ url: icon192, sizes: "192x192", type: "image/png" }, { url: icon512, sizes: "512x512", type: "image/png" }],
      apple: [{ url: icon180, sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: app.name,
      statusBarStyle: "black-translucent",
      startupImage: [
        { url: splash("1179x2556"), media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
        { url: splash("1290x2796"), media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
        { url: splash("1170x2532"), media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
        { url: splash("1125x2436"), media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
        { url: splash("1242x2688"), media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" },
        { url: splash("1536x2048"), media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" },
        { url: splash("1668x2388"), media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" },
        { url: splash("2048x2732"), media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" },
      ],
    },
    formatDetection: { telephone: false, address: false, email: false },
    openGraph: {
      title: app.name,
      description: `View the ${app.name} mobile gallery.`,
      images: app.coverImage ? [app.coverImage] : undefined,
    },
  };
}

export default async function PublicMobileGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await getApp(slug);
  if (!app) notFound();
  return <MobileGalleryPublic app={app} profile={app.profile || {}} />;
}

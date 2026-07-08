import type { Metadata } from "next";
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = await getApp(slug);
  if (!app) return { title: "Mobile Gallery" };
  const icon192 = `/mobile-gallery/${app.slug}/icon/192`;
  const icon512 = `/mobile-gallery/${app.slug}/icon/512`;
  return {
    title: app.name,
    description: `Install and view the ${app.name} mobile photo gallery.`,
    manifest: `/mobile-gallery/${app.slug}/manifest.webmanifest`,
    icons: { icon: [{ url: icon192, sizes: "192x192" }, { url: icon512, sizes: "512x512" }], apple: icon192 },
    appleWebApp: { capable: true, title: app.name, statusBarStyle: "black-translucent" },
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

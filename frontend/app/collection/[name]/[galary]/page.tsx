import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";
import { PublicGallery } from "@/components/dashboard/public-gallery";
import { PublicGalleryHashOpener } from "@/components/dashboard/public-gallery-hash-opener";
import { PublicGalleryStoreBridge } from "@/components/dashboard/public-gallery-store-bridge";
import { getHomeCms } from "@/lib/home-cms-server";
import { JsonLdScript, absoluteUrl, collectSeoText, pageMetadata } from "@/lib/seo";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

async function getCollection(identifier: string, siteSlug: string) {
  const response = await fetch(`${baseUrl}/public/collections/${encodeURIComponent(identifier)}?limit=48&offset=0&siteSlug=${encodeURIComponent(siteSlug)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const payload = response?.ok ? await response.json() : null;
  return payload?.data ?? null;
}

function imageSrc(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("/uploads/")) return `${baseUrl}${url}`;
  return url;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}): Promise<Metadata> {
  const { name, galary } = await params;
  const [cms, collection] = await Promise.all([getHomeCms(), getCollection(galary, name)]);
  const studio = decodeURIComponent(name);
  const title = `${collection?.name ?? decodeURIComponent(galary)} | ${studio}`;
  const description = collection?.eventDate
    ? `View ${collection.name} photo gallery by ${studio}.`
    : `View ${collection?.name ?? decodeURIComponent(galary)} photo gallery by ${studio}.`;
  const image = imageSrc(collection?.coverImage || collection?.images?.[0]?.url);
  const autoText = collectSeoText({ studio, collection });
  const metadata = pageMetadata({
    title,
    description,
    keywords: `${collection?.name ?? galary}, ${studio}, photo gallery, client gallery, photography`,
    path: `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}`,
    image,
    seo: cms.seo,
    autoText,
  });
  const visibility = collection?.preferences?.searchEngineVisibility;
  if (visibility === "hidden" || visibility === "homepage") {
    metadata.robots = { index: false, follow: false, googleBot: { index: false, follow: false } };
  }
  return metadata;
}

function gaIdFrom(data: any) {
  const settings = data?.integrations?.googleAnalytics;
  const id = String(settings?.measurementId ?? "").trim().toUpperCase();
  return settings?.enabled && /^G-[A-Z0-9]+$/.test(id) ? id : "";
}

export default async function CollectionGalleryPage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { name, galary } = await params;
  const collection = await getCollection(galary, name);
  if (!collection) notFound();
  const gaId = gaIdFrom(collection);
  const studio = decodeURIComponent(name);
  const title = collection?.name ?? decodeURIComponent(galary);
  const image = imageSrc(collection?.coverImage || collection?.images?.[0]?.url);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: title,
    description: `Photo gallery by ${studio}.`,
    url: absoluteUrl(`/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}`),
    image,
    creator: { "@type": "Organization", name: studio },
  };

  return (
    <>
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <JsonLdScript data={jsonLd} id="gallery-json-ld" />
      <PublicGalleryHashOpener />
      <PublicGallery name={name} galary={galary} collection={collection} />
      <PublicGalleryStoreBridge name={name} galary={galary} collection={collection} />
    </>
  );
}

import { createHmac, randomUUID } from "crypto";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";
import { PublicGallery } from "@/components/dashboard/public-gallery";
import { PublicGalleryHashOpener } from "@/components/dashboard/public-gallery-hash-opener";
import { PublicGalleryStoreBridge } from "@/components/dashboard/public-gallery-store-bridge";
import { PublicGalleryViewTracker } from "@/components/dashboard/public-gallery-view-tracker";
import { getHomeCms } from "@/lib/home-cms-server";
import { apiBaseUrl } from "@/lib/api-base-url";
import {
  JsonLdScript,
  absoluteUrl,
  collectSeoText,
  pageMetadata,
} from "@/lib/seo";

const baseUrl = apiBaseUrl();

const PUBLIC_GALLERY_PAGE_SIZE = 20;

async function getCollection(identifier: string, siteSlug: string) {
  const response = await fetch(
    `${baseUrl}/public/collections/${encodeURIComponent(identifier)}?limit=${PUBLIC_GALLERY_PAGE_SIZE}&offset=0&siteSlug=${encodeURIComponent(siteSlug)}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);
  const payload = response?.ok ? await response.json() : null;
  return payload?.data ?? null;
}

async function getOwnerPreview(collectionId?: string) {
  if (!collectionId) return null;
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return null;

  const fetchPreview = async (setId?: string) => {
    const query = new URLSearchParams({
      limit: String(PUBLIC_GALLERY_PAGE_SIZE),
      offset: "0",
    });
    if (setId) query.set("setId", setId);

    const response = await fetch(
      `${baseUrl}/collections/${encodeURIComponent(collectionId)}/owner-preview?${query.toString()}`,
      {
        cache: "no-store",
        headers: { access_token: token },
        signal: AbortSignal.timeout(8000),
      },
    ).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    return payload?.data ?? null;
  };

  const preview = await fetchPreview();
  if (!preview) return null;

  const initialItems = Array.isArray(preview.imagesPage?.items)
    ? preview.imagesPage.items
    : Array.isArray(preview.images)
      ? preview.images
      : [];

  if (initialItems.length) {
    return {
      ...preview,
      previewInitialSetId: String(initialItems[0]?.setId || "highlights"),
    };
  }

  // The first configured set can be empty. For owner preview, fetch across all
  // sets once on the server so the page never opens as a blank gallery.
  const allSetsPreview = await fetchPreview("__all__");
  const allItems = Array.isArray(allSetsPreview?.imagesPage?.items)
    ? allSetsPreview.imagesPage.items
    : [];

  if (!allSetsPreview || !allItems.length) return preview;

  return {
    ...allSetsPreview,
    images: allItems,
    imagesPage: allSetsPreview.imagesPage,
    previewInitialSetId: String(allItems[0]?.setId || "highlights"),
  };
}

function imageSrc(url?: string) {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return url.startsWith("/") ? `${baseUrl}${url}` : url;
}

async function visitorWatermarkCode() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("cf-connecting-ip") ||
    "unknown";
  const secret =
    process.env.WATERMARK_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "pixieset-watermark-v1";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 8).toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}): Promise<Metadata> {
  const { name, galary } = await params;
  const [cms, collection] = await Promise.all([
    getHomeCms(),
    getCollection(galary, name),
  ]);
  const studio = decodeURIComponent(name);
  const title = `${collection?.name ?? decodeURIComponent(galary)} | ${studio}`;
  const description = collection?.eventDate
    ? `View ${collection.name} photo gallery by ${studio}.`
    : `View ${collection?.name ?? decodeURIComponent(galary)} photo gallery by ${studio}.`;
  const image = imageSrc(
    collection?.coverImage || collection?.images?.[0]?.url,
  );
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
    metadata.robots = {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    };
  }
  return metadata;
}

function gaIdFrom(data: any) {
  const settings = data?.integrations?.googleAnalytics;
  const id = String(settings?.measurementId ?? "")
    .trim()
    .toUpperCase();
  return settings?.enabled && /^G-[A-Z0-9]+$/.test(id) ? id : "";
}

export default async function CollectionGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string; galary: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { name, galary } = await params;
  const { preview } = await searchParams;
  const [collection, visitorCode] = await Promise.all([
    getOwnerPreview(preview).then((ownerCollection) => ownerCollection ?? getCollection(galary, name)),
    visitorWatermarkCode(),
  ]);
  if (!collection) notFound();
  const isOwnerPreview = collection?.ownerPreview === true;
  const gaId = isOwnerPreview ? "" : gaIdFrom(collection);
  const viewToken = randomUUID();
  const studio = decodeURIComponent(name);
  const title = collection?.name ?? decodeURIComponent(galary);
  const image = imageSrc(
    collection?.coverImage || collection?.images?.[0]?.url,
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: title,
    description: `Photo gallery by ${studio}.`,
    url: absoluteUrl(
      `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}`,
    ),
    image,
    creator: { "@type": "Organization", name: studio },
  };

  return (
    <>
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <JsonLdScript data={jsonLd} id="gallery-json-ld" />
      {!isOwnerPreview && (
        <PublicGalleryViewTracker
          identifier={galary}
          siteSlug={name}
          viewToken={viewToken}
        />
      )}
      <PublicGalleryHashOpener />
      <PublicGallery
        name={name}
        galary={galary}
        collection={collection}
        visitorCode={visitorCode}
      />
      <PublicGalleryStoreBridge
        name={name}
        galary={galary}
        collection={collection}
      />
    </>
  );
}

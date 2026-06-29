import type { Metadata } from "next";
import { PublicStore } from "@/components/dashboard/public-store";
import { getHomeCms } from "@/lib/home-cms-server";
import { JsonLdScript, absoluteUrl, collectSeoText, pageMetadata } from "@/lib/seo";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

async function getStore(identifier: string) {
  const response = await fetch(`${baseUrl}/public/store/${encodeURIComponent(identifier)}`, {
    cache: "no-store",
  }).catch(() => null);
  const payload = response?.ok ? await response.json() : null;
  return payload?.data ?? null;
}

function imageSrc(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("/uploads/")) return `${baseUrl}${url}`;
  return url;
}

function plainText(value?: string) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}): Promise<Metadata> {
  const { name, galary } = await params;
  const [cms, data] = await Promise.all([getHomeCms(), getStore(galary)]);
  const studio = decodeURIComponent(name);
  const collectionName = data?.collection?.name ?? decodeURIComponent(galary);
  const firstProduct = data?.products?.[0];
  const autoText = collectSeoText({ studio, collection: data?.collection, products: data?.products });
  const description = firstProduct?.description
    ? plainText(firstProduct.description)
    : `Shop prints, downloads, and photo products from ${collectionName} by ${studio}.`;
  return pageMetadata({
    title: `${collectionName} Store | ${studio}`,
    description,
    keywords: `${collectionName}, ${studio}, photo store, prints, digital downloads, wall art`,
    path: `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}/store`,
    image: imageSrc(firstProduct?.images?.[0]),
    seo: cms.seo,
    autoText,
  });
}

export default async function CollectionStorePage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { name, galary } = await params;
  const data = await getStore(galary);
  const products = data?.products ?? [];
  const collectionName = data?.collection?.name ?? decodeURIComponent(galary);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: `${collectionName} Store`,
    url: absoluteUrl(`/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}/store`),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Photo products",
      itemListElement: products.slice(0, 20).map((product: any) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: product.name,
          description: plainText(product.description),
          image: imageSrc(product.images?.[0]),
        },
        price: product.price,
        priceCurrency: data?.store?.currency ?? "EUR",
      })),
    },
  };

  return (
    <>
      <JsonLdScript data={jsonLd} id="store-json-ld" />
      <PublicStore
        data={data}
        identifier={galary}
        backHref={`/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}`}
      />
    </>
  );
}

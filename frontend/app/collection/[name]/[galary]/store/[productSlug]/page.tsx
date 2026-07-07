import type { Metadata } from "next";
import { PublicStore } from "@/components/dashboard/public-store";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

async function getStore(identifier: string) {
  const response = await fetch(`${baseUrl}/public/collections/${encodeURIComponent(identifier)}/store`, {
    cache: "no-store",
  }).catch(() => null);
  const payload = response?.ok ? await response.json() : null;
  return payload?.data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string; galary: string; productSlug: string }>;
}): Promise<Metadata> {
  const { galary, productSlug } = await params;
  const data = await getStore(galary);
  const product = data?.products?.find((item: any) => item.slug === productSlug);
  return {
    title: product ? `${product.name} | ${data?.collection?.name ?? "Print Store"}` : "Print Store",
    description: product?.description ?? "Choose a photo product from this collection.",
    openGraph: {
      images: product?.previewImages?.[0] || product?.images?.[0]
        ? [product.previewImages?.[0] ?? product.images[0]]
        : undefined,
    },
  };
}

export default async function StoreProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string; galary: string; productSlug: string }>;
  searchParams: Promise<{ imageId?: string }>;
}) {
  const { name, galary, productSlug } = await params;
  const query = await searchParams;
  const data = await getStore(galary);
  return (
    <PublicStore
      data={data}
      identifier={galary}
      backHref={`/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}`}
      initialProductSlug={productSlug}
      initialImageId={query.imageId}
    />
  );
}

import type { Metadata } from "next";
import { PublicStoreProductPage } from "@/components/dashboard/public-store-product-page";

const baseUrl =
  process.env.BASE_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:4000";

async function getStore(identifier: string) {
  const response = await fetch(
    `${baseUrl}/public/collections/${encodeURIComponent(identifier)}/store`,
    { cache: "no-store" },
  ).catch(() => null);
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
  const product = data?.products?.find(
    (item: any) => item.slug === productSlug || item._id === productSlug,
  );
  const preview = product?.previewImages?.[0] || product?.images?.[0];
  return {
    title: product
      ? `${product.name} | ${data?.collection?.name ?? "Print Store"}`
      : "Print Store",
    description:
      product?.description ?? "Choose a photo product from this collection.",
    openGraph: preview ? { images: [preview] } : undefined,
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
  const galleryHref = `/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}`;

  return (
    <PublicStoreProductPage
      data={data}
      identifier={galary}
      backHref={galleryHref}
      productSlug={productSlug}
      initialImageId={query.imageId}
    />
  );
}

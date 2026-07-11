import { PublicStoreCheckoutPage } from "@/components/dashboard/public-store-checkout-page";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

async function getStore(identifier: string, siteSlug: string) {
  const response = await fetch(`${baseUrl}/public/collections/${encodeURIComponent(identifier)}/store?siteSlug=${encodeURIComponent(siteSlug)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const payload = response?.ok ? await response.json() : null;
  return payload?.data ?? null;
}

export default async function CollectionCheckoutPage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { name, galary } = await params;
  const data = await getStore(galary, name);

  return (
    <PublicStoreCheckoutPage
      data={data}
      identifier={galary}
      backHref={`/${encodeURIComponent(galary)}`}
    />
  );
}

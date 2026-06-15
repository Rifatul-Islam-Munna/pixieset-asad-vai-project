import { PublicStore } from "@/components/dashboard/public-store";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export default async function CollectionStorePage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { name, galary } = await params;
  const response = await fetch(`${baseUrl}/public/store/${encodeURIComponent(galary)}`, {
    cache: "no-store",
  }).catch(() => null);
  const payload = response?.ok ? await response.json() : null;

  return (
    <PublicStore
      data={payload?.data ?? null}
      identifier={galary}
      backHref={`/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}`}
    />
  );
}

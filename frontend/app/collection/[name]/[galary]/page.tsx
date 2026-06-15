import { PublicGallery } from "@/components/dashboard/public-gallery";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export default async function CollectionGalleryPage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { name, galary } = await params;
  const response = await fetch(`${baseUrl}/public/collections/${encodeURIComponent(galary)}`, {
    cache: "no-store",
  }).catch(() => null);
  const payload = response?.ok ? await response.json() : null;

  return <PublicGallery name={name} galary={galary} collection={payload?.data ?? null} />;
}

import { notFound } from "next/navigation";
import { PublicGalleryFavoritesPage } from "@/components/dashboard/public-gallery-favorites-page";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

async function getCollection(identifier: string, siteSlug: string) {
  const response = await fetch(`${baseUrl}/public/collections/${encodeURIComponent(identifier)}?siteSlug=${encodeURIComponent(siteSlug)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.data ?? null;
}

export default async function Page({ params }: { params: Promise<{ name: string; galary: string }> }) {
  const { name, galary } = await params;
  const collection = await getCollection(galary, name);
  if (!collection) notFound();
  return <PublicGalleryFavoritesPage name={name} galary={galary} collection={collection} />;
}

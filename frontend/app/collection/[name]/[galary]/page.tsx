import { PublicGallery } from "@/components/dashboard/public-gallery";

export default async function CollectionGalleryPage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { name, galary } = await params;

  return <PublicGallery name={name} galary={galary} />;
}

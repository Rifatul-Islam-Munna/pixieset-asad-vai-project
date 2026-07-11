import { redirect } from "next/navigation";

import { CollectionSharePage } from "@/components/dashboard/collection-share-page";
import type { DashboardSection } from "@/components/dashboard/client-dashboard";

const sections = ["client-gallery", "store-gallery"] as const;

export default async function ShareCollectionPage({
  params,
}: {
  params: Promise<{ section: string; collectionId: string }>;
}) {
  const { section, collectionId } = await params;

  if (!sections.includes(section as DashboardSection)) {
    redirect("/dashboard/client-gallery");
  }

  return (
    <CollectionSharePage
      section={section as DashboardSection}
      collectionId={collectionId}
    />
  );
}

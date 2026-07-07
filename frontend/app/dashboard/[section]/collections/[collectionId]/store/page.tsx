import { redirect } from "next/navigation";

import {
  type DashboardSection,
} from "@/components/dashboard/client-dashboard";
import { CollectionStoreManager } from "@/components/dashboard/collection-store-manager";

const sections = ["client-gallery", "store-gallery"] as const;

export default async function CollectionStorePage({
  params,
}: {
  params: Promise<{ section: string; collectionId: string }>;
}) {
  const { section, collectionId } = await params;

  if (!sections.includes(section as DashboardSection) || section !== "store-gallery") {
    redirect("/dashboard/store-gallery");
  }

  return <CollectionStoreManager collectionId={collectionId} />;
}

import { redirect } from "next/navigation";

import {
  ClientDashboard,
  type DashboardSection,
} from "@/components/dashboard/client-dashboard";

const sections = ["client-gallery", "store-gallery"] as const;

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ section: string; collectionId: string }>;
}) {
  const { section, collectionId } = await params;

  if (!sections.includes(section as DashboardSection)) {
    redirect("/dashboard/client-gallery");
  }

  return (
    <ClientDashboard
      page="collections"
      section={section as DashboardSection}
      collectionId={collectionId}
    />
  );
}

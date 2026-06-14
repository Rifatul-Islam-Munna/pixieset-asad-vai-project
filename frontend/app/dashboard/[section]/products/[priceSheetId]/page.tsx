import { redirect } from "next/navigation";

import {
  ClientDashboard,
  type DashboardSection,
} from "@/components/dashboard/client-dashboard";

const sections = ["client-gallery", "store-gallery"] as const;

export default async function StorePriceSheetPage({
  params,
}: {
  params: Promise<{ section: string; priceSheetId: string }>;
}) {
  const { section, priceSheetId } = await params;

  if (!sections.includes(section as DashboardSection) || section !== "store-gallery") {
    redirect("/dashboard/store-gallery");
  }

  return (
    <ClientDashboard
      page="products"
      section={section as DashboardSection}
      priceSheetId={priceSheetId}
    />
  );
}

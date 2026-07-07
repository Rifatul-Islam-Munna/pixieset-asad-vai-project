import { redirect } from "next/navigation";

import {
  ClientDashboard,
  type DashboardSection,
} from "@/components/dashboard/client-dashboard";
import type { StoreProductType } from "@/api-hooks/use-store";

const sections = ["client-gallery", "store-gallery"] as const;

export default async function StorePricingProductControlPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; productId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { section, productId } = await params;
  const query = await searchParams;

  if (!sections.includes(section as DashboardSection) || section !== "store-gallery") {
    redirect("/dashboard/store-gallery");
  }

  const type =
    query.type === "digital-download" || query.type === "self-fulfilled"
      ? (query.type as StoreProductType)
      : undefined;

  return (
    <ClientDashboard
      page="pricing"
      section={section as DashboardSection}
      productId={productId}
      productType={type}
    />
  );
}

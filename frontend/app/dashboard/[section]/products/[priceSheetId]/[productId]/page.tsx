import { redirect } from "next/navigation";

import {
  ClientDashboard,
  type DashboardSection,
} from "@/components/dashboard/client-dashboard";
import type { StoreProductType } from "@/api-hooks/use-store";

const sections = ["client-gallery", "store-gallery"] as const;

export default async function StoreProductControlPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; priceSheetId: string; productId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { section, priceSheetId, productId } = await params;
  const query = await searchParams;

  if (!sections.includes(section as DashboardSection) || section !== "store-gallery") {
    redirect("/dashboard/store-gallery");
  }

  const type =
    query.type === "digital-download" || query.type === "self-fulfilled" || query.type === "package"
      ? (query.type as StoreProductType)
      : undefined;

  return (
    <ClientDashboard
      page="products"
      section={section as DashboardSection}
      priceSheetId={priceSheetId}
      productId={productId}
      productType={type}
    />
  );
}

import { redirect } from "next/navigation";

import {
  ClientDashboard,
  type DashboardPage,
  type DashboardSection,
} from "@/components/dashboard/client-dashboard";

const sections = ["client-gallery", "store-gallery"] as const;

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!sections.includes(section as DashboardSection)) {
    redirect("/dashboard/client-gallery");
  }

  const page = section === "client-gallery" ? "collections" : "storefront";

  return (
    <ClientDashboard
      page={page as DashboardPage}
      section={section as DashboardSection}
    />
  );
}

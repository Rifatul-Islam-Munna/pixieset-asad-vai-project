import { redirect } from "next/navigation";

import {
  ClientDashboard,
  type DashboardPage,
  type DashboardSection,
} from "@/components/dashboard/client-dashboard";

const sections = ["client-gallery", "store-gallery"] as const;
const pages = [
  "collections",
  "collection-new",
  "library",
  "starred",
  "homepage",
  "settings",
  "marketing",
  "products",
  "orders",
  "storefront",
  "storage",
] as const;

export default async function DashboardNestedPage({
  params,
}: {
  params: Promise<{ section: string; page: string }>;
}) {
  const { section, page } = await params;

  if (!sections.includes(section as DashboardSection)) {
    redirect("/dashboard/client-gallery");
  }

  if (!pages.includes(page as DashboardPage)) {
    redirect(`/dashboard/${section}`);
  }

  if (page === "marketing") {
    redirect(`/dashboard/${section}/marketing/email-campaigns`);
  }

  return (
    <ClientDashboard
      page={page as DashboardPage}
      section={section as DashboardSection}
    />
  );
}

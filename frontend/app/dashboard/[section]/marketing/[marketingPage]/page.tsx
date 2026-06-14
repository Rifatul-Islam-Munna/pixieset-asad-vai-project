import { redirect } from "next/navigation";

import {
  ClientDashboard,
  type DashboardSection,
  type MarketingPage,
} from "@/components/dashboard/client-dashboard";

const sections = ["client-gallery", "store-gallery"] as const;
const marketingPages = ["email-campaigns", "contacts", "settings"] as const;

export default async function DashboardMarketingPage({
  params,
}: {
  params: Promise<{ section: string; marketingPage: string }>;
}) {
  const { section, marketingPage } = await params;

  if (!sections.includes(section as DashboardSection)) {
    redirect("/dashboard/client-gallery");
  }

  if (!marketingPages.includes(marketingPage as MarketingPage)) {
    redirect(`/dashboard/${section}/marketing/email-campaigns`);
  }

  return (
    <ClientDashboard
      marketingPage={marketingPage as MarketingPage}
      page="marketing"
      section={section as DashboardSection}
    />
  );
}

import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { notFound } from "next/navigation";

const sections = ["client-gallery", "store-gallery"];
const pages = [
  "collections",
  "collection-new",
  "library",
  "favorites",
  "starred",
  "homepage",
  "marketing",
  "settings",
  "storage",
  "storefront",
  "pricing",
  "products",
  "orders",
  "customers",
  "taxes",
  "shipping",
  "coupons",
];

export default async function DashboardSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; page: string }>;
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const { section, page } = await params;
  await searchParams;
  if (!sections.includes(section) || !pages.includes(page)) notFound();

  return <ClientDashboard section={section} page={page} />;
}

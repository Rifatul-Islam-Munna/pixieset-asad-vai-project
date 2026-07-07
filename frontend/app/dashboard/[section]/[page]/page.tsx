import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { notFound, redirect } from "next/navigation";

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
  "get-started",
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
  if (section === "store-gallery" && page === "pricing") {
    redirect("/dashboard/store-gallery/products");
  }

  return <ClientDashboard section={section} page={page} />;
}

import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { CollectionStoreManager } from "@/components/dashboard/collection-store-manager";
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
  const query = await searchParams;
  if (!sections.includes(section) || !pages.includes(page)) notFound();

  if (section === "store-gallery" && page === "products" && query.collectionId) {
    return <CollectionStoreManager collectionId={query.collectionId} />;
  }

  return <ClientDashboard section={section} page={page} />;
}

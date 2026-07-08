import { redirect } from "next/navigation";
import { getAdminDefaultStoreProducts } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminDefaultProductsPage } from "@/components/dashboard/admin-default-products-page";

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/client-gallery");
  const products = await getAdminDefaultStoreProducts();
  return <AdminDefaultProductsPage initialProducts={products} />;
}

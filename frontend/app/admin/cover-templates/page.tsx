import { redirect } from "next/navigation";
import { getAdminHomeCms } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminCoverTemplatesPage } from "@/components/dashboard/admin-cover-templates-page";
import { mergeHomeCms } from "@/lib/home-cms";

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/client-gallery");
  const homeCms = await getAdminHomeCms();
  return <AdminCoverTemplatesPage initialCms={mergeHomeCms(homeCms)} />;
}

import { redirect } from "next/navigation";
import { getAdminHomeCms } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminEmailTemplatesPage } from "@/components/dashboard/admin-email-templates-page";
import { mergeHomeCms } from "@/lib/home-cms";

export default async function Page() {
  const user = await getUser();
  if (user?.role !== "admin") redirect("/login");
  const homeCms = await getAdminHomeCms();
  return <AdminEmailTemplatesPage initialCms={mergeHomeCms(homeCms)} />;
}

import { redirect } from "next/navigation";
import { getAdminDynamicPages } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminDynamicPages } from "@/components/dashboard/admin-dynamic-pages";

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/client-gallery");
  const pages = await getAdminDynamicPages();
  return <AdminDynamicPages initialPages={pages} />;
}

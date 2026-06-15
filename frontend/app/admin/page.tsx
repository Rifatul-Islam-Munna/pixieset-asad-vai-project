import { redirect } from "next/navigation";
import { getAdminDashboard } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

export default async function AdminPage() {
  const user = await getUser();
  if (user?.role !== "admin") redirect("/admin/login");

  const data = await getAdminDashboard();
  return <AdminDashboard initialData={data} />;
}

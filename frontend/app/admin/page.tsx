import { redirect } from "next/navigation";
import { getAdminDashboard } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const user = await getUser();
  if (user?.role !== "admin") redirect("/login");

  const data = await getAdminDashboard();
  const params = await searchParams;
  return <AdminDashboard initialData={data} initialTab={params?.tab} />;
}

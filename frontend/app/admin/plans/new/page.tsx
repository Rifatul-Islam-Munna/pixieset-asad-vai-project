import { redirect } from "next/navigation";
import { getUser } from "@/actions/auth";
import { AdminPlanEditor } from "@/components/dashboard/admin-plan-editor";

export default async function NewAdminPlanPage() {
  const user = await getUser();
  if (user?.role !== "admin") redirect("/login");
  return <AdminPlanEditor />;
}

import { notFound, redirect } from "next/navigation";
import { getAdminDashboard } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminPlanEditor } from "@/components/dashboard/admin-plan-editor";

export default async function EditAdminPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const user = await getUser();
  if (user?.role !== "admin") redirect("/login");
  const { planId } = await params;
  const data = await getAdminDashboard();
  const plan = data.plans.find((item) => item._id === planId);
  if (!plan) notFound();
  return <AdminPlanEditor plan={plan} />;
}

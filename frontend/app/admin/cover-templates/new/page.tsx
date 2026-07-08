import { redirect } from "next/navigation";
import { getAdminHomeCms } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminCoverTemplateEditorPage } from "@/components/dashboard/admin-cover-template-editor-page";
import { mergeHomeCms } from "@/lib/home-cms";

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/client-gallery");
  const homeCms = mergeHomeCms(await getAdminHomeCms());
  return <AdminCoverTemplateEditorPage initialCms={homeCms} />;
}

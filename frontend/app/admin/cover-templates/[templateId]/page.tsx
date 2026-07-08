import { notFound, redirect } from "next/navigation";
import { getAdminHomeCms } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminCoverTemplateEditorPage } from "@/components/dashboard/admin-cover-template-editor-page";
import { mergeHomeCms } from "@/lib/home-cms";

export default async function Page({ params }: { params: Promise<{ templateId: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/client-gallery");
  const { templateId } = await params;
  const homeCms = mergeHomeCms(await getAdminHomeCms());
  const template = homeCms.coverTemplates.find((item) => item.id === decodeURIComponent(templateId));
  if (!template) notFound();
  return <AdminCoverTemplateEditorPage initialCms={homeCms} template={template} />;
}

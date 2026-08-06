import { redirect } from "next/navigation";
import { getAdminBlogs } from "@/actions/admin";
import { getUser } from "@/actions/auth";
import { AdminBlogPage } from "@/components/dashboard/admin-blog-page";

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/client-gallery");
  const blogs = await getAdminBlogs();
  return <AdminBlogPage initialBlogs={blogs} />;
}

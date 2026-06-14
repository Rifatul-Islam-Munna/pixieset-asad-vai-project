import { redirect } from "next/navigation";

const sections = ["client-gallery", "store-gallery"] as const;

export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!sections.includes(section as (typeof sections)[number])) {
    redirect("/dashboard/client-gallery/settings/watermark");
  }

  redirect(`/dashboard/${section}/settings/watermark`);
}

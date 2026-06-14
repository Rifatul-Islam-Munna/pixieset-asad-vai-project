import { redirect } from "next/navigation";

import {
  ClientDashboard,
  type DashboardSection,
  type SettingsPage,
} from "@/components/dashboard/client-dashboard";

const sections = ["client-gallery", "store-gallery"] as const;
const pages = [
  "branding",
  "watermark",
  "presets",
  "email-templates",
  "preferences",
  "integrations",
] as const;

export default async function DashboardSettingsPage({
  params,
}: {
  params: Promise<{ section: string; settingsPage: string[] }>;
}) {
  const { section, settingsPage } = await params;

  if (!sections.includes(section as DashboardSection)) {
    redirect("/dashboard/client-gallery/settings/watermark");
  }

  const [page, action] = settingsPage;

  if (page === "presets" && action === "new") {
    return (
      <ClientDashboard
        page="settings"
        section={section as DashboardSection}
        settingsPage="preset-new"
      />
    );
  }

  if (page === "watermark" && action) {
    return (
      <ClientDashboard
        page="settings"
        section={section as DashboardSection}
        settingsPage="watermark-editor"
      />
    );
  }

  if (!pages.includes(page as (typeof pages)[number])) {
    redirect(`/dashboard/${section}/settings/watermark`);
  }

  return (
    <ClientDashboard
      page="settings"
      section={section as DashboardSection}
      settingsPage={page as SettingsPage}
    />
  );
}

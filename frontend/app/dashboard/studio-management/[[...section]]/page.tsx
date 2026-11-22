import type { Metadata } from "next";
import { StudioManager } from "@/components/studio/studio-manager";

export const metadata: Metadata = {
  title: "Studio Manager | Gallerista",
  robots: { index: false, follow: false },
};

export default async function StudioManagerPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  return <StudioManager
    page={section?.[0] || "home"}
    projectId={section?.[0] === "projects" ? section?.[1] : undefined}
    sessionTypeId={section?.[0] === "session-types" ? section?.[1] : undefined}
  />;
}

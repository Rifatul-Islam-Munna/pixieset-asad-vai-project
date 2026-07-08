import { MobileGalleryDashboard } from "@/components/mobile-gallery/mobile-gallery-dashboard";

export default async function MobileGalleryPreviewPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  return <MobileGalleryDashboard view="preview" appId={appId} />;
}

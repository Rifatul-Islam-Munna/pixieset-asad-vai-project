import { MobileGalleryDashboard } from "@/components/mobile-gallery/mobile-gallery-dashboard";

export default async function MobileGallerySharePage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  return <MobileGalleryDashboard view="share" appId={appId} />;
}

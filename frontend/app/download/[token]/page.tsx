import type { Metadata } from "next";
import { GalleryDownloadClient } from "@/components/downloads/gallery-download-client";

export const metadata: Metadata = {
  title: "Secure photo download | Gallerista",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GalleryDownloadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GalleryDownloadClient token={token} />;
}

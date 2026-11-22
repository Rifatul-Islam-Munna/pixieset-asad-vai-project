import type {Metadata} from "next";
import {studioOverview} from "@/actions/studio";
import {StudioPreviewTab} from "@/components/studio/studio-preview-tab";

export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Client Preview | Gallerista Studio",
  robots:{index:false,follow:false},
};

/**
 * Authentication is checked on the server before the tab loads any temporary
 * document payload. The snapshot itself never goes through a public URL or API.
 */
export default async function StudioOwnerPreviewPage(){
  await studioOverview();
  return <StudioPreviewTab/>;
}

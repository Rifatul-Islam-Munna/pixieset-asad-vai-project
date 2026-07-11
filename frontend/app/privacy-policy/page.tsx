import { LegalPage } from "@/components/home/legal-page";

export const dynamic = "force-dynamic";
export default function PrivacyPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) { return <LegalPage type="privacy" searchParams={searchParams} />; }

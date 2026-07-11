import { LegalPage } from "@/components/home/legal-page";

export const dynamic = "force-dynamic";
export default function TermsPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) { return <LegalPage type="terms" searchParams={searchParams} />; }

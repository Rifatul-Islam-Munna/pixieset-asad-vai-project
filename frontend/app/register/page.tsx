import type { Metadata } from "next";
import { RegisterPageClient } from "@/components/auth/auth-pages";
import { getHomeCms } from "@/lib/home-cms-server";
import { collectSeoText, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getHomeCms();
  const metadata = pageMetadata({
    title: cms.seo.registerTitle,
    description: cms.seo.registerDescription,
    keywords: cms.seo.registerKeywords,
    path: "/register",
    seo: cms.seo,
    autoText: collectSeoText(cms.auth),
  });
  return { ...metadata, robots: { index: false, follow: false } };
}

export default async function RegisterPage() {
  const cms = await getHomeCms();
  return <RegisterPageClient auth={cms.auth} brand={cms.brand} />;
}

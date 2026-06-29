import type { Metadata } from "next";
import { LoginPageClient } from "@/components/auth/auth-pages";
import { getHomeCms } from "@/lib/home-cms-server";
import { collectSeoText, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getHomeCms();
  return pageMetadata({
    title: cms.seo.loginTitle,
    description: cms.seo.loginDescription,
    keywords: cms.seo.loginKeywords,
    path: "/login",
    seo: cms.seo,
    autoText: collectSeoText(cms.auth),
  });
}

export default async function LoginPage() {
  const cms = await getHomeCms();
  return <LoginPageClient auth={cms.auth} />;
}

import type { Metadata } from "next";
import { LoginPageClient } from "@/components/auth/auth-pages";
import { getHomeCms } from "@/lib/home-cms-server";

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getHomeCms();
  return {
    title: { absolute: cms.seo.loginTitle },
    description: cms.seo.loginDescription,
  };
}

export default async function LoginPage() {
  const cms = await getHomeCms();
  return <LoginPageClient auth={cms.auth} />;
}

import type { Metadata } from "next";
import { RegisterPageClient } from "@/components/auth/auth-pages";
import { getHomeCms } from "@/lib/home-cms-server";

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getHomeCms();
  return {
    title: { absolute: cms.seo.registerTitle },
    description: cms.seo.registerDescription,
  };
}

export default async function RegisterPage() {
  const cms = await getHomeCms();
  return <RegisterPageClient auth={cms.auth} />;
}

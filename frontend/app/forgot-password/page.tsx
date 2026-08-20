import type { Metadata } from "next";
import { ForgotPasswordPageClient } from "@/components/auth/forgot-password-page";
import { getHomeCms } from "@/lib/home-cms-server";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request secure login access by email.",
};

export default async function ForgotPasswordPage() {
  const cms = await getHomeCms();
  return <ForgotPasswordPageClient auth={cms.auth} brand={cms.brand} />;
}

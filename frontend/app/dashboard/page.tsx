import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/api-base-url";
import { BackendRequestError, fetchBackendJson } from "@/lib/backend-request";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) redirect("/login");

  let destination = "/dashboard/client-gallery";
  try {
    const result = await fetchBackendJson<{ data: string }>(
      `${apiBaseUrl()}/billing/dashboard-destination`,
      {
        headers: { access_token: token },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (result?.data === "/dashboard/studio-management/home" || result?.data === "/admin") {
      destination = result.data;
    }
  } catch (error) {
    if (error instanceof BackendRequestError && [401, 403].includes(error.statusCode)) {
      destination = "/login";
    }
    // A temporary billing API failure must not stop the existing Gallery dashboard opening.
  }
  redirect(destination);
}

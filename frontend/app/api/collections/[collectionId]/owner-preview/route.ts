import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api-base-url";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const token = (await cookies()).get("access_token")?.value;
  const { collectionId } = await params;
  const query = new URL(request.url).searchParams;
  const limit = query.get("limit") ?? "20";
  const offset = query.get("offset") ?? "0";
  const setId = query.get("setId") ?? "";
  const siteSlug = query.get("siteSlug") ?? "";

  const ownerQuery = new URLSearchParams({ limit, offset });
  if (setId) ownerQuery.set("setId", setId);

  if (token) {
    const ownerResponse = await fetch(
      `${apiBaseUrl()}/collections/${encodeURIComponent(collectionId)}/owner-preview?${ownerQuery.toString()}`,
      {
        cache: "no-store",
        headers: { access_token: token },
        signal: AbortSignal.timeout(8000),
      },
    ).catch(() => null);

    if (ownerResponse?.ok) {
      const payload = await ownerResponse.json().catch(() => null);
      return NextResponse.json({ data: payload?.data?.imagesPage ?? null });
    }
  }

  // A published owner preview should still work if the auth cookie is missing
  // or stale in the newly opened tab. Fall back to the exact public image
  // endpoint visitors use instead of leaving the preview blank.
  const publicQuery = new URLSearchParams({ limit, offset });
  if (setId) publicQuery.set("setId", setId);
  if (siteSlug) publicQuery.set("siteSlug", siteSlug);

  const publicResponse = await fetch(
    `${apiBaseUrl()}/public/collections/${encodeURIComponent(collectionId)}/images?${publicQuery.toString()}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);

  if (!publicResponse) {
    return NextResponse.json(
      { message: "Preview images are temporarily unavailable" },
      { status: 504 },
    );
  }

  const payload = await publicResponse.json().catch(() => null);
  if (!publicResponse.ok) {
    return NextResponse.json(
      payload ?? { message: "Preview images could not load" },
      { status: publicResponse.status },
    );
  }

  return NextResponse.json({ data: payload?.data ?? null });
}

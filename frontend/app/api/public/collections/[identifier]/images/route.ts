import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api-base-url";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await params;
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ["email", "pin", "limit", "offset", "siteSlug", "setId"]) {
    const value = incoming.get(key);
    if (value) query.set(key, value);
  }

  const response = await fetch(
    `${apiBaseUrl()}/public/collections/${encodeURIComponent(identifier)}/images?${query.toString()}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);

  if (!response) {
    return NextResponse.json(
      { message: "Gallery images are temporarily unavailable" },
      { status: 504 },
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      payload ?? { message: "Gallery images could not load" },
      { status: response.status },
    );
  }
  return NextResponse.json(payload);
}

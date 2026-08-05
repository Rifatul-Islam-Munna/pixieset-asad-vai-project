import { NextRequest, NextResponse } from "next/server";

const baseUrl =
  process.env.BASE_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:4000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await params;
  const body = await request.json().catch(() => ({}));
  const siteSlug = request.nextUrl.searchParams.get("siteSlug") ?? "";
  const response = await fetch(
    `${baseUrl}/public/collections/${encodeURIComponent(identifier)}/view?siteSlug=${encodeURIComponent(siteSlug)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  ).catch(() => null);

  if (!response) {
    return NextResponse.json(
      { message: "View service is unavailable." },
      { status: 503 },
    );
  }

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ identifier: string; imageId: string }> },
) {
  const { identifier, imageId } = await params;
  const body = await request.json().catch(() => null);
  const url = new URL(request.url);
  const siteSlug = url.searchParams.get("siteSlug");
  const response = await fetch(
    `${baseUrl}/public/collections/${encodeURIComponent(identifier)}/image-favorites/${encodeURIComponent(imageId)}${siteSlug ? `?siteSlug=${encodeURIComponent(siteSlug)}` : ""}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: body?.email ?? "" }),
      cache: "no-store",
    },
  );
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.status });
}

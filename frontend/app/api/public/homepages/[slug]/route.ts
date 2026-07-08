import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const password = request.nextUrl.searchParams.get("password") ?? "";
  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(
    `${baseUrl}/public/homepages/${encodeURIComponent(slug)}?password=${encodeURIComponent(password)}`,
    { cache: "no-store" },
  );
  const payload = await response.json().catch(() => ({ message: "Could not load homepage" }));
  return NextResponse.json(payload, { status: response.status });
}

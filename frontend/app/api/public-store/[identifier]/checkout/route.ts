import { NextRequest, NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await params;
  const body = await request.json();
  const response = await fetch(`${baseUrl}/public/store/${encodeURIComponent(identifier)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status !== 404) {
    return NextResponse.json(payload, { status: response.status });
  }

  return NextResponse.json(
    { message: "Backend checkout route missing. Restart backend server." },
    { status: 503 },
  );
}

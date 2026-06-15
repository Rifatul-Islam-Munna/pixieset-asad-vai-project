import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const response = await fetch(`${baseUrl}/public/store/checkout-session/${encodeURIComponent(sessionId)}`);
  const payload = await response.json().catch(() => ({}));

  return NextResponse.json(payload, { status: response.status });
}

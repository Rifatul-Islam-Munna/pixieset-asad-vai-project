import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const response = await fetch(
    `${baseUrl}/public/collections/store/checkout-session/${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  ).catch(() => null);
  if (!response) return NextResponse.json({ message: "Store service is unavailable." }, { status: 503 });
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

import { NextResponse } from "next/server";

const baseUrl =
  process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ message: "Print order unavailable." }, { status: 404 });
  }
  const response = await fetch(
    `${baseUrl}/public/print-lab/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).catch(() => null);
  if (!response) {
    return NextResponse.json({ message: "Print service is unavailable." }, { status: 503 });
  }
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, {
    status: response.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

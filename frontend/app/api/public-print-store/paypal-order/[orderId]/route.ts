import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const response = await fetch(
    `${baseUrl}/public/collections/store/paypal-order/${encodeURIComponent(orderId)}/capture`,
    { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store" },
  );
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

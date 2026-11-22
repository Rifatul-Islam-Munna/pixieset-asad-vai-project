import { NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api-base-url";

const baseUrl = apiBaseUrl();

export async function POST(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = await params;
  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${baseUrl}/public/bookings/${encodeURIComponent(identifier)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Booking request failed" }, { status: response.status });
}

import { NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api-base-url";

const baseUrl = apiBaseUrl();

export async function GET(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = await params;
  const url = new URL(request.url);
  const serviceId = url.searchParams.get("serviceId") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const invite = url.searchParams.get("invite") ?? "";
  const response = await fetch(`${baseUrl}/public/bookings/${encodeURIComponent(identifier)}/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}${invite ? `&invite=${encodeURIComponent(invite)}` : ""}`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Availability unavailable" }, { status: response.status });
}

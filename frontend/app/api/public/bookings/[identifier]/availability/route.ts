import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

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

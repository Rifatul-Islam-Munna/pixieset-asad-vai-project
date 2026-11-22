import { NextRequest, NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api-base-url";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}\.ics$/.test(token)) {
    return new NextResponse("Calendar not found", { status: 404 });
  }
  const secret = token.slice(0, -4);
  const response = await fetch(apiBaseUrl() + "/public/studio/calendar/" + secret, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!response?.ok) return new NextResponse("Calendar not available", { status: response?.status || 502 });
  const ics = await response.text();
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=120",
      "Content-Disposition": 'inline; filename="studio-calendar.ics"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}

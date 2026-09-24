import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api-base-url";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${apiBaseUrl()}/dynamic-pages`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ data: [] }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

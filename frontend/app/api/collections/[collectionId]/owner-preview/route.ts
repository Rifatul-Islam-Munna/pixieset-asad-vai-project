import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api-base-url";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { collectionId } = await params;
  const query = new URL(request.url).searchParams;
  const limit = query.get("limit") ?? "48";
  const offset = query.get("offset") ?? "0";
  const response = await fetch(
    `${apiBaseUrl()}/collections/${encodeURIComponent(collectionId)}/owner-preview?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    { cache: "no-store", headers: { access_token: token } },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(payload ?? { message: "Preview failed" }, { status: response.status });
  }
  return NextResponse.json({ data: payload?.data?.imagesPage ?? null });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET() {
  const token = (await cookies()).get("access_token")?.value ?? "";
  if (!token) return NextResponse.json({ message: "Login required" }, { status: 401 });

  const response = await fetch(`${baseUrl}/collections/image-favorites`, {
    headers: { access_token: token },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: Request) {
  const token = (await cookies()).get("access_token")?.value ?? "";
  if (!token) return NextResponse.json({ message: "Login required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const imageId = String(body?.imageId ?? "");
  if (!imageId) return NextResponse.json({ message: "Photo is required" }, { status: 400 });

  const response = await fetch(`${baseUrl}/collections/image-favorites/${encodeURIComponent(imageId)}`, {
    method: "POST",
    headers: { access_token: token },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.status });
}

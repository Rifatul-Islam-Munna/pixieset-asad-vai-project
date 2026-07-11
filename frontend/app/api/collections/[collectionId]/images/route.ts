import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const baseUrl =
  process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const { collectionId } = await params;
  const accessToken = (await cookies()).get("access_token")?.value ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data") || !request.body) return NextResponse.json({ message: "Files are required" }, { status: 400 });
  const response = await fetch(`${baseUrl}/collections/${collectionId}/images`, {
    method: "POST",
    headers: {
      access_token: accessToken,
      "content-type": contentType,
    },
    body: request.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const data = await response.json().catch(() => null);

  return NextResponse.json(data, { status: response.status });
}

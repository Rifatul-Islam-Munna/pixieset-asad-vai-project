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
  const incoming = await request.formData();
  const formData = new FormData();

  const setId = incoming.get("setId");
  const watermarkId = incoming.get("watermarkId");
  if (typeof setId === "string") formData.append("setId", setId);
  if (typeof watermarkId === "string") formData.append("watermarkId", watermarkId);

  const files = incoming
    .getAll("files")
    .filter((value): value is File => value instanceof Blob && "name" in value);
  files.forEach((file) => {
    formData.append("files", file, file.name || "upload");
  });

  if (!files.length) {
    return NextResponse.json(
      { message: "Files are required", error: "Bad Request", statusCode: 400 },
      { status: 400 },
    );
  }

  const response = await fetch(`${baseUrl}/collections/${collectionId}/images`, {
    method: "POST",
    headers: {
      access_token: accessToken,
    },
    body: formData,
  });

  const data = await response.json().catch(() => null);

  return NextResponse.json(data, { status: response.status });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function POST(request: Request, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const accessToken = (await cookies()).get("access_token")?.value ?? "";
  const incoming = await request.formData();
  const outgoing = new FormData();
  const files = incoming.getAll("files").filter((value): value is File => value instanceof Blob && "name" in value);
  files.forEach((file) => outgoing.append("files", file, file.name || "upload"));
  if (!files.length) return NextResponse.json({ message: "Files are required" }, { status: 400 });
  const response = await fetch(`${baseUrl}/mobile-gallery/apps/${appId}/images`, {
    method: "POST",
    headers: { access_token: accessToken },
    body: outgoing,
  });
  const data = await response.json().catch(() => ({ message: "Upload failed" }));
  return NextResponse.json(data, { status: response.status });
}

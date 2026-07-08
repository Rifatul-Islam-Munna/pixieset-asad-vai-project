import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const accessToken = (await cookies()).get("access_token")?.value ?? "";
  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ message: "File is required" }, { status: 400 });
  const outgoing = new FormData();
  outgoing.append("file", file, "name" in file ? file.name || "asset" : "asset");
  const response = await fetch(`${baseUrl}/mobile-gallery/assets`, {
    method: "POST",
    headers: { access_token: accessToken },
    body: outgoing,
  });
  const data = await response.json().catch(() => ({ message: "Upload failed" }));
  return NextResponse.json(data, { status: response.status });
}

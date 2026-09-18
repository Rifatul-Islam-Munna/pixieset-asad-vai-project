import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const baseUrl =
  process.env.BASE_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:4000";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ orderId: string; imageId: string }>;
  },
) {
  const { orderId, imageId } = await params;
  const token = (await cookies()).get("access_token")?.value ?? "";
  if (!token) {
    return NextResponse.json(
      { message: "Order image unavailable." },
      { status: 401 },
    );
  }
  const target =
    `${baseUrl}/store/orders/${encodeURIComponent(orderId)}/images/${encodeURIComponent(imageId)}/original`;
  const response = await fetch(target, {
    cache: "no-store",
    headers: { access_token: token },
  }).catch(() => null);

  if (!response) {
    return NextResponse.json(
      { message: "Image service is unavailable." },
      { status: 503 },
    );
  }

  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store");
  for (const name of ["content-type", "content-length", "content-disposition"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (new URL(request.url).searchParams.get("download") !== "1") {
    const disposition = headers.get("content-disposition");
    if (disposition) {
      headers.set("content-disposition", disposition.replace(/^attachment/i, "inline"));
    }
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers,
  });
}

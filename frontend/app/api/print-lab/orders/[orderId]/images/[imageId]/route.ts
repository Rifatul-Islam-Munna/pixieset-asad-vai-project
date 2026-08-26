import { NextResponse } from "next/server";

const baseUrl =
  process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string; imageId: string }> },
) {
  const { orderId, imageId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ message: "Print image unavailable." }, { status: 404 });
  }
  const target = `${baseUrl}/public/print-lab/orders/${encodeURIComponent(orderId)}/images/${encodeURIComponent(imageId)}?token=${encodeURIComponent(token)}`;
  const response = await fetch(target, { cache: "no-store", redirect: "manual" }).catch(() => null);
  if (!response) {
    return NextResponse.json({ message: "Print service is unavailable." }, { status: 503 });
  }
  const location = response.headers.get("location");
  if (location && response.status >= 300 && response.status < 400) {
    return new NextResponse(null, {
      status: response.status,
      headers: {
        Location: location,
        "Cache-Control": "private, no-store",
        ...(response.headers.get("content-disposition")
          ? { "Content-Disposition": response.headers.get("content-disposition")! }
          : {}),
      },
    });
  }
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, {
    status: response.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

import { NextResponse } from "next/server";

function gone() {
  return NextResponse.json(
    { message: "Photo downloads are now fetched and packaged directly in the visitor's browser. Please use the gallery download page." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

// Kept temporarily so old clients fail clearly instead of buffering entire
// galleries in a Next.js server process.
export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}

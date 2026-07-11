import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const RESERVED_HOSTS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "ftp",
  "cdn",
  "assets",
  "support",
  "status",
]);

const FORBIDDEN_PATHS = ["/login", "/register", "/dashboard", "/admin", "/plans", "/pricing"];
const PASSTHROUGH_PATHS = ["/_next", "/api", "/favicon.ico", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml"];

function hostname(value: string) {
  return value.trim().toLowerCase().split(",")[0].replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
}

function rootHostname() {
  return hostname(process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost");
}

function siteSlug(request: NextRequest) {
  const host = hostname(request.headers.get("x-forwarded-host") || request.headers.get("host") || "");
  const root = rootHostname();
  if (!host || host === root || host === `www.${root}` || !host.endsWith(`.${root}`)) return null;

  const label = host.slice(0, -(root.length + 1));
  if (!label || label.includes(".") || RESERVED_HOSTS.has(label)) return null;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label) ? label : null;
}

export function proxy(request: NextRequest) {
  const slug = siteSlug(request);
  if (!slug) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (/\.[a-z0-9]{1,12}$/i.test(path)) return NextResponse.next();
  if (PASSTHROUGH_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  if (FORBIDDEN_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const destination = request.nextUrl.clone();
  if (path === "/") {
    destination.pathname = `/home/${encodeURIComponent(slug)}`;
    return NextResponse.rewrite(destination);
  }

  const segments = path.split("/").filter(Boolean);
  const collectionSlug = segments[0];
  const remainder = segments.slice(1);
  const validRemainder =
    remainder.length === 0 ||
    (remainder.length === 1 && ["favorites", "store", "checkout"].includes(remainder[0])) ||
    (remainder.length === 2 && remainder[0] === "store");

  if (!collectionSlug || !validRemainder) return new NextResponse("Not found", { status: 404 });

  destination.pathname = `/collection/${encodeURIComponent(slug)}/${encodeURIComponent(collectionSlug)}`;
  if (remainder.length) destination.pathname += `/${remainder.map(encodeURIComponent).join("/")}`;
  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: "/:path*",
};

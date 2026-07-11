function cleanHostname(value: string) {
  return value.trim().toLowerCase().split(",")[0].replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
}

export function tenantSlugFromHost(host: string | null) {
  const hostname = cleanHostname(host || "");
  const root = cleanHostname(process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost");
  if (!hostname.endsWith(`.${root}`)) return "";
  const slug = hostname.slice(0, -(root.length + 1));
  return slug && !slug.includes(".") ? slug : "";
}

export function siteSlugQuery(host: string | null) {
  const slug = tenantSlugFromHost(host);
  return slug ? `?siteSlug=${encodeURIComponent(slug)}` : "";
}

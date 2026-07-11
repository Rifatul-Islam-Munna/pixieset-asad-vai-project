export function publicSiteOrigin(siteSlug: string, fallbackOrigin = "") {
  const configuredRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  const rootDomain = configuredRoot?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!rootDomain) return fallbackOrigin;
  const protocol = configuredRoot.startsWith("http://") || fallbackOrigin.startsWith("http://") ? "http" : "https";
  return `${protocol}://${siteSlug}.${rootDomain}`;
}

export function publicCollectionUrl(siteSlug: string, collectionSlug: string, fallbackOrigin = "") {
  const configuredRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  if (!configuredRoot) return `${fallbackOrigin}/collection/${encodeURIComponent(siteSlug)}/${encodeURIComponent(collectionSlug)}`;
  const rootDomain = configuredRoot.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (/^localhost(:\d+)?$/.test(rootDomain)) return `${fallbackOrigin}/collection/${encodeURIComponent(siteSlug)}/${encodeURIComponent(collectionSlug)}`;
  return `${publicSiteOrigin(siteSlug, fallbackOrigin)}/${encodeURIComponent(collectionSlug)}`;
}

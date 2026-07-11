export function publicSiteOrigin(siteSlug: string, fallbackOrigin = "") {
  const configuredRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  const rootDomain = configuredRoot?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!rootDomain) return fallbackOrigin;
  const protocol = configuredRoot.startsWith("http://") || fallbackOrigin.startsWith("http://") ? "http" : "https";
  return `${protocol}://${siteSlug}.${rootDomain}`;
}

export function publicCollectionUrl(siteSlug: string, collectionSlug: string, fallbackOrigin = "") {
  const origin = publicSiteOrigin(siteSlug, fallbackOrigin);
  return `${origin}/${encodeURIComponent(collectionSlug)}`;
}

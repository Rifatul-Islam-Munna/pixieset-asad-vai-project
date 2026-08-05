"use client";

import { useEffect } from "react";

export function PublicGalleryViewTracker({
  identifier,
  siteSlug,
  viewToken,
}: {
  identifier: string;
  siteSlug: string;
  viewToken: string;
}) {
  useEffect(() => {
    void fetch(
      `/api/public/collections/${encodeURIComponent(identifier)}/view?siteSlug=${encodeURIComponent(siteSlug)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewToken, source: "gallery-page" }),
        cache: "no-store",
        keepalive: true,
      },
    ).catch(() => undefined);
  }, [identifier, siteSlug, viewToken]);

  return null;
}

"use client";

import { useEffect, useState } from "react";
import { mergeHomeCms, type HomeCmsData } from "@/lib/home-cms";

export function useHomeCms(initialData: HomeCmsData) {
  const [data, setData] = useState(() => mergeHomeCms(initialData));

  useEffect(() => {
    const url = "/api/home-cms";

    console.log("[Home CMS] fetching", url);
    fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        console.log("[Home CMS] response", {
          status: response.status,
          ok: response.ok,
          payload,
        });
        if (!response.ok)
          throw new Error(
            payload?.message ?? `Request failed (${response.status})`,
          );
        const cms = mergeHomeCms(payload?.data as Partial<HomeCmsData>);
        setData(cms);
        console.log(
          "[Home CMS] LIVE DATA",
          JSON.stringify(
            {
              defaultLanguage: cms.defaultLanguage,
              renderedHero: cms.content[cms.defaultLanguage]?.hero,
              enHero: cms.content.en.hero,
              grHero: cms.content.gr.hero,
            },
            null,
            2,
          ),
        );
      })
      .catch((error) =>
        console.error("[Home CMS] browser fetch failed", error),
      );
  }, []);

  return data;
}

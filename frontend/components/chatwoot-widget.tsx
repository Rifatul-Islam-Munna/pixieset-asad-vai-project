"use client";

import { useEffect } from "react";

type ChatwootWindow = Window & {
  chatwootSDK?: {
    run: (config: { websiteToken: string; baseUrl: string }) => void;
  };
};

export function ChatwootWidget() {
  useEffect(() => {
    const chatwootWindow = window as ChatwootWindow;
    const baseUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL?.trim() ||
      "https://chat-chatwoot.wrtsxa.easypanel.host";
    const websiteToken = process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN?.trim() ||
      "SpR7FXRQ4JExuVFPUjUjdwUD";

    const initialize = () =>
      chatwootWindow.chatwootSDK?.run({ websiteToken, baseUrl });

    if (chatwootWindow.chatwootSDK) {
      initialize();
      return;
    }

    if (document.getElementById("chatwoot-sdk")) return;
    const script = document.createElement("script");
    script.id = "chatwoot-sdk";
    script.src = `${baseUrl}/packs/js/sdk.js`;
    script.async = true;
    script.onload = initialize;
    document.body.appendChild(script);
  }, []);

  return null;
}

const fallbackUrl = "http://localhost:4000";

function isLocalUrl(value?: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(value?.trim() ?? "");
}

export function apiBaseUrl() {
  const serverUrl = process.env.BASE_URL?.trim();
  const publicUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (process.env.NODE_ENV === "production" && isLocalUrl(serverUrl) && publicUrl && !isLocalUrl(publicUrl)) {
    return publicUrl.replace(/\/$/, "");
  }

  return (serverUrl || publicUrl || fallbackUrl).replace(/\/$/, "");
}

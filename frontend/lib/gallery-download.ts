export function openGalleryDownloadTab() {
  const tab = window.open("about:blank", "_blank");
  if (tab) {
    tab.opener = null;
    tab.document.title = "Preparing your photo download";
    tab.document.body.textContent = "Preparing your secure download…";
  }
  return tab;
}

export function closeGalleryDownloadTab(tab: Window | null) {
  if (tab && !tab.closed) tab.close();
}

export function startGalleryDownload(url: string | undefined, reservedTab?: Window | null) {
  if (!url) {
    closeGalleryDownloadTab(reservedTab ?? null);
    throw new Error("Download link is missing. Please try again.");
  }
  if (reservedTab && !reservedTab.closed) {
    reservedTab.location.replace(url);
    return;
  }
  const tab = window.open(url, "_blank");
  if (tab) {
    tab.opener = null;
    return;
  }
  // Popup blockers can reject the new tab after a slow API response. Keep the
  // download usable rather than silently failing; the browser back button
  // returns the client to the gallery.
  window.location.assign(url);
}

export function galleryDownloadNotice(emailStatus: unknown) {
  if (emailStatus === "sent") return "Your download page is ready. The same secure link was sent to your email.";
  if (emailStatus === "failed") return "Your download page is ready. Email delivery failed; we will retry. Keep this page open.";
  return "Your download page is ready. The same secure link is queued for email.";
}

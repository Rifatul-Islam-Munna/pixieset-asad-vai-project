export function startGalleryDownload(url: string | undefined) {
  if (!url) throw new Error("Download link is missing. Please try again.");
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.referrerPolicy = "no-referrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function galleryDownloadNotice(emailStatus: unknown) {
  if (emailStatus === "sent") return "Download started. The same link was sent to your email. Link expires in 24 hours.";
  if (emailStatus === "failed") return "Download started. Email delivery failed; we will retry. Keep this download link, valid for 24 hours.";
  return "Download started. The same link is queued for email. Link expires in 24 hours.";
}

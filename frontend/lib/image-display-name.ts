type ImageDisplayLike = {
  originalName?: unknown;
  metadata?: unknown;
};

function displayText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function imageDisplayName(image?: ImageDisplayLike | null, fallback = "Photo") {
  const metadata = image?.metadata && typeof image.metadata === "object"
    ? image.metadata as Record<string, unknown>
    : {};
  return (
    displayText(metadata.fileTitle) ||
    displayText(metadata.title) ||
    displayText(image?.originalName) ||
    displayText(metadata.filename) ||
    fallback
  );
}

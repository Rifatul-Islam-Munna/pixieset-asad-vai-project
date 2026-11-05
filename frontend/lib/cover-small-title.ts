/** Use the account studio name unless the owner explicitly customised the cover label. */
const legacyPlaceholders = new Set(["Avery Studio", "Your Studio"]);

export function resolveCoverSmallTitle(value: unknown, studioName: unknown): string {
  const existing = typeof value === "string" ? value.trim() : "";
  const fallback = (typeof studioName === "string" ? studioName.trim() : "") || "Your Studio";
  return !existing || legacyPlaceholders.has(existing) ? fallback : existing;
}

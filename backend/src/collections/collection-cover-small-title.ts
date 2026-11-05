/** Distinguish legacy default text from a cover label the photographer chose. */
const placeholders = new Set(['Avery Studio', 'Your Studio']);

export function needsStudioCoverTitle(value: unknown): boolean {
  const text = typeof value === 'string' ? value.trim() : '';
  return !text || placeholders.has(text);
}

export function applyStudioCoverTitle(
  design: Record<string, unknown> | undefined,
  studioName: string,
): Record<string, unknown> {
  const next = { ...(design ?? {}) };
  if (needsStudioCoverTitle(next.coverSmallTitle)) {
    next.coverSmallTitle = studioName.trim() || 'Your Studio';
  }
  return next;
}

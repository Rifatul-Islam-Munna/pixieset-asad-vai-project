import type { CSSProperties } from "react";

export function coverFocalStyle(
  x?: number,
  y?: number,
): CSSProperties {
  const percentage = (value: number | undefined) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 50;
  };

  return { objectPosition: `${percentage(x)}% ${percentage(y)}%` };
}

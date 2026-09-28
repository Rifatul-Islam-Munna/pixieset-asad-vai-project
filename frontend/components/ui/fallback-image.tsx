"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";

type FallbackImageProps = Omit<ComponentPropsWithoutRef<"img">, "src"> & {
  src?: string;
  fallbackSrc?: string;
  fallbackSources?: Array<string | null | undefined>;
};

export const FallbackImage = forwardRef<HTMLImageElement, FallbackImageProps>(
  function FallbackImage(
    { src, fallbackSrc, fallbackSources, srcSet, sizes, onError, ...props },
    ref,
  ) {
    const candidates = useMemo(
      () =>
        Array.from(
          new Set(
            [src, fallbackSrc, ...(fallbackSources ?? [])]
              .map((value) => String(value ?? "").trim())
              .filter(Boolean),
          ),
        ),
      [fallbackSources, fallbackSrc, src],
    );
    const signature = `${candidates.join("\u0000")}\u0001${srcSet ?? ""}`;
    const [sourceState, setSourceState] = useState({
      signature,
      index: 0,
      useSrcSet: Boolean(srcSet),
    });
    const activeState =
      sourceState.signature === signature
        ? sourceState
        : { signature, index: 0, useSrcSet: Boolean(srcSet) };

    useEffect(() => {
      setSourceState((current) =>
        current.signature === signature
          ? current
          : { signature, index: 0, useSrcSet: Boolean(srcSet) },
      );
    }, [signature, srcSet]);

    return (
      <img
        {...props}
        ref={ref}
        src={candidates[activeState.index]}
        srcSet={activeState.useSrcSet ? srcSet : undefined}
        sizes={activeState.useSrcSet ? sizes : undefined}
        onError={(event) => {
          onError?.(event);
          if (event.defaultPrevented) return;
          if (activeState.useSrcSet && srcSet) {
            setSourceState({ ...activeState, useSrcSet: false });
            return;
          }
          if (activeState.index + 1 < candidates.length) {
            setSourceState({
              signature,
              index: activeState.index + 1,
              useSrcSet: false,
            });
          }
        }}
      />
    );
  },
);

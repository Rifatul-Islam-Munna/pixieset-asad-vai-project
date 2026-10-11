"use client";

/* Image URLs are already resized and watermarked by Imagor; an extra Next image proxy would duplicate processing. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { ImageWatermarkOverlay, type ImageWatermark } from "@/components/ui/image-watermark-overlay";
import { cn } from "@/lib/utils";

type PhotoPreviewProps = {
  src: string;
  previewSrc?: string;
  fallbackSrc?: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  width?: number;
  height?: number;
  placeholder?: string;
  watermark?: ImageWatermark;
  previewWatermarked?: boolean;
  fallbackWatermarked?: boolean;
  priority?: boolean;
  theme?: "dark" | "light";
  className?: string;
};

/**
 * Keep a lightweight thumbnail visible while the full-size photo loads and
 * decodes. Never replace an in-flight full-size request with a thumbnail.
 * Both layers share a fixed, contain-fitted frame so the viewer cannot jump.
 */
export function ProgressivePhotoPreview({
  src,
  previewSrc,
  fallbackSrc,
  srcSet,
  sizes,
  alt,
  width,
  height,
  placeholder,
  watermark,
  previewWatermarked = true,
  fallbackWatermarked = false,
  priority = true,
  theme = "dark",
  className,
}: PhotoPreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [mainSrc, setMainSrc] = useState(src);
  const [withSrcSet, setWithSrcSet] = useState(Boolean(srcSet));
  const [fallbackActive, setFallbackActive] = useState(false);
  const [mainLoaded, setMainLoaded] = useState(false);
  const [mainFailed, setMainFailed] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  // A legacy fallback URL can point to a huge original; fetch it only after a real load error.
  const thumbnail = previewSrc && previewSrc !== src ? previewSrc : "";
  const thumbnailWatermarked = previewWatermarked;

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const update = () => {
      const next = { width: node.clientWidth, height: node.clientHeight };
      setFrame((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mainLoaded || previewLoaded) return;
    const timer = window.setTimeout(() => setShowLoading(true), 400);
    return () => window.clearTimeout(timer);
  }, [mainLoaded, previewLoaded]);

  const validWidth = Number(width) > 0 ? Number(width) : naturalSize.width;
  const validHeight = Number(height) > 0 ? Number(height) : naturalSize.height;
  const fitScale = validWidth > 0 && validHeight > 0 && frame.width > 0 && frame.height > 0
    ? Math.min(frame.width / validWidth, frame.height / validHeight)
    : 0;
  const mediaStyle: CSSProperties = fitScale > 0
    ? { width: Math.max(1, validWidth * fitScale), height: Math.max(1, validHeight * fitScale) }
    : { width: "100%", height: "100%" };
  const showThumbnail = Boolean(thumbnail && !mainLoaded);
  const showWatermarkOnThumbnail =
    Boolean(watermark && previewLoaded && showThumbnail && !thumbnailWatermarked);
  const showWatermarkOnFallback =
    Boolean(watermark && fallbackActive && mainLoaded && !fallbackWatermarked);
  const isDark = theme === "dark";

  const rememberSize = (image: HTMLImageElement) => {
    if (Number(width) > 0 && Number(height) > 0) return;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      setNaturalSize((previous) =>
        previous.width === image.naturalWidth && previous.height === image.naturalHeight
          ? previous
          : { width: image.naturalWidth, height: image.naturalHeight },
      );
    }
  };

  const retry = () => {
    setMainLoaded(false);
    setMainFailed(false);
    setFallbackActive(false);
    setWithSrcSet(Boolean(srcSet));
    // Restart the request without scheduling state changes after unmount.
    setMainSrc(src);
    setRetryAttempt((attempt) => attempt + 1);
  };

  return (
    <div
      ref={frameRef}
      className={cn(
        "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden",
        isDark ? "bg-black text-white" : "bg-[#f3f3f1] text-[#333]",
        className,
      )}
      aria-busy={!mainLoaded && !mainFailed}
    >
      <div className="relative flex shrink-0 items-center justify-center overflow-hidden" style={mediaStyle}>
        {placeholder && !previewLoaded && !mainLoaded && (
          <img
            src={placeholder}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full scale-[1.06] object-contain opacity-70 blur-xl"
          />
        )}
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            fetchPriority="auto"
            onLoad={(event) => {
              rememberSize(event.currentTarget);
              setPreviewLoaded(true);
            }}
            onError={() => setPreviewLoaded(false)}
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full select-none object-contain transition-[opacity,filter] duration-500 ease-out motion-reduce:transition-none",
              mainLoaded ? "opacity-0" : previewLoaded ? "opacity-100 blur-[1.5px]" : "opacity-0",
            )}
            draggable={false}
          />
        )}
        {showWatermarkOnThumbnail && <ImageWatermarkOverlay watermark={watermark} />}
        {mainSrc && (
          <img
            key={`${mainSrc}|${withSrcSet ? "responsive" : "single"}|${retryAttempt}`}
            ref={mainRef}
            src={mainSrc}
            srcSet={withSrcSet && mainSrc === src ? srcSet : undefined}
            sizes={withSrcSet && mainSrc === src ? sizes : undefined}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onLoad={(event) => {
              const image = event.currentTarget;
              rememberSize(image);
              const reveal = () => {
                if (mainRef.current === image && image.naturalWidth > 0) {
                  setMainLoaded(true);
                  setMainFailed(false);
                }
              };
              void image.decode().then(reveal, reveal);
            }}
            onError={() => {
              setMainLoaded(false);
              if (withSrcSet && srcSet && mainSrc === src) {
                setWithSrcSet(false);
              } else if (fallbackSrc && mainSrc !== fallbackSrc) {
                setFallbackActive(true);
                setMainSrc(fallbackSrc);
              } else {
                setMainFailed(true);
              }
            }}
            className={cn(
              "absolute inset-0 h-full w-full select-none object-contain transition-[opacity,filter] duration-500 ease-out motion-reduce:transition-none",
              mainLoaded ? "opacity-100 blur-0" : "opacity-0 blur-[3px]",
            )}
            draggable={false}
          />
        )}
        {showWatermarkOnFallback && <ImageWatermarkOverlay watermark={watermark} />}
      </div>
      {showLoading && !mainFailed && !mainLoaded && !previewLoaded && (
        <span className={cn(
          "pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-2 text-xs backdrop-blur-sm",
          isDark ? "bg-black/50 text-white/80" : "bg-white/80 text-[#555]",
        )} role="status" aria-label="Loading photo">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading photo
        </span>
      )}
      {mainFailed && (
        <div className={cn(
          "absolute bottom-5 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-xs shadow-lg backdrop-blur-sm",
          isDark ? "bg-black/75 text-white" : "bg-white/90 text-[#333]",
        )} role="status">
          <span>{previewLoaded ? "Full-size photo unavailable" : "Photo could not be loaded"}</span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold underline-offset-2 hover:underline"
          >
            <RotateCcw className="size-3.5" /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

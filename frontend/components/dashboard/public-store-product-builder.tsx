"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Check, ChevronDown, ImageIcon, Minus, Plus, RotateCcw, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  createCartItemId,
  defaultVariant,
  formatMoney,
  publicImageSrc,
  stripHtml,
  type PublicStoreCartItem,
  type PublicStoreImage,
  type PublicStoreProduct,
  type StoreCrop,
  visibleVariants,
} from "@/lib/public-store";
import { cn } from "@/lib/utils";

type BuilderStep = "product" | "photos" | "crop";

export function PublicStoreProductBuilder({
  open,
  product,
  images,
  currency,
  allowBulkBuy,
  initialImageId,
  onClose,
  onAdd,
}: {
  open: boolean;
  product: PublicStoreProduct | null;
  images: PublicStoreImage[];
  currency: string;
  allowBulkBuy: boolean;
  initialImageId?: string;
  onClose: () => void;
  onAdd: (items: PublicStoreCartItem[]) => void;
}) {
  const variants = useMemo(() => product ? visibleVariants(product) : [], [product]);
  const [step, setStep] = useState<BuilderStep>("product");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [activeCropImageId, setActiveCropImageId] = useState("");
  const [crop, setCrop] = useState<StoreCrop>(defaultCrop("4:3"));
  const [cropsByImageId, setCropsByImageId] = useState<Record<string, StoreCrop>>({});
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    if (!open || !product) return;
    const initialVariant = defaultVariant(product);
    setStep("product");
    setVariantId(initialVariant?.id ?? "");
    setQuantity(1);
    setSelectedImageIds(initialImageId ? [initialImageId] : []);
    setActiveCropImageId(initialImageId ?? "");
    setCrop(defaultCrop(aspectLabel(initialVariant?.label)));
    setCropsByImageId({});
  }, [initialImageId, open, product]);

  if (!open || !product) return null;

  const selectedVariant = variants.find((variant) => variant.id === variantId) ?? variants[0];
  const requiresPhoto = product.requiresPhoto !== false && !product.noImageRequired;
  const canBulkSelect = Boolean(allowBulkBuy && product.allowBulkPurchase);
  const selectedImages = selectedImageIds
    .map((id) => images.find((image) => image._id === id))
    .filter(Boolean) as PublicStoreImage[];
  const activeCropImage = images.find((image) => image._id === activeCropImageId) ?? selectedImages[0];
  const buyPhotoMode = Boolean(initialImageId && selectedImages.length);
  const price = Number(selectedVariant?.price ?? product.price ?? 0);
  const activeCropIndex = Math.max(0, selectedImages.findIndex((image) => image._id === activeCropImageId));

  const choosePhoto = (imageId: string) => {
    if (!canBulkSelect) {
      setSelectedImageIds([imageId]);
      setActiveCropImageId(imageId);
      return;
    }
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId],
    );
    setActiveCropImageId(imageId);
  };

  const startAdd = () => {
    if (variants.length && !selectedVariant) {
      toast.error("Choose a product size or variation");
      return;
    }
    if (!requiresPhoto) {
      completeAdd([]);
      return;
    }
    if (selectedImages.length) {
      if (product.allowCrop !== false) {
        setActiveCropImageId(selectedImages[0]._id);
        setCrop(cropsByImageId[selectedImages[0]._id] ?? defaultCrop(aspectLabel(selectedVariant?.label)));
        setStep("crop");
        return;
      }
      completeAdd(selectedImages);
      return;
    }
    if (!images.length) {
      toast.error("This collection has no photos available for this product");
      return;
    }
    setStep("photos");
  };

  const continueFromPhotos = () => {
    if (!selectedImages.length) {
      toast.error("Choose at least one photo");
      return;
    }
    if (product.allowCrop !== false) {
      setActiveCropImageId(selectedImages[0]._id);
      setCrop(cropsByImageId[selectedImages[0]._id] ?? defaultCrop(aspectLabel(selectedVariant?.label)));
      setStep("crop");
      return;
    }
    completeAdd(selectedImages);
  };

  const completeAdd = (chosen: PublicStoreImage[], customCrop?: StoreCrop, customCropsByImageId?: Record<string, StoreCrop>) => {
    const targets = requiresPhoto ? chosen : [undefined];
    const items = targets.map((image) => ({
      id: createCartItemId(product, selectedVariant, image),
      product,
      variant: selectedVariant,
      image,
      crop: image && product.allowCrop !== false
        ? customCropsByImageId?.[image._id] ?? customCrop ?? defaultCrop(aspectLabel(selectedVariant?.label))
        : undefined,
      quantity: product.limitOnePerCheckout ? 1 : Math.max(1, quantity),
    }));
    onAdd(items);
    onClose();
  };
  const saveActiveCrop = () => {
    if (!activeCropImage) return cropsByImageId;
    const next = { ...cropsByImageId, [activeCropImage._id]: crop };
    setCropsByImageId(next);
    return next;
  };
  const nextCropPhoto = () => {
    const next = saveActiveCrop();
    const nextImage = selectedImages[activeCropIndex + 1];
    if (!nextImage) return completeAdd(selectedImages, undefined, next);
    setActiveCropImageId(nextImage._id);
    setCrop(next[nextImage._id] ?? defaultCrop(aspectLabel(selectedVariant?.label)));
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/65 p-0 md:p-5" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-h-[960px] w-full max-w-[1180px] flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8c8c8c]">
              {step === "product"
                ? buyPhotoMode ? "Buy This Photo" : product.category || "Product"
                : step === "photos" ? "Choose photos" : "Adjust crop"}
            </p>
            <p className="truncate text-base font-medium">{product.name}</p>
          </div>
          <button className="flex size-10 items-center justify-center" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {step === "product" && (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.15fr)_minmax(390px,0.85fr)]">
            <ProductPreview product={product} selectedImage={buyPhotoMode ? selectedImages[0] : undefined} />
            <div className="p-5 sm:p-6 md:p-10">
              <h2 className="break-words text-2xl font-normal tracking-tight sm:text-3xl">{product.name}</h2>
              <p className="mt-3 text-lg">From {formatMoney(price, currency)}</p>
              {product.description && (
                <p className="mt-6 text-sm leading-7 text-[#565656]">{stripHtml(product.description)}</p>
              )}

              {variants.length > 0 && (
                <div className="mt-8">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#777]">Size / option</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setVariantId(variant.id);
                          setCrop(defaultCrop(aspectLabel(variant.label)));
                        }}
                        className={cn(
                          "flex min-h-12 items-center justify-between border px-4 py-3 text-left text-sm transition",
                          selectedVariant?.id === variant.id
                            ? "border-[#222] bg-[#f7f7f5]"
                            : "border-[#dedede] hover:border-[#8b8b8b]",
                        )}
                      >
                        <span>{variant.label}</span>
                        <span className="ml-3 whitespace-nowrap text-[#666]">{formatMoney(variant.price, currency)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!product.limitOnePerCheckout && (
                <div className="mt-8">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#777]">Quantity</p>
                  <div className="inline-flex h-12 items-center border">
                    <button className="flex size-12 items-center justify-center" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                      <Minus className="size-4" />
                    </button>
                    <span className="w-12 text-center text-sm">{quantity}</span>
                    <button className="flex size-12 items-center justify-center" onClick={() => setQuantity((value) => Math.min(99, value + 1))}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              )}

              <button
                className="mt-9 h-12 w-full bg-[#2f2f2f] px-6 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-45"
                disabled={variants.length > 0 && !selectedVariant}
                onClick={startAdd}
              >
                {buyPhotoMode
                  ? product.allowCrop !== false ? "Adjust Photo" : "Add to Cart"
                  : requiresPhoto ? "Choose Photo" : "Add to Cart"}
              </button>

              <div className="mt-9 border-t">
                <button
                  className="flex w-full items-center justify-between py-5 text-left text-sm font-medium"
                  onClick={() => setInfoOpen((value) => !value)}
                >
                  Product info
                  <ChevronDown className={cn("size-4 transition-transform", infoOpen && "rotate-180")} />
                </button>
                {infoOpen && (
                  <div className="pb-6 text-sm leading-7 text-[#555]">
                    <p>{stripHtml(product.productInfo) || stripHtml(product.description) || "Professional photo product made for this collection."}</p>
                    {product.productionNote && <p className="mt-3">{stripHtml(product.productionNote)}</p>}
                    {product.downloadSize && <p className="mt-3">Delivery: {product.downloadSize}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "photos" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 md:px-8">
              <div>
                <p className="text-sm font-medium">Select {canBulkSelect ? "one or more photos" : "one photo"}</p>
                <p className="mt-1 text-xs text-[#777]">{selectedImageIds.length} selected</p>
              </div>
              <div className="flex shrink-0 gap-2 sm:gap-3">
                <button className="h-10 border px-4 text-sm sm:px-5" onClick={() => setStep("product")}>Back</button>
                <button className="h-10 bg-[#2f2f2f] px-4 text-sm font-semibold text-white disabled:opacity-40 sm:px-6" disabled={!selectedImageIds.length} onClick={continueFromPhotos}>
                  Continue
                </button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {images.map((image) => {
                const selected = selectedImageIds.includes(image._id);
                return (
                  <button
                    key={image._id}
                    type="button"
                    className={cn("group relative aspect-square overflow-hidden bg-[#eee]", selected && "ring-2 ring-[#27b9a4] ring-offset-2")}
                    onClick={() => choosePhoto(image._id)}
                  >
                    <img src={publicImageSrc(image.thumbnailUrl || image.url)} alt={image.originalName || "Collection photo"} className="h-full w-full object-cover" />
                    <span className={cn("absolute right-2 top-2 flex size-7 items-center justify-center rounded-full border bg-white/95", selected ? "border-[#27b9a4] bg-[#27b9a4] text-white" : "border-white text-transparent") }>
                      <Check className="size-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "crop" && activeCropImage && (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_390px]">
            <div className="flex min-h-[320px] flex-col items-center justify-center bg-[#ececea] p-4 sm:min-h-[420px] sm:p-8">
              <CropCanvas crop={crop} imageUrl={activeCropImage.url} alt="Crop preview" onChange={setCrop} />
              {selectedImages.length > 1 && (
                <div className="mt-4 flex max-w-[720px] gap-2 overflow-x-auto">
                  {selectedImages.map((image, index) => (
                    <button key={image._id} className={cn("size-14 shrink-0 border bg-white p-1", image._id === activeCropImage._id && "border-[#222]")} onClick={() => {
                      const next = saveActiveCrop();
                      setActiveCropImageId(image._id);
                      setCrop(next[image._id] ?? defaultCrop(aspectLabel(selectedVariant?.label)));
                    }}>
                      <img src={publicImageSrc(image.thumbnailUrl || image.url)} alt="" className="h-full w-full object-cover" />
                      <span className="sr-only">Photo {index + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 sm:p-7 md:p-9">
              <h3 className="text-2xl font-normal">Adjust your photo</h3>
              <p className="mt-3 text-sm leading-6 text-[#666]">Whole photo shows first. Drag directly, zoom in or out, rotate, then save.</p>
              {selectedImages.length > 1 && <p className="mt-2 text-xs font-semibold text-[#777]">Photo {activeCropIndex + 1} of {selectedImages.length}</p>}
              <CropSlider label="Horizontal" min={-100} max={100} step={1} value={crop.x} onChange={(x) => setCrop((value) => ({ ...value, x }))} />
              <CropSlider label="Vertical" min={-100} max={100} step={1} value={crop.y} onChange={(y) => setCrop((value) => ({ ...value, y }))} />
              <CropSlider label="Zoom" min={0.2} max={4} step={0.05} value={crop.zoom} onChange={(zoom) => setCrop((value) => ({ ...value, zoom }))} />
              <div className="mt-7">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#777]">Rotation</p>
                <div className="flex gap-2">
                  <button className="flex h-11 flex-1 items-center justify-center gap-2 border text-sm" onClick={() => setCrop((value) => ({ ...value, rotation: value.rotation - 90 }))}>
                    <RotateCcw className="size-4" /> Left
                  </button>
                  <button className="flex h-11 flex-1 items-center justify-center gap-2 border text-sm" onClick={() => setCrop((value) => ({ ...value, rotation: value.rotation + 90 }))}>
                    <RotateCw className="size-4" /> Right
                  </button>
                </div>
              </div>
              <div className="mt-9 flex gap-3">
                <button className="h-12 flex-1 border text-sm" onClick={() => setStep("product")}>Back</button>
                <button className="h-12 flex-[1.4] bg-[#2f2f2f] text-sm font-semibold text-white" onClick={nextCropPhoto}>
                  {selectedImages.length > 1 && activeCropIndex < selectedImages.length - 1 ? "Next Photo" : "Add to Cart"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductPreview({
  product,
  selectedImage,
}: {
  product: PublicStoreProduct;
  selectedImage?: PublicStoreImage;
}) {
  const previews = selectedImage
    ? [selectedImage.url]
    : product.previewImages?.length ? product.previewImages : product.images ?? [];
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [product._id, selectedImage?._id]);
  return (
    <div className="flex min-h-[320px] flex-col bg-[#f3f3f2] p-5 sm:min-h-[420px] sm:p-6 md:p-10">
      <div className="flex min-h-[260px] flex-1 items-center justify-center sm:min-h-[380px]">
        {previews[active] ? (
          <img src={publicImageSrc(previews[active])} alt={selectedImage?.originalName || product.name} className="max-h-[680px] w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center text-[#8b8b8b]"><ImageIcon className="size-10" /><span className="mt-3 text-sm">Product preview</span></div>
        )}
      </div>
      {previews.length > 1 && (
        <div className="mt-5 flex justify-center gap-2 overflow-x-auto">
          {previews.map((image, index) => (
            <button key={`${image}-${index}`} className={cn("size-16 shrink-0 border bg-white p-1", active === index && "border-[#222]")} onClick={() => setActive(index)}>
              <img src={publicImageSrc(image)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CropSlider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="mt-7 block">
      <span className="flex items-center justify-between text-xs font-medium"><span>{label}</span><span className="text-[#777]">{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-[#2f2f2f]" />
    </label>
  );
}

function CropCanvas({
  crop,
  imageUrl,
  alt,
  onChange,
}: {
  crop: StoreCrop;
  imageUrl?: string;
  alt: string;
  onChange: (crop: StoreCrop) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; cropX: number; cropY: number } | null>(null);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    const rect = frame.getBoundingClientRect();
    const dx = ((event.clientX - drag.x) / rect.width) * 100;
    const dy = ((event.clientY - drag.y) / rect.height) * 100;
    onChange({ ...crop, x: clamp(drag.cropX + dx, -100, 100), y: clamp(drag.cropY + dy, -100, 100) });
  };

  return (
    <div
      ref={frameRef}
      className="relative w-full max-w-[720px] touch-none overflow-hidden bg-white shadow-xl"
      style={{ aspectRatio: cropAspectNumber(crop.aspectRatio) }}
      onPointerDown={(event) => {
        dragRef.current = { x: event.clientX, y: event.clientY, cropX: crop.x, cropY: crop.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <img
        src={publicImageSrc(imageUrl)}
        alt={alt}
        className="absolute left-1/2 top-1/2 h-full w-full max-w-none cursor-grab object-contain active:cursor-grabbing"
        draggable={false}
        style={{ transform: `translate(calc(-50% + ${crop.x}%), calc(-50% + ${crop.y}%)) scale(${crop.zoom}) rotate(${crop.rotation}deg)` }}
      />
      <div className="pointer-events-none absolute inset-0 border border-white/70 shadow-[inset_0_0_0_999px_rgba(0,0,0,0.04)]" />
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function aspectLabel(label?: string) {
  const match = String(label ?? "").match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  return match ? `${match[1]}:${match[2]}` : "4:3";
}

function cropAspectNumber(value: string) {
  const [width, height] = value.split(":").map(Number);
  return width > 0 && height > 0 ? width / height : 4 / 3;
}

function defaultCrop(aspectRatio: string): StoreCrop {
  return { x: 0, y: 0, width: 100, height: 100, zoom: 1, rotation: 0, aspectRatio, fit: "contain" };
}

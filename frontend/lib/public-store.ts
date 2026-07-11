export type PublicStoreVariant = {
  id: string;
  label: string;
  options: Record<string, string>;
  price: number;
  extraShipping?: number;
  hidden?: boolean;
  sortOrder?: number;
  isDefault?: boolean;
};

export type PublicStoreProduct = {
  _id: string;
  slug: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
  description?: string;
  productInfo?: string;
  productionNote?: string;
  price: number;
  extraShipping?: number;
  category?: string;
  type: "digital-download" | "self-fulfilled";
  images?: string[];
  previewImages?: string[];
  requiresPhoto?: boolean;
  allowCrop?: boolean;
  allowBulkPurchase?: boolean;
  noImageRequired?: boolean;
  limitOnePerCheckout?: boolean;
  downloadType?: "single-photo" | "all-photos";
  downloadSize?: string;
  options?: { name: string; values: string[] }[];
  variants?: PublicStoreVariant[];
};

export type PublicStoreImage = {
  _id: string;
  setId?: string;
  url: string;
  thumbnailUrl?: string;
  blurDataUrl?: string;
  mediaType?: "image" | "video";
  mimetype?: string;
  originalName?: string;
  metadata?: Record<string, unknown>;
};

export type PublicStoreData = {
  collection?: {
    _id?: string;
    name?: string;
    slug?: string;
    studioName?: string;
    coverImage?: string;
    sets?: Array<{ id: string; name: string }>;
    images?: PublicStoreImage[];
  };
  store?: {
    enabled?: boolean;
    priceSheetId?: string;
    showPrintStoreNav?: boolean;
    showBuyPhotoButton?: boolean;
    allowBulkBuy?: boolean;
    minimumOrderAmount?: number;
    requireProfessionalInfo?: boolean;
    currency?: string;
    canCheckout?: boolean;
    checkoutMessage?: string;
    paymentMethods?: {
      stripe?: { enabled?: boolean; publishableKey?: string };
    };
  };
  priceSheet?: { _id?: string; name?: string; minimumOrderAmount?: number };
  products?: PublicStoreProduct[];
  shipping?: Array<{
    _id: string;
    name: string;
    region?: string;
    price: number;
    freeOver?: number;
    shipInternational?: boolean;
  }>;
  coupons?: Array<{
    code: string;
    name: string;
    discountType: "percent" | "fixed";
    amount: number;
  }>;
  marketing?: {
    optIn?: {
      storeCheckout?: boolean;
    };
  };
};

export type StoreCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  rotation: number;
  aspectRatio: string;
  fit?: "contain" | "cover";
};

export type PublicStoreCartItem = {
  id: string;
  product: PublicStoreProduct;
  variant?: PublicStoreVariant;
  image?: PublicStoreImage;
  crop?: StoreCrop;
  quantity: number;
};

export const STORE_CATEGORY_ORDER = ["Prints", "Wall Art", "Digital Downloads"];

export function visibleVariants(product: PublicStoreProduct) {
  return (product.variants ?? [])
    .filter((variant) => !variant.hidden)
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
}

export function defaultVariant(product: PublicStoreProduct) {
  const variants = visibleVariants(product);
  return variants.find((variant) => variant.isDefault) ?? variants[0];
}

export function displayPrice(product: PublicStoreProduct) {
  const prices = visibleVariants(product).map((variant) => Number(variant.price));
  return prices.length ? Math.min(...prices) : Number(product.price ?? 0);
}

export function cartItemPrice(item: PublicStoreCartItem) {
  return Number(item.variant?.price ?? item.product.price ?? 0);
}

export function createCartItemId(
  product: PublicStoreProduct,
  variant?: PublicStoreVariant,
  image?: PublicStoreImage,
) {
  return [product._id, variant?.id ?? "base", image?._id ?? "gallery"].join(":");
}

export function storeCartKey(collectionId?: string) {
  return `pixieset-store-cart:${collectionId || "unknown"}`;
}

export function formatMoney(value: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
}

export function publicImageSrc(url?: string) {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return url.startsWith("/") ? `${base}${url}` : url;
}

export function stripHtml(value?: string) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

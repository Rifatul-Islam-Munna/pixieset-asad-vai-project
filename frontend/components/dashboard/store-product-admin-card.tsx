"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, EyeOff, Save } from "lucide-react";
import { publicImageSrc, type PublicStoreProduct } from "@/lib/public-store";

export function StoreProductAdminCard({
  product,
  saving,
  onSave,
  onDelete,
}: {
  product: PublicStoreProduct;
  saving?: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(product));
  const [variants, setVariants] = useState(() =>
    JSON.stringify(product.variants ?? [], null, 2),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(createDraft(product));
    setVariants(JSON.stringify(product.variants ?? [], null, 2));
    setError("");
  }, [product]);

  const save = async () => {
    setError("");
    try {
      const parsed = JSON.parse(variants);
      if (!Array.isArray(parsed)) throw new Error("Variants must be an array");
      await onSave({
        ...draft,
        price: Number(draft.price || 0),
        extraShipping: Number(draft.extraShipping || 0),
        sortOrder: Number(draft.sortOrder || 0),
        images: draft.images.filter(Boolean),
        previewImages: draft.previewImages.filter(Boolean),
        variants: parsed,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save product.");
    }
  };

  const preview = draft.previewImages[0] || draft.images[0];

  return (
    <article className="border bg-white">
      <div className="grid gap-5 p-5 md:grid-cols-[112px_1fr_auto] md:items-center">
        <div className="aspect-square overflow-hidden bg-[#f1f1ef]">
          {preview && (
            <img
              src={publicImageSrc(preview)}
              alt={draft.name}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{draft.name}</h3>
            <span className="rounded-full bg-[#f0f0ee] px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
              {draft.category}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
                draft.active
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {draft.active ? "Active" : "Hidden"}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#666]">
            From €{Number(draft.price || 0).toFixed(2)}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#888]">
            {draft.description || "No product description"}
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm"
          onClick={() => setExpanded((value) => !value)}
        >
          Edit
          {expanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t bg-[#fafafa] p-5 md:p-7">
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Product name">
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, name: event.target.value }))
                }
              />
            </Field>
            <Field label="Category">
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    category: event.target.value,
                  }))
                }
              >
                <option value="Prints">Prints</option>
                <option value="Wall Art">Wall Art</option>
                <option value="Digital Downloads">Digital Downloads</option>
              </select>
            </Field>
            <Field label="Base price">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, price: event.target.value }))
                }
              />
            </Field>
            <Field label="Extra shipping">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.extraShipping}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    extraShipping: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    sortOrder: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Slug">
              <input
                value={draft.slug}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, slug: event.target.value }))
                }
              />
            </Field>
            <Field label="Default preview image URL" wide>
              <input
                value={draft.previewImages[0] ?? ""}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    previewImages: event.target.value
                      ? [event.target.value]
                      : [],
                  }))
                }
              />
            </Field>
            <Field label="Description" wide>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Product info" wide>
              <textarea
                value={draft.productInfo}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    productInfo: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Production / delivery note" wide>
              <textarea
                value={draft.productionNote}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    productionNote: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Variants JSON" wide>
              <textarea
                className="min-h-52 font-mono text-xs"
                value={variants}
                onChange={(event) => setVariants(event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Check
              label="Active"
              checked={draft.active}
              onChange={(active) =>
                setDraft((value) => ({ ...value, active }))
              }
            />
            <Check
              label="Requires photo"
              checked={draft.requiresPhoto}
              onChange={(requiresPhoto) =>
                setDraft((value) => ({ ...value, requiresPhoto }))
              }
            />
            <Check
              label="Allow crop"
              checked={draft.allowCrop}
              onChange={(allowCrop) =>
                setDraft((value) => ({ ...value, allowCrop }))
              }
            />
            <Check
              label="Allow bulk purchase"
              checked={draft.allowBulkPurchase}
              onChange={(allowBulkPurchase) =>
                setDraft((value) => ({ ...value, allowBulkPurchase }))
              }
            />
            <Check
              label="No photo required"
              checked={draft.noImageRequired}
              onChange={(noImageRequired) =>
                setDraft((value) => ({ ...value, noImageRequired }))
              }
            />
            <Check
              label="Limit one per checkout"
              checked={draft.limitOnePerCheckout}
              onChange={(limitOnePerCheckout) =>
                setDraft((value) => ({ ...value, limitOnePerCheckout }))
              }
            />
          </div>

          {error && (
            <p className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-wrap justify-between gap-3 border-t pt-6">
            <button
              className="inline-flex h-11 items-center gap-2 border border-red-200 px-5 text-sm text-red-700"
              onClick={() => void onDelete()}
              disabled={saving}
            >
              <EyeOff className="size-4" />
              Hide product
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 bg-[#303030] px-6 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void save()}
              disabled={saving}
            >
              <Save className="size-4" />
              {saving ? "Saving..." : "Save product"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function createDraft(product: PublicStoreProduct) {
  return {
    name: product.name ?? "",
    slug: product.slug ?? "",
    active: product.active !== false,
    sortOrder: String(product.sortOrder ?? 0),
    description: product.description ?? "",
    productInfo: product.productInfo ?? "",
    productionNote: product.productionNote ?? "",
    price: String(product.price ?? 0),
    extraShipping: String(product.extraShipping ?? 0),
    category: product.category ?? "Prints",
    images: [...(product.images ?? [])],
    previewImages: [...(product.previewImages ?? product.images ?? [])],
    requiresPhoto: product.requiresPhoto !== false,
    allowCrop: product.allowCrop !== false,
    allowBulkPurchase: Boolean(product.allowBulkPurchase),
    noImageRequired: Boolean(product.noImageRequired),
    limitOnePerCheckout: Boolean(product.limitOnePerCheckout),
  };
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactElement;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "lg:col-span-2" : ""}>
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[#777]">
        {label}
      </span>
      <div className="[&_input]:h-11 [&_input]:w-full [&_input]:border [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_select]:h-11 [&_select]:w-full [&_select]:border [&_select]:bg-white [&_select]:px-3 [&_textarea]:min-h-28 [&_textarea]:w-full [&_textarea]:border [&_textarea]:bg-white [&_textarea]:p-3 [&_textarea]:text-sm">
        {children}
      </div>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

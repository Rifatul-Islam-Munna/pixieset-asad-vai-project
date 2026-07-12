"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useCollectionStoreAdmin } from "@/api-hooks/use-collection-store-admin";
import { useStorePriceSheets } from "@/api-hooks/use-store";
import { formatMoney, type PublicStoreProduct, type PublicStoreVariant } from "@/lib/public-store";
import { CollectionStoreSettingsPanel } from "./collection-store-settings-panel";

type ProductDraft = Omit<PublicStoreProduct, "_id"> & { _id?: string };

const productTypes: Array<ProductDraft["type"]> = ["self-fulfilled", "digital-download", "package"];

const newVariant = (index: number): PublicStoreVariant => ({
  id: `variant-${Date.now()}-${index}`,
  label: "",
  options: { Size: "" },
  price: 0,
  extraShipping: 0,
  sortOrder: index,
  hidden: false,
  isDefault: index === 0,
});

const productDraft = (product?: PublicStoreProduct): ProductDraft => ({
  _id: product?._id,
  name: product?.name ?? "New print product",
  slug: product?.slug ?? "",
  active: product?.active ?? true,
  type: product?.type ?? "self-fulfilled",
  category: product?.category ?? "Prints",
  price: Number(product?.price ?? 0),
  extraShipping: Number(product?.extraShipping ?? 0),
  description: product?.description ?? "",
  productInfo: product?.productInfo ?? "",
  productionNote: product?.productionNote ?? "",
  requiresPhoto: product?.requiresPhoto ?? true,
  allowCrop: product?.allowCrop ?? true,
  allowBulkPurchase: product?.allowBulkPurchase ?? true,
  noImageRequired: product?.noImageRequired ?? false,
  limitOnePerCheckout: product?.limitOnePerCheckout ?? false,
  downloadType: product?.downloadType ?? "single-photo",
  downloadSize: product?.downloadSize ?? "Original",
  variants: product?.variants?.length ? product.variants : [newVariant(0)],
});

const productPayload = (draft: ProductDraft) => ({
  name: draft.name,
  slug: draft.slug,
  active: draft.active,
  type: draft.type,
  category: draft.category,
  price: Number(draft.price || 0),
  extraShipping: Number(draft.extraShipping || 0),
  description: draft.description,
  productInfo: draft.productInfo,
  productionNote: draft.productionNote,
  requiresPhoto: draft.requiresPhoto,
  allowCrop: draft.allowCrop,
  allowBulkPurchase: draft.allowBulkPurchase,
  noImageRequired: draft.noImageRequired,
  limitOnePerCheckout: draft.limitOnePerCheckout,
  downloadType: draft.downloadType,
  downloadSize: draft.downloadSize,
  options: [{ name: "Size", values: (draft.variants ?? []).map((item) => item.label).filter(Boolean) }],
  variants: (draft.variants ?? []).map((variant, index) => ({
    ...variant,
    label: variant.label || `Size ${index + 1}`,
    options: { Size: variant.label || `Size ${index + 1}` },
    price: Number(variant.price || 0),
    extraShipping: Number(variant.extraShipping || 0),
    sortOrder: index,
  })),
});

export function CollectionStoreManager({ collectionId }: { collectionId: string }) {
  const admin = useCollectionStoreAdmin(collectionId);
  const { priceSheetsQuery } = useStorePriceSheets();
  const preparing = useRef(false);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const products = useMemo(() => admin.catalog?.products ?? [], [admin.catalog?.products]);

  useEffect(() => {
    if (
      admin.collectionLoading ||
      admin.form.priceSheetId ||
      admin.busy ||
      preparing.current
    ) return;
    preparing.current = true;
    void admin.createCatalog().finally(() => {
      preparing.current = false;
    });
  }, [admin.busy, admin.collectionLoading, admin.form.priceSheetId, admin.createCatalog]);

  if (admin.collectionLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin" />
      </div>
    );
  }
  if (!admin.collection) return <div className="p-8">Collection not found.</div>;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f6f4] px-3 py-6 text-[#202020] sm:px-4 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#d9d9d5] pb-6">
          <div className="min-w-0">
            <Link
              href={`/dashboard/store-gallery/collections/${collectionId}`}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#666] hover:text-[#222]"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#777]">Collection Store</p>
            <h1 className="mt-2 break-words text-2xl sm:text-3xl">{admin.collection.name}</h1>
            <p className="mt-2 text-sm text-[#666]">
              Configure product sales for this collection.
            </p>
          </div>
        </header>

        <CollectionStoreSettingsPanel
          form={admin.form}
          busy={admin.busy}
          priceSheets={priceSheetsQuery.data?.data ?? []}
          onChange={(patch) => admin.setForm((value) => ({ ...value, ...patch }))}
          onSave={admin.saveSettings}
        />

        <section className="mt-6 border border-[#E8E5E1] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6F57D9]">Products</p>
              <h2 className="mt-1 text-xl text-[#151515]">Collection product editor</h2>
              <p className="mt-1 text-sm text-[#666]">
                Add print details, sizes, prices, shipping, and checkout rules for this collection.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft(productDraft())}
              className="inline-flex items-center gap-2 bg-[#1C1C1C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E2E2E]"
            >
              <Plus className="size-4" />
              Add product
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
            <div className="space-y-3">
              {admin.catalogLoading ? (
                <div className="flex min-h-32 items-center justify-center border border-[#E8E5E1] bg-[#F8F7F4] text-sm text-[#666]">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading products
                </div>
              ) : products.length ? (
                products.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => setDraft(productDraft(product))}
                    className="block w-full border border-[#E8E5E1] bg-[#F8F7F4] p-4 text-left hover:border-[#B7A3FF]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#151515]">{product.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#777]">
                          {product.category || "Uncategorized"} / {product.type}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-[#151515]">
                        {formatMoney(Number(product.price || 0), admin.form.currency)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#666]">
                      <span className="border border-[#E8E5E1] bg-white px-2 py-1">
                        {(product.variants ?? []).length || 0} sizes
                      </span>
                      <span className="border border-[#E8E5E1] bg-white px-2 py-1">
                        {product.active === false ? "Hidden" : "Active"}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="border border-[#E8E5E1] bg-[#F8F7F4] p-5 text-sm text-[#666]">
                  No collection products yet.
                </div>
              )}
            </div>

            <div className="border border-[#E8E5E1] bg-[#F8F7F4] p-4">
              {draft ? (
                <ProductEditor
                  draft={draft}
                  busy={admin.busy}
                  currency={admin.form.currency}
                  onChange={(patch) => setDraft((value) => (value ? { ...value, ...patch } : value))}
                  onClose={() => setDraft(null)}
                  onSave={async () => {
                    if (draft._id) {
                      await admin.saveProduct(draft._id, productPayload(draft));
                    } else {
                      await admin.createProduct(productPayload(draft));
                    }
                    setDraft(null);
                  }}
                  onHide={draft._id ? async () => {
                    await admin.removeProduct(draft._id!);
                    setDraft(null);
                  } : undefined}
                />
              ) : (
                <div className="flex min-h-[360px] items-center justify-center text-center text-sm text-[#666]">
                  Select a product or add a new one.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProductEditor({
  draft,
  busy,
  currency,
  onChange,
  onSave,
  onHide,
  onClose,
}: {
  draft: ProductDraft;
  busy: boolean;
  currency: string;
  onChange: (patch: Partial<ProductDraft>) => void;
  onSave: () => Promise<void>;
  onHide?: () => Promise<void>;
  onClose: () => void;
}) {
  const variants = draft.variants ?? [];
  const updateVariant = (index: number, patch: Partial<PublicStoreVariant>) => {
    onChange({
      variants: variants.map((variant, itemIndex) =>
        itemIndex === index ? { ...variant, ...patch } : variant,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6F57D9]">
            {draft._id ? "Edit product" : "New product"}
          </p>
          <h3 className="mt-1 text-lg text-[#151515]">{draft.name || "Untitled product"}</h3>
        </div>
        <button type="button" onClick={onClose} className="p-2 text-[#666] hover:text-[#151515]">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={draft.name} onChange={(value) => onChange({ name: value })} />
        <Field label="Slug" value={draft.slug} onChange={(value) => onChange({ slug: value })} />
        <SelectField label="Type" value={draft.type} values={productTypes} onChange={(value) => onChange({ type: value as ProductDraft["type"] })} />
        <Field label="Category" value={draft.category ?? ""} onChange={(value) => onChange({ category: value })} />
        <Field label="Base price" type="number" value={String(draft.price ?? 0)} onChange={(value) => onChange({ price: Number(value) })} />
        <Field label="Extra shipping" type="number" value={String(draft.extraShipping ?? 0)} onChange={(value) => onChange({ extraShipping: Number(value) })} />
      </div>

      <Textarea label="Description" value={draft.description ?? ""} onChange={(value) => onChange({ description: value })} />
      <Textarea label="Product details" value={draft.productInfo ?? ""} onChange={(value) => onChange({ productInfo: value })} />
      <Textarea label="Production note" value={draft.productionNote ?? ""} onChange={(value) => onChange({ productionNote: value })} />

      <div className="grid gap-2 sm:grid-cols-2">
        <Check label="Active" checked={draft.active !== false} onChange={(value) => onChange({ active: value })} />
        <Check label="Requires photo" checked={draft.requiresPhoto !== false} onChange={(value) => onChange({ requiresPhoto: value })} />
        <Check label="Allow crop" checked={draft.allowCrop !== false} onChange={(value) => onChange({ allowCrop: value })} />
        <Check label="Bulk purchase" checked={draft.allowBulkPurchase !== false} onChange={(value) => onChange({ allowBulkPurchase: value })} />
        <Check label="No image required" checked={Boolean(draft.noImageRequired)} onChange={(value) => onChange({ noImageRequired: value })} />
        <Check label="Limit one checkout" checked={Boolean(draft.limitOnePerCheckout)} onChange={(value) => onChange({ limitOnePerCheckout: value })} />
      </div>

      <div className="border border-[#E8E5E1] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#151515]">Print sizes and prices</p>
            <p className="text-xs text-[#666]">Saved as variants on this product.</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ variants: [...variants, newVariant(variants.length)] })}
            className="inline-flex items-center gap-2 border border-[#E8E5E1] bg-[#F8F7F4] px-3 py-2 text-xs font-semibold hover:border-[#B7A3FF]"
          >
            <Plus className="size-3.5" />
            Size
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {variants.map((variant, index) => (
            <div key={variant.id} className="grid gap-2 border border-[#E8E5E1] bg-[#F8F7F4] p-3 sm:grid-cols-[1fr_120px_120px_auto]">
              <Field label="Size" value={variant.label} onChange={(value) => updateVariant(index, { label: value, options: { Size: value } })} />
              <Field label="Price" type="number" value={String(variant.price ?? 0)} onChange={(value) => updateVariant(index, { price: Number(value) })} />
              <Field label="Shipping" type="number" value={String(variant.extraShipping ?? 0)} onChange={(value) => updateVariant(index, { extraShipping: Number(value) })} />
              <div className="flex items-end gap-2">
                <Check label="Default" checked={Boolean(variant.isDefault)} onChange={(value) => onChange({ variants: variants.map((item, itemIndex) => ({ ...item, isDefault: value ? itemIndex === index : item.isDefault })) })} />
                <button
                  type="button"
                  onClick={() => onChange({ variants: variants.filter((_, itemIndex) => itemIndex !== index) })}
                  className="mb-1 p-2 text-[#666] hover:text-[#151515]"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#666]">
          Lowest visible price: {formatMoney(Math.min(...variants.map((item) => Number(item.price || 0)), Number(draft.price || 0)), currency)}
        </p>
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-[#E8E5E1] pt-4">
        {onHide ? (
          <button type="button" onClick={onHide} disabled={busy} className="inline-flex items-center gap-2 border border-[#E8E5E1] bg-white px-4 py-2 text-sm font-semibold text-[#151515] hover:border-[#C89F65] disabled:opacity-50">
            <Trash2 className="size-4" />
            Hide
          </button>
        ) : <span />}
        <button type="button" onClick={onSave} disabled={busy} className="inline-flex items-center gap-2 bg-[#1C1C1C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E2E2E] disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save product
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold text-[#555]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-[#E8E5E1] bg-white px-3 py-2 text-sm text-[#151515] outline-none focus:border-[#6F57D9]"
      />
    </label>
  );
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold text-[#555]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-[#E8E5E1] bg-white px-3 py-2 text-sm text-[#151515] outline-none focus:border-[#6F57D9]"
      >
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold text-[#555]">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-1 w-full resize-none border border-[#E8E5E1] bg-white px-3 py-2 text-sm text-[#151515] outline-none focus:border-[#6F57D9]"
      />
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-2 border border-[#E8E5E1] bg-white px-3 py-2 text-xs font-semibold text-[#151515]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[#6F57D9]"
      />
      {label}
    </label>
  );
}

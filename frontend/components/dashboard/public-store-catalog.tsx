"use client";

import { ImageIcon } from "lucide-react";
import {
  STORE_CATEGORY_ORDER,
  displayPrice,
  formatMoney,
  publicImageSrc,
  stripHtml,
  type PublicStoreProduct,
} from "@/lib/public-store";

export function PublicStoreCatalog({
  products,
  currency,
  enabled,
  onOpen,
}: {
  products: PublicStoreProduct[];
  currency: string;
  enabled?: boolean;
  onOpen: (product: PublicStoreProduct) => void;
}) {
  const categories = categoryNames(products);
  if (enabled === false) {
    return (
      <div className="mt-12 border bg-[#fafafa] p-8 text-center">
        <h3 className="text-xl font-medium">This store is currently turned off</h3>
        <p className="mt-2 text-sm text-[#666]">The collection owner can enable it from collection store settings.</p>
      </div>
    );
  }
  if (!products.length) {
    return (
      <div className="mt-12 border bg-[#fafafa] p-8 text-center">
        <h3 className="text-xl font-medium">No products are available yet</h3>
        <p className="mt-2 text-sm text-[#666]">The collection owner can add the default print catalog from the admin panel.</p>
      </div>
    );
  }
  return (
    <>
      {categories.map((category) => {
        const items = products.filter((product) => productCategory(product) === category);
        return (
          <section key={category} id={slugify(category)} className="scroll-mt-24 pt-14">
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <h3 className="text-2xl font-normal">{category}</h3>
              <span className="text-xs uppercase tracking-[0.18em] text-[#888]">{items.length} products</span>
            </div>
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((product) => (
                <ProductCard key={product._id} product={product} currency={currency} onOpen={() => onOpen(product)} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export function StoreMegaMenu({
  products,
  currency,
  onOpen,
}: {
  products: PublicStoreProduct[];
  currency: string;
  onOpen: (product: PublicStoreProduct) => void;
}) {
  const groups = STORE_CATEGORY_ORDER
    .map((category) => ({ category, products: products.filter((product) => productCategory(product) === category) }))
    .filter((group) => group.products.length);
  return (
    <div className="fixed left-0 right-0 top-[69px] border-b bg-[#f7f7f6] px-8 py-9 shadow-[0_15px_30px_rgba(0,0,0,0.05)]">
      <div className="mx-auto grid max-w-[980px] gap-10 md:grid-cols-3">
        {groups.map((group) => (
          <div key={group.category}>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em]">{group.category}</p>
            <div className="grid gap-3">
              {group.products.map((product) => (
                <button key={product._id} className="flex items-center justify-between gap-4 text-left text-sm text-[#777] hover:text-black" onClick={() => onOpen(product)}>
                  <span>{product.name}</span>
                  <span className="text-xs">{formatMoney(displayPrice(product), currency)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function categoryNames(products: PublicStoreProduct[]) {
  const names = [...new Set(products.map(productCategory))];
  return names.sort((a, b) => {
    const left = STORE_CATEGORY_ORDER.indexOf(a);
    const right = STORE_CATEGORY_ORDER.indexOf(b);
    return (left < 0 ? 99 : left) - (right < 0 ? 99 : right) || a.localeCompare(b);
  });
}

function productCategory(product: PublicStoreProduct) {
  return product.type === "digital-download" ? "Digital Downloads" : product.category || "Other";
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ProductCard({ product, currency, onOpen }: { product: PublicStoreProduct; currency: string; onOpen: () => void }) {
  const preview = product.previewImages?.[0] || product.images?.[0];
  return (
    <button className="group text-left" onClick={onOpen}>
      <div className="aspect-[1.08] overflow-hidden bg-[#f2f2f0]">
        {preview ? (
          <img src={publicImageSrc(preview)} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" />
        ) : (
          <div className="flex h-full items-center justify-center text-[#aaa]"><ImageIcon className="size-8" /></div>
        )}
      </div>
      <h4 className="mt-4 text-base font-medium">{product.name}</h4>
      <p className="mt-1 text-sm text-[#777]">From {formatMoney(displayPrice(product), currency)}</p>
      {product.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#888]">{stripHtml(product.description)}</p>}
    </button>
  );
}

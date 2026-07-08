"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Layers3,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  type AdminDefaultStoreProduct,
  type AdminDefaultStoreVariant,
  updateAdminDefaultStoreProduct,
  uploadHomeCmsFile,
} from "@/actions/admin";
import { AdminResourceShell } from "./admin-resource-shell";

type ProductOption = { name: string; values: string[] };

function cloneProduct(product: AdminDefaultStoreProduct): AdminDefaultStoreProduct {
  return {
    ...JSON.parse(JSON.stringify(product)),
    variants: Array.isArray(product.variants) ? JSON.parse(JSON.stringify(product.variants)) : [],
    options: Array.isArray(product.options) ? JSON.parse(JSON.stringify(product.options)) : [],
  };
}

function uid(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function normalizeOptions(options?: ProductOption[]) {
  return (options ?? [])
    .map((option) => ({
      name: option.name.trim(),
      values: [...new Set(option.values.map((value) => value.trim()).filter(Boolean))],
    }))
    .filter((option) => option.name && option.values.length);
}

function cartesianOptions(options: ProductOption[]) {
  return options.reduce<Array<Record<string, string>>>(
    (rows, option) => rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.name]: value }))),
    [{}],
  );
}

export function AdminDefaultProductsPage({ initialProducts }: { initialProducts: AdminDefaultStoreProduct[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [filter, setFilter] = useState<"All" | "Prints" | "Wall Art">("All");
  const [draft, setDraft] = useState<AdminDefaultStoreProduct | null>(null);
  const [pending, startTransition] = useTransition();
  const visible = useMemo(
    () => products
      .filter((item) => ["Prints", "Wall Art"].includes(item.category) && (filter === "All" || item.category === filter))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [products, filter],
  );

  const openEditor = (product: AdminDefaultStoreProduct) => setDraft(cloneProduct(product));

  const save = () => {
    if (!draft) return;
    const cleanOptions = normalizeOptions(draft.options);
    const cleanVariants = (draft.variants ?? []).map((variant, index) => ({
      ...variant,
      id: variant.id || uid("variant"),
      label: variant.label.trim() || `Variant ${index + 1}`,
      price: Number(variant.price) || 0,
      extraShipping: Number(variant.extraShipping) || 0,
      sortOrder: index,
      options: Object.fromEntries(
        Object.entries(variant.options ?? {}).filter(([key, value]) => key.trim() && String(value).trim()),
      ),
    }));

    startTransition(async () => {
      try {
        const saved = await updateAdminDefaultStoreProduct(draft._id, {
          ...draft,
          options: cleanOptions,
          variants: cleanVariants,
        });
        setProducts((current) => current.map((item) => (item._id === saved._id ? saved : item)));
        setDraft(null);
        toast.success("Default product updated");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Update failed");
      }
    });
  };

  const upload = async (file?: File) => {
    if (!file || !draft) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = await uploadHomeCmsFile(formData);
      setDraft({ ...draft, images: [url], previewImages: [url] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const patchVariant = (index: number, patch: Partial<AdminDefaultStoreVariant>) => {
    setDraft((current) => current ? ({
      ...current,
      variants: (current.variants ?? []).map((variant, itemIndex) => itemIndex === index ? { ...variant, ...patch } : variant),
    }) : current);
  };

  const addVariant = (preset?: Partial<AdminDefaultStoreVariant>) => {
    setDraft((current) => current ? ({
      ...current,
      variants: [
        ...(current.variants ?? []),
        {
          id: uid("variant"),
          label: preset?.label ?? "New size",
          options: preset?.options ?? { Size: "" },
          price: preset?.price ?? current.price ?? 0,
          extraShipping: preset?.extraShipping ?? current.extraShipping ?? 0,
          hidden: false,
          isDefault: !(current.variants ?? []).length,
          sortOrder: (current.variants ?? []).length,
        },
      ],
    }) : current);
  };

  const removeVariant = (index: number) => setDraft((current) => current ? ({
    ...current,
    variants: (current.variants ?? []).filter((_, itemIndex) => itemIndex !== index),
  }) : current);

  const moveVariant = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const variants = [...(current.variants ?? [])];
      const target = index + direction;
      if (target < 0 || target >= variants.length) return current;
      [variants[index], variants[target]] = [variants[target], variants[index]];
      return { ...current, variants };
    });
  };

  const setDefaultVariant = (index: number) => setDraft((current) => current ? ({
    ...current,
    variants: (current.variants ?? []).map((variant, itemIndex) => ({ ...variant, isDefault: itemIndex === index })),
  }) : current);

  const addOptionGroup = () => setDraft((current) => current ? ({
    ...current,
    options: [...(current.options ?? []), { name: "Option", values: ["Value"] }],
  }) : current);

  const patchOption = (index: number, patch: Partial<ProductOption>) => setDraft((current) => current ? ({
    ...current,
    options: (current.options ?? []).map((option, itemIndex) => itemIndex === index ? { ...option, ...patch } : option),
  }) : current);

  const removeOption = (index: number) => setDraft((current) => current ? ({
    ...current,
    options: (current.options ?? []).filter((_, itemIndex) => itemIndex !== index),
  }) : current);

  const generateVariants = () => {
    if (!draft) return;
    const options = normalizeOptions(draft.options);
    if (!options.length) {
      toast.error("Add at least one option with values first");
      return;
    }
    const combinations = cartesianOptions(options);
    const existing = new Map((draft.variants ?? []).map((variant) => [JSON.stringify(variant.options ?? {}), variant]));
    const generated = combinations.map((optionMap, index) => {
      const match = existing.get(JSON.stringify(optionMap));
      return match ?? {
        id: uid("variant"),
        label: Object.values(optionMap).join(" / "),
        options: optionMap,
        price: draft.price ?? 0,
        extraShipping: draft.extraShipping ?? 0,
        hidden: false,
        isDefault: index === 0 && !(draft.variants ?? []).some((variant) => variant.isDefault),
        sortOrder: index,
      };
    });
    setDraft({ ...draft, options, variants: generated });
    toast.success(`${generated.length} option variants generated`);
  };

  return (
    <AdminResourceShell
      active="products"
      title="Default Prints & Wall Art"
      subtitle="Manage the master products, size choices, option groups, prices and shipping used when a Store catalog is generated."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {(["All", "Prints", "Wall Art"] as const).map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`h-10 border px-5 text-sm font-bold ${filter === item ? "bg-[#111] text-white" : "bg-white"}`}>
            {item}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b bg-[#fafafa] text-left text-xs uppercase tracking-[0.14em] text-[#777]">
            <tr>
              <th className="px-4 py-4">Image</th>
              <th className="px-4 py-4">Product</th>
              <th className="px-4 py-4">Category</th>
              <th className="px-4 py-4">Base price</th>
              <th className="px-4 py-4">Sizes / variants</th>
              <th className="px-4 py-4">Options</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => (
              <tr key={product._id} className="border-b align-middle last:border-b-0">
                <td className="px-4 py-4"><div className="size-20 overflow-hidden bg-[#eee]">{product.images?.[0] ? <img src={product.images[0]} alt="" className="h-full w-full object-cover" /> : null}</div></td>
                <td className="px-4 py-4"><b>{product.name}</b><p className="mt-1 text-xs text-[#777]">{product.slug}</p></td>
                <td className="px-4 py-4">{product.category}</td>
                <td className="px-4 py-4">${Number(product.price || 0).toFixed(2)}</td>
                <td className="px-4 py-4">
                  <p className="font-semibold">{product.variants?.length ?? 0} variants</p>
                  <p className="mt-1 max-w-64 truncate text-xs text-[#777]">{(product.variants ?? []).slice(0, 4).map((variant) => variant.label).join(" · ") || "No sizes added"}</p>
                </td>
                <td className="px-4 py-4">{product.options?.length ?? 0} groups</td>
                <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${product.active ? "bg-emerald-50 text-emerald-700" : "bg-[#f2f2f2] text-[#777]"}`}>{product.active ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-4 text-right"><button onClick={() => openEditor(product)} className="inline-flex size-10 items-center justify-center border hover:bg-[#f3f3f3]" aria-label={`Edit ${product.name}`}><Edit3 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3 sm:p-6">
          <div className="mx-auto my-3 w-full max-w-6xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#777]">Default product editor</p>
                <h2 className="mt-2 text-2xl font-semibold">{draft.name}</h2>
                <p className="mt-1 text-sm text-[#777]">Add unlimited sizes and option combinations. Changes become the defaults for newly generated catalogs.</p>
              </div>
              <button onClick={() => setDraft(null)} className="flex size-10 items-center justify-center border" aria-label="Close product editor"><X className="size-5" /></button>
            </div>

            <div className="grid gap-8 p-5 sm:p-7">
              <section>
                <div className="mb-4 flex items-center gap-3"><span className="flex size-9 items-center justify-center bg-[#111] text-white"><Edit3 className="size-4" /></span><div><h3 className="font-bold">Product information</h3><p className="text-xs text-[#777]">Name, pricing, image and customer-facing descriptions.</p></div></div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Product name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
                  <Field label="Category" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} />
                  <Field label="Base price" value={String(draft.price ?? 0)} onChange={(value) => setDraft({ ...draft, price: Number(value) || 0 })} type="number" />
                  <Field label="Extra shipping" value={String(draft.extraShipping ?? 0)} onChange={(value) => setDraft({ ...draft, extraShipping: Number(value) || 0 })} type="number" />
                  <Area label="Description" value={draft.description ?? ""} onChange={(description) => setDraft({ ...draft, description })} />
                  <Area label="Product information" value={draft.productInfo ?? ""} onChange={(productInfo) => setDraft({ ...draft, productInfo })} />
                  <Area label="Production note" value={draft.productionNote ?? ""} onChange={(productionNote) => setDraft({ ...draft, productionNote })} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#777]">Product image</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      <div className="size-28 overflow-hidden bg-[#eee]">{draft.images?.[0] && <img src={draft.images[0]} alt="" className="h-full w-full object-cover" />}</div>
                      <label className="inline-flex h-11 cursor-pointer items-center gap-2 bg-[#111] px-4 text-sm font-bold text-white"><Upload className="size-4" />Upload image<input type="file" accept="image/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} /></label>
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-t pt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center bg-[#111] text-white"><Layers3 className="size-4" /></span><div><h3 className="font-bold">Option groups</h3><p className="text-xs text-[#777]">Examples: Size, Finish, Frame, Paper or Orientation.</p></div></div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={addOptionGroup} className="inline-flex h-10 items-center gap-2 border px-4 text-sm font-bold"><Plus className="size-4" />Add option group</button>
                    <button onClick={generateVariants} className="inline-flex h-10 items-center gap-2 bg-[#111] px-4 text-sm font-bold text-white"><Layers3 className="size-4" />Generate combinations</button>
                  </div>
                </div>
                <div className="mt-5 grid gap-4">
                  {(draft.options ?? []).map((option, optionIndex) => (
                    <OptionGroup
                      key={`${option.name}-${optionIndex}`}
                      option={option}
                      onChange={(patch) => patchOption(optionIndex, patch)}
                      onRemove={() => removeOption(optionIndex)}
                    />
                  ))}
                  {!(draft.options ?? []).length && <div className="border border-dashed p-8 text-center text-sm text-[#777]">No option groups yet. Add “Size” or another option, then generate combinations.</div>}
                </div>
              </section>

              <section className="border-t pt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold">Size / option variants</h3>
                    <p className="mt-1 text-xs text-[#777]">Every row is editable. Add as many sizes as needed, reorder them and choose the default.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="size-4 accent-[#22bda7]" />Active template</label>
                    <button onClick={() => addVariant()} className="inline-flex h-10 items-center gap-2 bg-[#22bda7] px-4 text-sm font-bold text-white"><Plus className="size-4" />Add size / variant</button>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto border">
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-[52px_minmax(190px,1.2fr)_minmax(210px,1.4fr)_120px_120px_100px_108px] gap-3 border-b bg-[#fafafa] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#777]">
                      <span>Order</span><span>Label</span><span>Option values</span><span>Price</span><span>Shipping</span><span>Visible</span><span>Actions</span>
                    </div>
                    {(draft.variants ?? []).map((variant, index) => (
                      <div key={variant.id || index} className="grid grid-cols-[52px_minmax(190px,1.2fr)_minmax(210px,1.4fr)_120px_120px_100px_108px] items-center gap-3 border-b px-3 py-3 last:border-b-0">
                        <div className="flex flex-col items-center">
                          <button onClick={() => moveVariant(index, -1)} disabled={index === 0} className="disabled:opacity-20" aria-label="Move variant up"><ChevronUp className="size-4" /></button>
                          <button onClick={() => moveVariant(index, 1)} disabled={index === (draft.variants?.length ?? 0) - 1} className="disabled:opacity-20" aria-label="Move variant down"><ChevronDown className="size-4" /></button>
                        </div>
                        <div>
                          <input value={variant.label} onChange={(event) => patchVariant(index, { label: event.target.value })} className="h-10 w-full border px-3 text-sm" />
                          <label className="mt-2 flex items-center gap-2 text-xs"><input type="radio" name="default-variant" checked={Boolean(variant.isDefault)} onChange={() => setDefaultVariant(index)} />Default choice</label>
                        </div>
                        <VariantOptionValues
                          options={draft.options ?? []}
                          values={variant.options ?? {}}
                          onChange={(options) => patchVariant(index, { options, label: Object.values(options).filter(Boolean).join(" / ") || variant.label })}
                        />
                        <input type="number" value={variant.price} onChange={(event) => patchVariant(index, { price: Number(event.target.value) || 0 })} className="h-10 border px-3 text-sm" />
                        <input type="number" value={variant.extraShipping ?? 0} onChange={(event) => patchVariant(index, { extraShipping: Number(event.target.value) || 0 })} className="h-10 border px-3 text-sm" />
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!variant.hidden} onChange={(event) => patchVariant(index, { hidden: !event.target.checked })} className="size-4 accent-[#22bda7]" />Visible</label>
                        <div className="flex gap-1">
                          <button onClick={() => addVariant({ ...variant, id: uid("variant"), label: `${variant.label} Copy`, isDefault: false })} className="flex size-9 items-center justify-center border" aria-label="Duplicate variant"><Copy className="size-4" /></button>
                          <button onClick={() => removeVariant(index)} className="flex size-9 items-center justify-center border text-red-600" aria-label="Delete variant"><Trash2 className="size-4" /></button>
                        </div>
                      </div>
                    ))}
                    {!(draft.variants ?? []).length && <div className="p-10 text-center text-sm text-[#777]">No variants yet. Click “Add size / variant” or generate combinations from option groups.</div>}
                  </div>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t bg-white px-5 py-4 sm:px-7">
              <button onClick={() => setDraft(null)} className="h-11 border px-5 text-sm font-bold">Cancel</button>
              <button onClick={save} disabled={pending} className="inline-flex h-11 items-center gap-2 bg-[#22bda7] px-6 text-sm font-bold text-white disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save product</button>
            </div>
          </div>
        </div>
      )}
    </AdminResourceShell>
  );
}

function OptionGroup({ option, onChange, onRemove }: { option: ProductOption; onChange: (patch: Partial<ProductOption>) => void; onRemove: () => void }) {
  const [valueDraft, setValueDraft] = useState("");
  const addValue = () => {
    const value = valueDraft.trim();
    if (!value || option.values.includes(value)) return;
    onChange({ values: [...option.values, value] });
    setValueDraft("");
  };
  return (
    <div className="border bg-[#fafafa] p-4">
      <div className="flex flex-wrap items-start gap-4">
        <label className="grid min-w-[220px] flex-1 gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#777]">Option name</span><input value={option.name} onChange={(event) => onChange({ name: event.target.value })} className="h-10 border bg-white px-3 text-sm" placeholder="Size" /></label>
        <button onClick={onRemove} className="mt-5 flex size-10 items-center justify-center border text-red-600" aria-label="Remove option group"><Trash2 className="size-4" /></button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {option.values.map((value, valueIndex) => (
          <span key={`${value}-${valueIndex}`} className="inline-flex h-9 items-center gap-2 border bg-white pl-3 pr-2 text-sm font-semibold">{value}<button onClick={() => onChange({ values: option.values.filter((_, index) => index !== valueIndex) })} aria-label={`Remove ${value}`}><X className="size-3.5" /></button></span>
        ))}
      </div>
      <div className="mt-3 flex max-w-md gap-2"><input value={valueDraft} onChange={(event) => setValueDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addValue(); } }} placeholder="Add value, e.g. 8×10" className="h-10 min-w-0 flex-1 border bg-white px-3 text-sm" /><button onClick={addValue} className="inline-flex h-10 items-center gap-2 bg-[#111] px-4 text-sm font-bold text-white"><Plus className="size-4" />Add</button></div>
    </div>
  );
}

function VariantOptionValues({ options, values, onChange }: { options: ProductOption[]; values: Record<string, string>; onChange: (values: Record<string, string>) => void }) {
  if (!options.length) {
    return <input value={values.Size ?? ""} onChange={(event) => onChange({ ...values, Size: event.target.value })} placeholder="Size or option" className="h-10 w-full border px-3 text-sm" />;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <label key={option.name} className="grid gap-1"><span className="text-[9px] font-bold uppercase text-[#888]">{option.name}</span><select value={values[option.name] ?? ""} onChange={(event) => onChange({ ...values, [option.name]: event.target.value })} className="h-9 border bg-white px-2 text-xs"><option value="">Select</option>{option.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#777]">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 border px-3 text-sm outline-none focus:border-[#22bda7]" /></label>;
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#777]">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28 border p-3 text-sm outline-none focus:border-[#22bda7]" /></label>;
}

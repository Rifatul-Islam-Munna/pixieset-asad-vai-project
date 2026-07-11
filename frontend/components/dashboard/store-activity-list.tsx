"use client";

import { useQuery } from "@tanstack/react-query";
import { GetRequestNormal } from "@/api-hooks/api-hooks";

type Row = {
  _id: string;
  type: string;
  createdAt?: string;
  metadata?: {
    productName?: string;
    orderId?: string;
    amount?: number;
    currency?: string;
  };
};

export function StoreActivityList({
  collectionId,
  currency,
}: {
  collectionId: string;
  currency: string;
}) {
  const query = useQuery({
    queryKey: ["store-activity", collectionId],
    queryFn: () =>
      GetRequestNormal<{ data: Row[] }>(
        `/store/collection/${collectionId}/activity`,
      ),
  });
  const rows = query.data?.data ?? [];

  return (
    <section className="mt-6 border bg-white">
      <div className="border-b p-5">
        <h2 className="text-lg font-medium">Store activity</h2>
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <div
            key={row._id}
            className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[180px_1fr_1fr_140px]"
          >
            <span className="text-[#666]">
              {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
            </span>
            <span className="font-medium">{row.type.replaceAll("_", " ")}</span>
            <span>{row.metadata?.productName || row.metadata?.orderId || "-"}</span>
            <span>
              {row.metadata?.amount
                ? formatEuro(row.metadata.amount, row.metadata.currency || currency)
                : "-"}
            </span>
          </div>
        ))}
        {query.isLoading && (
          <p className="px-5 py-12 text-center text-sm text-[#777]">Loading activity…</p>
        )}
        {query.isError && (
          <p className="px-5 py-12 text-center text-sm text-red-700">
            Store activity could not be loaded.
          </p>
        )}
        {!query.isLoading && !query.isError && !rows.length && (
          <p className="px-5 py-12 text-center text-sm text-[#777]">
            No store activity yet.
          </p>
        )}
      </div>
    </section>
  );
}

function formatEuro(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency === "EUR" ? currency : "EUR",
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `€${Number(value || 0).toFixed(2)}`;
  }
}

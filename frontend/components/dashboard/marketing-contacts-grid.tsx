"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Loader2,
  Mail,
  Megaphone,
  Search,
  Users,
} from "lucide-react";

import { GetRequestNormal } from "@/api-hooks/api-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


type MarketingContact = {
  _id: string;
  email: string;
  collectionId: string;
  collectionName: string;
  source: string;
  sources?: string[];
  marketingOptIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ListResponse<T> = { data: T };

function contactDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sourceLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function MarketingContactsGrid() {
  const query = useQuery({
    queryKey: ["marketing-contacts"],
    queryFn: () =>
      GetRequestNormal<ListResponse<MarketingContact[]>>(
        "/collections/marketing-contacts",
      ),
  });
  const contacts = Array.isArray(query.data?.data) ? query.data.data : [];
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");

  const sources = useMemo(
    () => [...new Set(contacts.map((contact) => contact.source).filter(Boolean))],
    [contacts],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesSource = source === "all" || contact.source === source;
      const matchesSearch =
        !term ||
        contact.email.toLowerCase().includes(term) ||
        (contact.collectionName || "").toLowerCase().includes(term) ||
        (contact.source || "").toLowerCase().includes(term);
      return matchesSource && matchesSearch;
    });
  }, [contacts, search, source]);

  const collectionCount = new Set(
    contacts.map((contact) => contact.collectionId || contact.collectionName),
  ).size;
  const latest = contacts.reduce<string | undefined>((current, contact) => {
    const value = contact.updatedAt || contact.createdAt;
    if (!value) return current;
    if (!current) return value;
    return new Date(value).getTime() > new Date(current).getTime() ? value : current;
  }, undefined);

  const exportCsv = () => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ["Email", "Collection", "Source", "Subscribed", "Updated"],
      ...filtered.map((contact) => [
        contact.email,
        contact.collectionName || "Collection",
        sourceLabel(contact.source || "subscription"),
        contact.marketingOptIn === false ? "No" : "Yes",
        contact.updatedAt || contact.createdAt || "",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => escape(String(value))).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "marketing-contacts.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (query.isLoading) {
    return (
      <div className="mt-8 flex min-h-[420px] items-center justify-center border bg-white">
        <Loader2 className="size-7 animate-spin text-[#22bda7]" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mt-8 flex min-h-72 flex-col items-center justify-center border bg-white p-8 text-center">
        <Megaphone className="size-10 text-[#999]" />
        <h2 className="mt-5 text-lg font-bold">Contacts could not be loaded</h2>
        <Button className="mt-5 rounded-none" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border bg-white p-5">
          <div className="flex items-center gap-3 text-[#008f80]">
            <Users className="size-5" />
            <span className="text-xs font-bold uppercase tracking-[0.15em]">Subscribers</span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{contacts.length}</p>
          <p className="mt-2 text-xs text-[#777]">Opted-in email contacts</p>
        </div>
        <div className="border bg-white p-5">
          <div className="flex items-center gap-3 text-[#008f80]">
            <Megaphone className="size-5" />
            <span className="text-xs font-bold uppercase tracking-[0.15em]">Collections</span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{collectionCount}</p>
          <p className="mt-2 text-xs text-[#777]">Collections generating contacts</p>
        </div>
        <div className="border bg-white p-5">
          <div className="flex items-center gap-3 text-[#008f80]">
            <Mail className="size-5" />
            <span className="text-xs font-bold uppercase tracking-[0.15em]">Latest opt-in</span>
          </div>
          <p className="mt-4 text-xl font-semibold">{contactDate(latest)}</p>
          <p className="mt-2 text-xs text-[#777]">Most recent subscription</p>
        </div>
      </div>

      <section className="border bg-white">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-3 border px-3 lg:max-w-[430px]">
            <Search className="size-4 shrink-0 text-[#777]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search email or collection"
              className="h-9 rounded-none border-0 px-0 focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="h-11 border bg-white px-4 text-sm outline-none"
            >
              <option value="all">All subscription sources</option>
              {sources.map((item) => (
                <option key={item} value={item}>
                  {sourceLabel(item)}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="h-11 rounded-none"
              disabled={!filtered.length}
              onClick={exportCsv}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {contacts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-[#fafafa] text-[11px] font-bold uppercase tracking-[0.12em] text-[#777]">
                <tr>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Collection</th>
                  <th className="px-5 py-4">Subscription source</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Date updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => (
                  <tr key={contact._id} className="border-b last:border-b-0 hover:bg-[#fcfcfc]">
                    <td className="px-5 py-5">
                      <span className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef8f6] text-[#009b8c]">
                          <Mail className="size-4" />
                        </span>
                        <span className="break-all font-bold">{contact.email}</span>
                      </span>
                    </td>
                    <td className="px-5 py-5">{contact.collectionName || "Collection"}</td>
                    <td className="px-5 py-5">{sourceLabel(contact.source || "subscription")}</td>
                    <td className="px-5 py-5">
                      <span className="rounded-full bg-[#eaf7f3] px-3 py-1 text-xs font-bold text-[#008f80]">
                        Subscribed
                      </span>
                    </td>
                    <td className="px-5 py-5 text-[#666]">
                      {contactDate(contact.updatedAt || contact.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="px-6 py-16 text-center text-sm text-[#777]">
                No contacts match the current search and source filter.
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <span className="flex size-24 items-center justify-center rounded-full bg-[#f4eeee] text-[#444]">
              <Megaphone className="size-10" />
            </span>
            <h2 className="mt-7 text-lg font-bold">No marketing contacts yet</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#666]">
              Contacts appear here with their collection name after visitors
              choose a marketing subscription option.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

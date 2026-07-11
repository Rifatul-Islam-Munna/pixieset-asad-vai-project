"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, Megaphone } from "lucide-react";
import { GetRequestNormal } from "@/api-hooks/api-hooks";

type MarketingContact = {
  _id: string;
  email: string;
  collectionId: string;
  collectionName: string;
  source: string;
  updatedAt?: string;
};

type ListResponse<T> = { data: T };

export function MarketingContactsGrid() {
  const query = useQuery({
    queryKey: ["marketing-contacts"],
    queryFn: () =>
      GetRequestNormal<ListResponse<MarketingContact[]>>(
        "/collections/marketing-contacts",
      ),
  });
  const contacts = query.data?.data ?? [];

  if (query.isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center border bg-white">
        <Loader2 className="size-6 animate-spin text-[#22bda7]" />
      </div>
    );
  }

  if (!contacts.length) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center border bg-white p-8 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-[#f4eeee]">
<Megaphone className="size-9" />
        </span>
        <h2 className="mt-6 text-lg font-bold">No marketing contacts yet</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#666]">
Contacts will appear here with their collection name after they choose the marketing subscription option.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {contacts.map((contact) => (
        <div key={contact._id} className="border bg-white p-5">
<div className="flex items-start gap-3">
  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef8f6] text-[#009b8c]">
    <Mail className="size-4" />
  </span>
  <div className="min-w-0">
    <p className="break-all font-bold">{contact.email}</p>
    <p className="mt-2 text-sm text-[#666]">{contact.collectionName || "Collection"}</p>
  </div>
</div>
<p className="mt-4 text-xs uppercase tracking-wide text-[#00a997]">
  Opted in · {contact.source.replace(/-/g, " ")}
</p>
        </div>
      ))}
    </div>
  );
}

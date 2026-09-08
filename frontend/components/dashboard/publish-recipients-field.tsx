"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileUp, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { GetRequestNormal } from "@/api-hooks/api-hooks";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ClientContact = {
  email: string;
  collectionName?: string;
  source?: string;
  marketingOptIn?: boolean;
  categories?: string[];
};

type ContactsResponse = { data: ClientContact[] };

function parseEmails(value: string) {
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((email) => email.trim().toLowerCase()))];
}

function categoriesFor(contact: ClientContact) {
  const categories = Array.isArray(contact.categories)
    ? contact.categories.map((item) => item.trim()).filter(Boolean)
    : [];
  const fallback = (contact.collectionName || contact.source || "Client contacts").trim();
  return [...new Set(categories.length ? categories : [fallback])];
}

export function PublishRecipientsField({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [contactsOpen, setContactsOpen] = useState(false);
  const contactsQuery = useQuery({
    queryKey: ["client-contacts"],
    queryFn: () => GetRequestNormal<ContactsResponse>("/collections/client-contacts"),
    enabled: contactsOpen,
  });
  const selected = useMemo(() => parseEmails(value), [value]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const contacts = useMemo(
    () => Array.isArray(contactsQuery.data?.data) ? contactsQuery.data.data : [],
    [contactsQuery.data],
  );
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    contacts.forEach((contact) => {
      categoriesFor(contact).forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
    });
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [contacts]);
  const visibleContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts
      .filter((contact) => {
        const contactCategories = categoriesFor(contact);
        const matchesCategory = category === "all" || contactCategories.includes(category);
        const haystack = `${contact.email} ${contact.collectionName || ""} ${contact.source || ""} ${contactCategories.join(" ")}`.toLowerCase();
        return matchesCategory && (!query || haystack.includes(query));
      })
      .slice(0, 200);
  }, [category, contacts, search]);
  const visibleEmails = useMemo(
    () => [...new Set(visibleContacts.map((contact) => contact.email.trim().toLowerCase()))],
    [visibleContacts],
  );
  const allVisibleSelected = visibleEmails.length > 0 && visibleEmails.every((email) => selectedSet.has(email));

  const setEmails = (emails: string[]) => onChange([...new Set(emails)].join("\n"));
  const toggleContact = (email: string) => {
    const clean = email.trim().toLowerCase();
    setEmails(selectedSet.has(clean) ? selected.filter((item) => item !== clean) : [...selected, clean]);
  };
  const toggleVisibleContacts = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleEmails);
      setEmails(selected.filter((email) => !visibleSet.has(email)));
      return;
    }
    setEmails([...selected, ...visibleEmails]);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const imported = parseEmails(text);
    if (!imported.length) {
      toast.error("No valid email addresses found in that file");
      return;
    }
    const added = imported.filter((email) => !selectedSet.has(email)).length;
    setEmails([...selected, ...imported]);
    toast.success(`${added} new recipient${added === 1 ? "" : "s"} added from ${file.name}`);
  };

  return (
    <div className="mt-2 grid gap-3">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={"client@example.com, partner@example.com\nanother@example.com"}
        className={cn("rounded-none bg-white", compact ? "min-h-24" : "min-h-28 px-5 py-3")}
      />
      <p className="-mt-1 text-[11px] leading-5 text-[#888]">
        Type or paste emails separated by commas, semicolons, spaces, or new lines.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setContactsOpen((open) => !open)}
          className="inline-flex h-9 items-center gap-2 border bg-white px-3 text-xs font-bold hover:border-[#6337d8] hover:text-[#6337d8]"
        >
          <UserPlus className="size-4" /> Choose from contacts
        </button>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 border bg-white px-3 text-xs font-bold hover:border-[#6337d8] hover:text-[#6337d8]">
          <FileUp className="size-4" /> Upload CSV / email list
          <input
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            className="hidden"
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <span className="text-xs text-[#777]">{selected.length} publish recipient{selected.length === 1 ? "" : "s"}</span>
      </div>

      {selected.length > 0 && (
        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
          {selected.map((email) => (
            <button key={email} type="button" onClick={() => setEmails(selected.filter((item) => item !== email))} className="inline-flex items-center gap-1.5 border bg-[#fafafa] px-2.5 py-1.5 text-[11px] font-semibold text-[#555] hover:border-red-300 hover:text-red-600">
              <span className="max-w-56 truncate">{email}</span><X className="size-3" />
            </button>
          ))}
        </div>
      )}
      {contactsOpen && (
        <div className="border bg-white p-3">
          <label className="flex h-10 items-center gap-2 border px-3">
            <Search className="size-4 text-[#888]" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client contacts or categories" className="h-8 border-0 p-0 focus-visible:ring-0" />
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 min-w-0 border bg-white px-3 text-xs font-semibold outline-none">
              <option value="all">All contact categories ({contacts.length})</option>
              {categories.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
            </select>
            <button type="button" disabled={!visibleEmails.length} onClick={toggleVisibleContacts} className="h-10 border bg-white px-4 text-xs font-bold text-[#6337d8] disabled:cursor-not-allowed disabled:opacity-40">
              {allVisibleSelected ? `Remove visible (${visibleEmails.length})` : category === "all" ? `Select visible (${visibleEmails.length})` : `Add category (${visibleEmails.length})`}
            </button>
          </div>
          <div className="mt-3 max-h-64 overflow-y-auto border">
            {contactsQuery.isLoading ? (
              <p className="p-4 text-xs text-[#777]">Loading contacts...</p>
            ) : visibleContacts.length ? visibleContacts.map((contact) => {
              const checked = selectedSet.has(contact.email.toLowerCase());
              const contactCategories = categoriesFor(contact);
              return (
                <button key={contact.email} type="button" onClick={() => toggleContact(contact.email)} className={cn("flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0", checked ? "bg-[#f5f1ff]" : "hover:bg-[#fafafa]")}>
                  <span className={cn("grid size-4 shrink-0 place-items-center border text-[10px]", checked && "border-[#6337d8] bg-[#6337d8] text-white")}>{checked ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{contact.email}</span><span className="block truncate text-[10px] text-[#888]">{contactCategories.join(" · ")}</span></span>
                </button>
              );
            }) : (
              <p className="p-4 text-xs text-[#777]">No contacts match this category/search. You can still type emails or upload CSV above.</p>
            )}
          </div>
        </div>
      )}
      <p className="text-xs leading-5 text-[#777]">These are the exact people who receive the Gallery Published email. Choose individual contacts or a whole contact category, paste comma-separated emails, or upload CSV/TXT. Every publish recipient is automatically synchronized into this gallery&apos;s email-access allowlist. Marketing opt-in is not required for this transactional delivery.</p>
    </div>
  );
}

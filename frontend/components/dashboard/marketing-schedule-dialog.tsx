"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { GetRequestNormal } from "@/api-hooks/api-hooks";
import { useAccount } from "@/api-hooks/use-account";
import { useCollections } from "@/api-hooks/use-collections";
import { useMarketingSchedules } from "@/api-hooks/use-marketing-schedules";
import { useDashboardStore } from "@/lib/dashboard-store";
import { publicCollectionUrl } from "@/lib/public-site-url";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const FALLBACK_TIMEZONES = ["UTC", "Asia/Dhaka", "Asia/Kolkata", "Asia/Dubai", "Europe/London", "Europe/Paris", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Australia/Sydney"];

type Contact = { _id: string; email: string; collectionName?: string; source?: string };
type ContactsResponse = { data: Contact[] };

export function MarketingScheduleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { emailTemplates } = useDashboardStore();
  const { collectionsQuery } = useCollections();
  const account = useAccount().query;
  const schedules = useMarketingSchedules();
  const contactsQuery = useQuery({
    queryKey: ["marketing-contacts"],
    queryFn: () => GetRequestNormal<ContactsResponse>("/collections/marketing-contacts"),
    enabled: open,
  });
  const contacts = useMemo(() => Array.isArray(contactsQuery.data?.data) ? contactsQuery.data.data : [], [contactsQuery.data]);
  const collections = useMemo(() => Array.isArray(collectionsQuery.data?.data) ? collectionsQuery.data.data : [], [collectionsQuery.data]);
  const categories = useMemo(() => [...new Set(contacts.map((contact) => contact.collectionName || contact.source || "Contacts"))].sort(), [contacts]);
  const timeZones = useMemo(() => {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
    return intl.supportedValuesOf?.("timeZone") ?? FALLBACK_TIMEZONES;
  }, []);

  const [recipientMode, setRecipientMode] = useState<"contacts" | "category">("contacts");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [name, setName] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState(() => nextLocalTime());
  const [timeZone, setTimeZone] = useState(() => typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC");


  const selectedTemplateId = templateId || emailTemplates[0]?.id || "";
  const selectedCollectionId = collectionId || collections[0]?._id || "";
  const selectedCategory = category || categories[0] || "";
  const visibleContacts = contacts.filter((contact) => {
    const term = search.trim().toLowerCase();
    const label = contact.collectionName || contact.source || "Contacts";
    return !term || contact.email.toLowerCase().includes(term) || label.toLowerCase().includes(term);
  });
  const activeTemplate = emailTemplates.find((template) => template.id === selectedTemplateId);
  const activeCollection = collections.find((collection) => collection._id === selectedCollectionId);
  const categoryCount = contacts.filter((contact) => (contact.collectionName || contact.source || "Contacts") === selectedCategory).length;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const siteSlug = account.data?.data?.username || "";
  const collectionLink = activeCollection && siteSlug
    ? publicCollectionUrl(siteSlug, activeCollection.slug || activeCollection._id, origin)
    : "";

  const toggleEmail = (email: string) => setSelectedEmails((current) => current.includes(email) ? current.filter((item) => item !== email) : [...current, email]);
  const toggleAllVisible = () => {
    const allSelected = visibleContacts.length > 0 && visibleContacts.every((contact) => selectedEmails.includes(contact.email));
    setSelectedEmails((current) => allSelected
      ? current.filter((email) => !visibleContacts.some((contact) => contact.email === email))
      : [...new Set([...current, ...visibleContacts.map((contact) => contact.email)])]);
  };

  const submit = async () => {
    if (!activeTemplate) return toast.error("Choose an email template");
    if (!activeCollection || !collectionLink) return toast.error("Choose a collection for the email button link");
    if (!scheduledLocal) return toast.error("Choose a schedule date and time");
    if (!timeZone) return toast.error("Choose a timezone");
    if (recipientMode === "contacts" && !selectedEmails.length) return toast.error("Choose at least one contact");
    if (recipientMode === "category" && !selectedCategory) return toast.error("Choose a contact category");
    try {
      await schedules.create.mutateAsync({
        name: name.trim() || `${activeTemplate.name} - ${activeCollection.name}`,
        recipientMode,
        recipientEmails: recipientMode === "contacts" ? selectedEmails : undefined,
        recipientCategory: recipientMode === "category" ? selectedCategory : undefined,
        templateId: activeTemplate.id,
        templateName: activeTemplate.name,
        subject: activeTemplate.subject || activeTemplate.title || "Gallery update",
        previewText: activeTemplate.previewText,
        message: activeTemplate.message || activeTemplate.previewText || activeTemplate.title,
        footerText: activeTemplate.footerText,
        eyebrowText: activeTemplate.eyebrowText,
        buttonText: activeTemplate.buttonText || "Open Gallery",
        buttonLink: collectionLink,
        buttonColor: activeTemplate.buttonColor,
        image: activeTemplate.image,
        showImage: activeTemplate.showImage,
        collectionId: activeCollection._id,
        collectionName: activeCollection.name,
        scheduledLocal,
        timeZone,
      });
      toast.success(`Campaign scheduled for ${scheduledLocal.replace("T", " ")} (${timeZone})`);
      onOpenChange(false);
      setSelectedEmails([]);
      setName("");
      setScheduledLocal(nextLocalTime());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not schedule campaign");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-none sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl"><CalendarDays className="size-6 text-[#6337d8]" />New email schedule</DialogTitle>
          <DialogDescription>Choose the audience, template, collection link, and the exact local time when the campaign should be sent.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-7 py-3">
          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Schedule name</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Summer gallery follow-up" className="h-11 rounded-none" /></label>

          <section className="border p-5">
            <div className="flex items-center justify-between gap-4"><div><h3 className="font-bold">Recipients</h3><p className="mt-1 text-xs text-[#777]">Send to selected contacts or an entire contact category.</p></div><Users className="size-5 text-[#6337d8]" /></div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRecipientMode("contacts")} className={`h-10 border text-sm font-bold ${recipientMode === "contacts" ? "border-[#6337d8] bg-[#f4f0ff] text-[#6337d8]" : "bg-white"}`}>Select contacts</button>
              <button type="button" onClick={() => setRecipientMode("category")} className={`h-10 border text-sm font-bold ${recipientMode === "category" ? "border-[#6337d8] bg-[#f4f0ff] text-[#6337d8]" : "bg-white"}`}>Contact category</button>
            </div>
            {recipientMode === "contacts" ? (
              <div className="mt-5">
                <div className="flex h-11 items-center gap-3 border px-3"><Search className="size-4 text-[#777]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contacts" className="h-9 border-0 p-0 focus-visible:ring-0" /></div>
                <div className="mt-3 flex items-center justify-between"><span className="text-xs font-semibold text-[#777]">{selectedEmails.length} selected</span><button type="button" onClick={toggleAllVisible} className="text-xs font-bold text-[#6337d8]">Select / clear visible</button></div>
                <div className="mt-3 max-h-48 overflow-y-auto border">
                  {visibleContacts.map((contact) => {
                    const checked = selectedEmails.includes(contact.email);
                    return <label key={contact._id} className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-[#fafafa]"><Checkbox checked={checked} onCheckedChange={() => toggleEmail(contact.email)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{contact.email}</span><span className="block truncate text-xs text-[#888]">{contact.collectionName || contact.source || "Contacts"}</span></span>{checked && <Check className="size-4 text-[#6337d8]" />}</label>;
                  })}
                  {!visibleContacts.length && <p className="p-5 text-sm text-[#777]">No subscribed contacts found.</p>}
                </div>
              </div>
            ) : (
              <label className="mt-5 grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Category</span><select value={selectedCategory} onChange={(event) => setCategory(event.target.value)} className="h-11 border bg-white px-3 text-sm">{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select><span className="text-xs text-[#777]">{categoryCount} subscribed contact{categoryCount === 1 ? "" : "s"} currently in this category.</span></label>
            )}
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Email template</span><select value={selectedTemplateId} onChange={(event) => setTemplateId(event.target.value)} className="h-11 border bg-white px-3 text-sm">{emailTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Button opens collection</span><select value={selectedCollectionId} onChange={(event) => setCollectionId(event.target.value)} className="h-11 border bg-white px-3 text-sm">{collections.map((collection) => <option key={collection._id} value={collection._id}>{collection.name}</option>)}</select></label>
          </div>

          <section className="grid gap-5 border bg-[#faf9fc] p-5 sm:grid-cols-2">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Local send date & time</span><Input type="datetime-local" value={scheduledLocal} onChange={(event) => setScheduledLocal(event.target.value)} className="h-11 rounded-none bg-white" /></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Client timezone</span><Input list="marketing-timezones" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="h-11 rounded-none bg-white" /><datalist id="marketing-timezones">{timeZones.map((zone) => <option key={zone} value={zone} />)}</datalist></label>
            <div className="sm:col-span-2 border-l-2 border-[#6337d8] pl-4 text-sm leading-6 text-[#666]">The server stores this safely in UTC, but it will send at <strong>{scheduledLocal ? scheduledLocal.replace("T", " ") : "your chosen time"}</strong> in <strong>{timeZone || "your timezone"}</strong>.</div>
          </section>

          {collectionLink && <div className="border p-4 text-xs"><span className="font-bold text-[#777]">Collection button link</span><p className="mt-2 break-all text-[#333]">{collectionLink}</p></div>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" className="rounded-none bg-[#6337d8] px-7 text-white hover:bg-[#542bc2]" onClick={() => void submit()} disabled={schedules.create.isPending || contactsQuery.isLoading || collectionsQuery.isLoading || account.isLoading}>
            {schedules.create.isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
            {schedules.create.isPending ? "Scheduling..." : "Schedule campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function nextLocalTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

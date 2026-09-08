"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Loader2, MailCheck, PencilLine, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { GetRequestNormal } from "@/api-hooks/api-hooks";
import { useAccount } from "@/api-hooks/use-account";
import { useCollections } from "@/api-hooks/use-collections";
import { useMarketingAutomations, type CreateMarketingAutomationPayload, type MarketingAutomationRecord, type MarketingAutomationTrigger } from "@/api-hooks/use-marketing-automations";
import { useDashboardStore, type EmailTemplateItem } from "@/lib/dashboard-store";
import { publicCollectionUrl } from "@/lib/public-site-url";
import { AutomationEmailEditorDialog } from "@/components/dashboard/automation-email-editor-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DELAY_UNITS = [
  { value: "minutes", label: "Minutes", factor: 1 },
  { value: "hours", label: "Hours", factor: 60 },
  { value: "days", label: "Days", factor: 1440 },
] as const;

const AUTOMATION_TRIGGERS: Array<{ value: MarketingAutomationTrigger; label: string; description: string }> = [
  { value: "new-subscriber", label: "New subscriber", description: "When a client opts in to marketing." },
  { value: "gallery-published", label: "Gallery published", description: "When a draft gallery is published, send only to that gallery's selected Publish Recipients." },
  { value: "client-download", label: "Download ready", description: "After the requested files are prepared, email the client their secure download button. The link expires 30 hours after preparation." },
  { value: "client-favorite", label: "Client favorite", description: "The first time that client adds a favorite in a gallery for this automation." },
];

function triggerLabel(trigger: MarketingAutomationTrigger) {
  return AUTOMATION_TRIGGERS.find((item) => item.value === trigger)?.label || "Automation";
}

type Contact = { _id: string; email: string; collectionName?: string; source?: string };
type ContactsResponse = { data: Contact[] };
export function MarketingAutomationPanel() {
  const { emailTemplates } = useDashboardStore();
  const automations = useMarketingAutomations();
  const { collectionsQuery } = useCollections();
  const account = useAccount().query;
  const contactsQuery = useQuery({
    queryKey: ["marketing-contacts"],
    queryFn: () => GetRequestNormal<ContactsResponse>("/collections/marketing-contacts"),
  });
  const contacts = useMemo(
    () => Array.isArray(contactsQuery.data?.data) ? contactsQuery.data.data : [],
    [contactsQuery.data],
  );
  const categories = useMemo(
    () => [...new Set(contacts.map((contact) => contact.collectionName || contact.source || "Contacts"))].sort(),
    [contacts],
  );
  const rows = Array.isArray(automations.query.data?.data) ? automations.query.data.data : [];
  const [open, setOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<MarketingAutomationRecord | null>(null);

  const toggle = async (id: string, enabled: boolean) => {
    try {
      await automations.update.mutateAsync({ id, patch: { enabled } });
      toast.success(enabled ? "Automation enabled" : "Automation paused");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Automation update failed");
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this automation? Future queued emails will be cancelled.")) return;
    try {
      await automations.remove.mutateAsync(id);
      toast.success("Automation deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Automation delete failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b pb-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6337d8]">Lifecycle email</p>
          <h1 className="mt-2 text-[28px] font-medium leading-none">Marketing Automations</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666]">
            Automate subscriber, gallery-published, download, and favorite emails. Marketing opt-in is re-checked for subscriber campaigns; gallery lifecycle emails are transactional and still use your monthly email allowance.
          </p>
        </div>
        <Button className="h-11 rounded-none bg-[#6337d8] px-6 font-bold text-white hover:bg-[#542bc2]" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New Automation
        </Button>
      </div>

      <div className="mt-8 grid gap-4">
        {automations.query.isLoading ? (
          <div className="flex min-h-56 items-center justify-center border bg-white text-[#777]"><Loader2 className="mr-2 size-5 animate-spin" />Loading automations...</div>
        ) : rows.length ? rows.map((item) => {
          const stats = item.stats ?? {};
          const queued = Number(stats.scheduled ?? 0) + Number(stats.sending ?? 0);
          return (
            <article key={item._id} className="grid gap-5 border bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[#f1ecff] text-[#6337d8]"><Sparkles className="size-5" /></span>
                  <div className="min-w-0"><h2 className="truncate text-lg font-bold">{item.name}</h2><p className="mt-1 text-xs text-[#777]">{triggerLabel(item.trigger)} → {item.trigger === "client-download" ? "after files are ready" : delayLabel(item.delayMinutes)} → {item.templateName}</p></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#666]">
                  <span><b className="text-[#222]">Audience:</b> {item.trigger === "new-subscriber" ? item.recipientCategory || "All opted-in clients" : item.trigger === "gallery-published" ? "Selected publish recipients" : item.trigger === "client-download" ? "Client who requested the download" : "Client who performs the action"}</span>
                  {item.collectionName && <span><b className="text-[#222]">Link:</b> {item.collectionName}</span>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <Stat label="Queued" value={queued} />
                  <Stat label="Sent" value={Number(stats.sent ?? 0)} />
                  <Stat label="Failed" value={Number(stats.failed ?? 0)} />
                  <Stat label="Cancelled" value={Number(stats.cancelled ?? 0)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                <label className="flex items-center gap-3 text-sm font-semibold"><Switch checked={item.enabled} onCheckedChange={(value) => void toggle(item._id, value)} /><span>{item.enabled ? "Active" : "Paused"}</span></label>
                <Button type="button" variant="outline" className="h-10 rounded-none px-4 text-xs font-bold" onClick={() => setEditingAutomation(item)}>
                  <PencilLine className="size-4" /> Edit email
                </Button>
                <button type="button" onClick={() => void remove(item._id)} className="flex size-10 items-center justify-center border text-[#777] hover:border-red-300 hover:text-red-600" aria-label={`Delete ${item.name}`}><Trash2 className="size-4" /></button>
              </div>
            </article>
          );
        }) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center border border-dashed bg-white p-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#f1ecff] text-[#6337d8]"><MailCheck className="size-7" /></span>
            <h2 className="mt-5 text-xl font-bold">No automations yet</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#666]">Create a welcome or follow-up email that starts automatically when a client subscribes.</p>
            <Button className="mt-6 rounded-none bg-[#6337d8] text-white" onClick={() => setOpen(true)}>Create first automation</Button>
          </div>
        )}
      </div>

      <AutomationDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        contactsCount={contacts.length}
        collections={Array.isArray(collectionsQuery.data?.data) ? collectionsQuery.data.data : []}
        emailTemplates={emailTemplates}
        siteSlug={account.data?.data?.username || ""}
        busy={automations.create.isPending}
        onCreate={(payload) => automations.create.mutateAsync(payload)}
      />
      {editingAutomation && (
        <AutomationEmailEditorDialog
          key={editingAutomation._id}
          automation={editingAutomation}
          emailTemplates={emailTemplates}
          busy={automations.update.isPending}
          onClose={() => setEditingAutomation(null)}
          onSave={(patch) => automations.update.mutateAsync({ id: editingAutomation._id, patch })}
        />
      )}
    </div>
  );
}
function AutomationDialog({ open, onOpenChange, categories, contactsCount, collections, emailTemplates, siteSlug, busy, onCreate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  contactsCount: number;
  collections: Array<{ _id: string; name: string; slug?: string }>;
  emailTemplates: EmailTemplateItem[];
  siteSlug: string;
  busy: boolean;
  onCreate: (payload: CreateMarketingAutomationPayload) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<MarketingAutomationTrigger>("new-subscriber");
  const [category, setCategory] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [delay, setDelay] = useState(1);
  const [unit, setUnit] = useState<(typeof DELAY_UNITS)[number]["value"]>("hours");
  const [includeExisting, setIncludeExisting] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const selectedTemplateId = templateId || emailTemplates[0]?.id || "";
  const activeTemplate = emailTemplates.find((item) => item.id === selectedTemplateId);
  const activeCollection = collections.find((item) => item._id === collectionId);
  const submit = async () => {
    if (!activeTemplate) return toast.error("Choose an email template");
    const factor = DELAY_UNITS.find((item) => item.value === unit)?.factor ?? 60;
    const delayMinutes = trigger === "client-download"
      ? 0
      : Math.min(525600, Math.max(0, Math.floor(Number(delay) || 0) * factor));
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const collectionLink = activeCollection && siteSlug
      ? publicCollectionUrl(siteSlug, activeCollection.slug || activeCollection._id, origin)
      : activeTemplate.buttonLink === "Collection URL" ? "" : activeTemplate.buttonLink || "";
    try {
      await onCreate({
        name: name.trim() || `${activeTemplate.name} · ${triggerLabel(trigger)}`,
        trigger,
        enabled,
        recipientCategory: trigger === "new-subscriber" ? category || undefined : undefined,
        delayMinutes,
        includeExistingContacts: trigger === "new-subscriber" ? includeExisting : false,
        templateId: activeTemplate.id,
        templateName: activeTemplate.name,
        subject: activeTemplate.subject || activeTemplate.title || "Gallery update",
        previewText: activeTemplate.previewText,
        message: activeTemplate.message || activeTemplate.previewText || activeTemplate.title,
        footerText: activeTemplate.footerText,
        eyebrowText: activeTemplate.eyebrowText,
        buttonText: activeTemplate.buttonText || (collectionLink ? "Open Gallery" : ""),
        buttonLink: collectionLink,
        buttonColor: activeTemplate.buttonColor,
        image: activeTemplate.image,
        showImage: activeTemplate.showImage,
        collectionId: activeCollection?._id,
        collectionName: activeCollection?.name,
      });
      toast.success("Marketing automation created");
      onOpenChange(false);
      setName("");
      setTrigger("new-subscriber");
      setCategory("");
      setCollectionId("");
      setIncludeExisting(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Automation could not be created");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-none sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl"><Sparkles className="size-6 text-[#6337d8]" />New marketing automation</DialogTitle>
          <DialogDescription>Choose a lifecycle trigger, template, optional gallery scope, and delay. Subscriber automations require marketing opt-in; gallery lifecycle emails are transactional.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-3">
          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Automation name</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New client welcome" className="h-11 rounded-none" /></label>
          <section className="border bg-[#faf9fc] p-5">
            <div className="flex items-start justify-between gap-5"><div><p className="font-bold">Trigger</p><p className="mt-1 text-sm text-[#666]">{AUTOMATION_TRIGGERS.find((item) => item.value === trigger)?.description}</p></div><MailCheck className="size-5 text-[#6337d8]" /></div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Lifecycle trigger</span><select value={trigger} onChange={(event) => setTrigger(event.target.value as MarketingAutomationTrigger)} className="h-11 border bg-white px-3 text-sm">{AUTOMATION_TRIGGERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Email template</span><select value={selectedTemplateId} onChange={(event) => setTemplateId(event.target.value)} className="h-11 border bg-white px-3 text-sm"><option value="" disabled>Choose template</option>{emailTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.galleryCategory || "General"} · {template.language || "English"}</option>)}</select></label>
            </div>
            {trigger === "new-subscriber" && <label className="mt-5 grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Subscriber audience</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 border bg-white px-3 text-sm"><option value="">All opted-in clients</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
          </section>

          <section className="border p-5">
            <div className="flex items-center gap-3"><Clock3 className="size-5 text-[#6337d8]" /><div><p className="font-bold">{trigger === "client-download" ? "Delivery timing" : "Send delay"}</p><p className="mt-1 text-xs text-[#777]">{trigger === "client-download" ? "The email sends as soon as the backend finishes preparing the requested archive, so the 30-hour link does not waste time waiting in a queue." : "Wait after the selected trigger happens before sending."}</p></div></div>
            {trigger !== "client-download" && <div className="mt-5 grid grid-cols-[minmax(0,1fr)_160px] gap-3"><Input type="number" min={0} max={365} value={delay} onChange={(event) => setDelay(Math.max(0, Number(event.target.value) || 0))} className="h-11 rounded-none" /><select value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)} className="h-11 border bg-white px-3 text-sm">{DELAY_UNITS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>}
          </section>
          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">{trigger === "new-subscriber" ? "Button opens collection (optional)" : "Gallery scope"}</span><select value={collectionId} onChange={(event) => setCollectionId(event.target.value)} className="h-11 border bg-white px-3 text-sm"><option value="">{trigger === "new-subscriber" ? "Use template link / no gallery link" : "All galleries · use event gallery link"}</option>{collections.map((collection) => <option key={collection._id} value={collection._id}>{collection.name}</option>)}</select></label>

          <div className="grid gap-4 border p-5 sm:grid-cols-2">
            {trigger === "new-subscriber" ? (
              <label className="flex cursor-pointer items-start gap-3"><Checkbox checked={includeExisting} onCheckedChange={(value) => setIncludeExisting(Boolean(value))} /><span><span className="block text-sm font-bold">Include current subscribers once</span><span className="mt-1 block text-xs leading-5 text-[#777]">Off by default. When enabled, current opted-in contacts are queued as well as future subscribers.</span></span></label>
            ) : trigger === "client-download" ? (
              <div className="text-sm leading-6 text-[#666]"><b className="text-[#222]">Per request:</b> each completed download request gets its own secure email link. The request itself is the dedupe boundary, so a client can intentionally request a fresh link later.</div>
            ) : (
              <div className="text-sm leading-6 text-[#666]"><b className="text-[#222]">Anti-spam:</b> this lifecycle automation sends once per client and gallery for the same lifecycle event.</div>
            )}
            <label className="flex cursor-pointer items-start gap-3"><Switch checked={enabled} onCheckedChange={setEnabled} /><span><span className="block text-sm font-bold">Start active</span><span className="mt-1 block text-xs leading-5 text-[#777]">Pause it any time from the automation list.</span></span></label>
          </div>

          <div className="flex items-start gap-3 border-l-2 border-[#6337d8] bg-[#f7f4ff] px-4 py-3 text-sm leading-6 text-[#5d5472]"><Users className="mt-0.5 size-4 shrink-0" /><span>{trigger === "new-subscriber" ? (category ? `Only new subscribers in ${category} will enter this automation.` : `All new opted-in clients can enter this automation. ${contactsCount} contacts are currently subscribed.`) : trigger === "gallery-published" ? "Only the Publish Recipients selected on the matching gallery receive this message. Those emails also have gallery email access automatically." : trigger === "client-download" ? "The client who requested the files receives this email only after the archive is ready. The email button is always replaced with that request's secure 30-hour download link." : "The client email recorded by the favorite action receives this message."}</span></div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" className="rounded-none bg-[#6337d8] px-7 text-white hover:bg-[#542bc2]" disabled={busy || !activeTemplate} onClick={() => void submit()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{busy ? "Creating..." : "Create automation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <span className="border bg-[#fafafa] px-3 py-1.5 text-[#666]"><b className="text-[#222]">{value}</b> {label}</span>;
}

function delayLabel(minutes: number) {
  const value = Math.max(0, Number(minutes) || 0);
  if (value === 0) return "immediately";
  if (value % 1440 === 0) return `${value / 1440} day${value === 1440 ? "" : "s"}`;
  if (value % 60 === 0) return `${value / 60} hour${value === 60 ? "" : "s"}`;
  return `${value} minute${value === 1 ? "" : "s"}`;
}

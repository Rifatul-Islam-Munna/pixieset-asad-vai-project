from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "frontend/components/dashboard/client-dashboard.tsx"
STORE = ROOT / "frontend/lib/dashboard-store.ts"
PUBLIC = ROOT / "frontend/components/dashboard/public-gallery.tsx"
CONTACTS = ROOT / "frontend/components/dashboard/marketing-contacts-grid.tsx"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# Add a collection-level switch that controls subscription surfaces.
store = STORE.read_text(encoding="utf-8")
store = replace_once(
    store,
    "  emailRegistration: boolean;\n  galleryAssist: boolean;",
    "  emailRegistration: boolean;\n  marketingSubscription: boolean;\n  galleryAssist: boolean;",
    "general settings type",
)
store = replace_once(
    store,
    "  emailRegistration: false,\n  galleryAssist: false,",
    "  emailRegistration: false,\n  marketingSubscription: true,\n  galleryAssist: false,",
    "general settings defaults",
)
STORE.write_text(store, encoding="utf-8")


public = PUBLIC.read_text(encoding="utf-8")
public = replace_once(
    public,
    "      emailRegistration?: boolean | string;\n      galleryAssist?: boolean | string;",
    "      emailRegistration?: boolean | string;\n      marketingSubscription?: boolean | string;\n      galleryAssist?: boolean | string;",
    "public collection marketing subscription type",
)
public = replace_once(
    public,
    "  const emailRegistrationEnabled = boolSetting(generalSettings.emailRegistration);\n  const marketing = collection?.marketing ?? {};",
    "  const emailRegistrationEnabled = boolSetting(generalSettings.emailRegistration);\n  const marketingSubscriptionEnabled = boolSetting(\n    generalSettings.marketingSubscription ?? true,\n  );\n  const marketing = collection?.marketing ?? {};",
    "public collection marketing subscription setting",
)
public = replace_once(
    public,
    "  const [popupOpen, setPopupOpen] = useState(() => Boolean(marketingPopup.enabled));",
    "  const [popupOpen, setPopupOpen] = useState(() =>\n    Boolean(marketingSubscriptionEnabled && marketingPopup.enabled),\n  );",
    "marketing popup initial state",
)
public = replace_once(
    public,
    "        Boolean(marketingOptIn.emailRegistration && visitorMarketingOptIn),",
    "        Boolean(\n          marketingSubscriptionEnabled &&\n            marketingOptIn.emailRegistration &&\n            visitorMarketingOptIn,\n        ),",
    "email registration subscription payload",
)
public = replace_once(
    public,
    "    if (!collection || !marketingPopup.enabled) return;\n    const key = `gallery-marketing-popup:${collection._id}`;\n    if (!window.sessionStorage.getItem(key)) setPopupOpen(true);\n  }, [collection?._id, marketingPopup.enabled]);",
    "    if (!collection || !marketingSubscriptionEnabled || !marketingPopup.enabled) {\n      setPopupOpen(false);\n      return;\n    }\n    const key = `gallery-marketing-popup:${collection._id}`;\n    if (!window.sessionStorage.getItem(key)) setPopupOpen(true);\n  }, [collection?._id, marketingPopup.enabled, marketingSubscriptionEnabled]);",
    "marketing popup effect",
)
public = replace_once(
    public,
    "      {popupOpen && marketingPopup.enabled && (",
    "      {popupOpen && marketingSubscriptionEnabled && marketingPopup.enabled && (",
    "marketing popup render guard",
)
public = replace_once(
    public,
    "          {marketingOptIn.emailRegistration && (",
    "          {marketingSubscriptionEnabled && marketingOptIn.emailRegistration && (",
    "email modal subscription checkbox guard",
)
PUBLIC.write_text(public, encoding="utf-8")


dashboard = DASHBOARD.read_text(encoding="utf-8")
old_contacts = '''  if (marketingPage === "contacts") {
    return (
      <div>
        <PageHeader action="Upload Contacts" title="Contacts" />
        <div className="mt-12 grid gap-5 md:grid-cols-[360px_1fr]">
          <div className="border bg-[#fafafa] p-8">
            <FileUp className="size-9 text-[#22bda7]" />
            <h2 className="mt-5 text-lg font-bold">Upload contact list</h2>
            <p className="mt-3 text-sm leading-6 text-[#555]">
              Import a CSV list to start sending campaigns.
            </p>
            <Input type="file" className="mt-6 h-12 rounded-none bg-white" />
          </div>
          <MarketingContactsGrid />
        </div>
      </div>
    );
  }'''
new_contacts = '''  if (marketingPage === "contacts") {
    return (
      <div className="mx-auto w-full max-w-[1240px]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-7">
          <div>
            <PageHeader title="Marketing Contacts" />
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666]">
              Review everyone who subscribed from an email registration form,
              gallery pop-up, download, favorite sign-in, or checkout.
            </p>
          </div>
          <Link
            href="/dashboard/client-gallery/marketing/settings"
            className="inline-flex h-10 items-center gap-2 border bg-white px-4 text-sm font-bold text-[#222] hover:border-[#22bda7] hover:text-[#009b8c]"
          >
            <Settings className="size-4" />
            Subscription settings
          </Link>
        </div>
        <MarketingContactsGrid />
      </div>
    );
  }'''
dashboard = replace_once(dashboard, old_contacts, new_contacts, "marketing contacts page")

start = dashboard.index("function MarketingSettingsPanel(")
end = dashboard.index("function MarketingCheck(", start)
new_settings_panel = '''function MarketingSettingsPanel({
  query,
  saveSetting,
}: {
  query: any;
  saveSetting: any;
}) {
  const saved =
    query.data?.data?.find((item) => item.localId === "gallery-marketing")?.data ??
    defaultMarketingSettings;
  const [form, setForm] = useState<MarketingSettings>(saved);

  useEffect(() => {
    setForm({
      optIn: { ...defaultMarketingSettings.optIn, ...saved.optIn },
      popup: { ...defaultMarketingSettings.popup, ...saved.popup },
    });
  }, [
    saved.optIn?.emailRegistration,
    saved.optIn?.storeCheckout,
    saved.optIn?.download,
    saved.optIn?.favoriteSignIn,
    saved.popup?.enabled,
    saved.popup?.title,
    saved.popup?.body,
    saved.popup?.button,
    saved.popup?.imageUrl,
  ]);

  const updateOptIn = (key: keyof MarketingSettings["optIn"], value: boolean) =>
    setForm((current) => ({
      ...current,
      optIn: { ...current.optIn, [key]: value },
    }));
  const updatePopup = (
    key: keyof MarketingSettings["popup"],
    value: string | boolean,
  ) =>
    setForm((current) => ({
      ...current,
      popup: { ...current.popup, [key]: value },
    }));
  const save = () => {
    saveSetting.mutate(
      { localId: "gallery-marketing", name: "Gallery Marketing", data: form },
      {
        onSuccess: () => toast.success("Marketing settings saved"),
        onError: (error) => toast.error(error.message),
      },
    );
  };
  const activeSources = Object.values(form.optIn).filter(Boolean).length;

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b pb-7">
        <div>
          <PageHeader title="Marketing Settings" />
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666]">
            Control where visitors can subscribe and customise the subscription
            form shown inside your public collections.
          </p>
        </div>
        <Button
          className="h-11 rounded-none bg-[#22bda7] px-8 text-sm font-bold text-white hover:bg-[#19a995]"
          disabled={saveSetting.isPending}
          onClick={save}
        >
          {saveSetting.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saveSetting.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-7">
          <section className="overflow-hidden border bg-white">
            <div className="border-b bg-[#f4fbf9] px-6 py-5">
              <div className="flex items-start justify-between gap-5">
                <div className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#009b8c] shadow-sm">
                    <MailCheck className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold">Email registration subscription</h2>
                    <p className="mt-2 text-sm leading-6 text-[#5d6b68]">
                      Show an optional “Subscribe to updates and special offers”
                      checkbox inside the collection email-registration modal.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.optIn.emailRegistration}
                  onCheckedChange={(value) =>
                    updateOptIn("emailRegistration", value)
                  }
                />
              </div>
            </div>
            <div className="px-6 py-5 text-sm leading-6 text-[#666]">
              This appears only when both <strong>Email Registration</strong> and
              <strong> Marketing Subscription</strong> are enabled in that
              collection’s Privacy settings.
            </div>
          </section>

          <section className="border bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f4eeee] text-[#444]">
                  <Megaphone className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Gallery subscription pop-up</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#666]">
                    Invite collection visitors to subscribe with a clean pop-up
                    form. Each collection can enable or disable marketing
                    subscription independently.
                  </p>
                </div>
              </div>
              <Switch
                checked={form.popup.enabled}
                onCheckedChange={(value) => updatePopup("enabled", value)}
              />
            </div>

            <div className="mt-7 grid gap-5 border-t pt-7 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel className="font-bold">Headline</FieldLabel>
                <Input
                  value={form.popup.title}
                  onChange={(event) => updatePopup("title", event.target.value)}
                  className="h-12 rounded-none bg-white"
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel className="font-bold">Message</FieldLabel>
                <Textarea
                  value={form.popup.body}
                  maxLength={200}
                  onChange={(event) => updatePopup("body", event.target.value)}
                  className="min-h-32 rounded-none bg-white p-4"
                />
                <p className="text-right text-xs text-[#888]">
                  {form.popup.body.length} / 200
                </p>
              </Field>
              <Field>
                <FieldLabel className="font-bold">Button label</FieldLabel>
                <Input
                  value={form.popup.button}
                  onChange={(event) => updatePopup("button", event.target.value)}
                  className="h-12 rounded-none bg-white"
                />
              </Field>
              <Field>
                <FieldLabel className="font-bold">Image URL</FieldLabel>
                <Input
                  value={form.popup.imageUrl}
                  onChange={(event) => updatePopup("imageUrl", event.target.value)}
                  placeholder="https://..."
                  className="h-12 rounded-none bg-white"
                />
              </Field>
            </div>
          </section>

          <section className="border bg-white p-6">
            <div className="flex items-center justify-between gap-5">
              <div>
                <h2 className="text-lg font-bold">Other subscription points</h2>
                <p className="mt-2 text-sm leading-6 text-[#666]">
                  Choose which visitor actions may include an optional marketing
                  subscription checkbox.
                </p>
              </div>
              <span className="rounded-full bg-[#eef8f6] px-3 py-1 text-xs font-bold text-[#008f80]">
                {activeSources} active
              </span>
            </div>
            <div className="mt-6 divide-y border">
              {([
                ["storeCheckout", ShoppingCart, "Store checkout", "Let customers subscribe during checkout."],
                ["download", Download, "Photo and video download", "Offer subscription when an email is collected for downloads."],
                ["favoriteSignIn", Heart, "Favorite sign-in", "Offer subscription when visitors identify themselves for favorites."],
              ] as const).map(([key, Icon, label, text]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-4 px-4 py-4 hover:bg-[#fafafa]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center bg-[#f4f4f4] text-[#555]">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#777]">
                      {text}
                    </span>
                  </span>
                  <Switch
                    checked={form.optIn[key]}
                    onCheckedChange={(value) => updateOptIn(key, value)}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">
              Live preview
            </p>
            <span className="text-xs text-[#999]">Public collection</span>
          </div>
          <MarketingPopupPreview settings={form} />
          <Link
            href="/dashboard/client-gallery/marketing/contacts"
            className="mt-4 flex items-center justify-between border bg-white px-5 py-4 text-sm font-bold hover:border-[#22bda7]"
          >
            View subscribed contacts
            <ArrowRight className="size-4 text-[#00a997]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

'''
dashboard = dashboard[:start] + new_settings_panel + dashboard[end:]

email_registration_block = '''                    <SettingSwitch
                      label="Email Registration"
                      checked={form.general.emailRegistration}
                      onCheckedChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          general: { ...current.general, emailRegistration: value },
                        }))
                      }
                      text="Require visitors to enter email before viewing photos."
                    />'''
marketing_subscription_block = email_registration_block + '''
                    <div className="border bg-[#fafafa] p-5">
                      <div className="flex items-start justify-between gap-5">
                        <div>
                          <p className="font-bold">Marketing Subscription</p>
                          <p className="mt-2 max-w-xl text-sm leading-6 text-[#666]">
                            Show the optional subscription checkbox in Email
                            Registration and allow the marketing subscription
                            pop-up for this collection.
                          </p>
                        </div>
                        <Switch
                          checked={form.general.marketingSubscription !== false}
                          onCheckedChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              general: {
                                ...current.general,
                                marketingSubscription: value,
                              },
                            }))
                          }
                        />
                      </div>
                      <Link
                        href="/dashboard/client-gallery/marketing/settings"
                        className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#00a997]"
                      >
                        Configure subscription form and opt-in locations
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>'''
dashboard = replace_once(
    dashboard,
    email_registration_block,
    marketing_subscription_block,
    "collection marketing subscription switch",
)
DASHBOARD.write_text(dashboard, encoding="utf-8")


CONTACTS.write_text('''"use client";

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
  return value.replace(/-/g, " ").replace(/\\b\\w/g, (letter) => letter.toUpperCase());
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
    const csv = rows.map((row) => row.map((value) => escape(String(value))).join(",")).join("\\n");
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
''', encoding="utf-8")

print("Marketing settings, collection subscription controls, public gallery, and contacts UI updated")

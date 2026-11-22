"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, Check, ChevronDown, Loader2, Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { studioCreate, studioList, type StudioRecord } from "@/actions/studio";

const PROJECTS_URL = "/dashboard/studio-management/projects";
const INPUT = "h-[49px] w-full border border-[#e5e2e9] bg-white px-5 text-[13px] text-[#26222c] outline-none transition placeholder:text-[#98939d] focus:border-[#6337d8] focus:ring-1 focus:ring-[#6337d8]/10";
const LABEL = "mb-3 block text-[13px] font-semibold text-[#24202b]";
const BUTTON = "inline-flex h-[42px] items-center justify-center gap-2 bg-[#6337d8] px-6 text-[12px] font-semibold text-white transition hover:bg-[#542abb] disabled:cursor-not-allowed disabled:opacity-50";
const TYPE_OPTIONS = [
  ["portrait", "Portrait"], ["wedding", "Wedding"], ["event", "Event"],
  ["commercial", "Commercial"], ["other", "Other"],
] as const;

function suggestedName(query: string) {
  const text = query.trim();
  if (!text || text.includes("@")) return { first: "", last: "", email: text.includes("@") ? text : "" };
  const parts = text.split(/\s+/);
  return { first: parts[0] || "", last: parts.slice(1).join(" "), email: "" };
}

export function StudioProjectCreate({
  onCreated,
}: {
  onCreated: (project: StudioRecord) => Promise<void>;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<StudioRecord | null>(null);
  const [results, setResults] = useState<StudioRecord[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const [showNewContact, setShowNewContact] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("portrait");
  const [savingContact, setSavingContact] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [error, setError] = useState("");
  const [contactError, setContactError] = useState("");
  const searchArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen || selectedClient || showNewContact) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingContacts(true);
      void studioList("contacts", { search: clientSearch.trim(), limit: 20 })
        .then((data) => {
          if (active) {
            setResults(data.items);
            setActiveOption(-1);
          }
        })
        .catch(() => {
          if (active) setContactError("Could not search Contacts. Please try again.");
        })
        .finally(() => {
          if (active) setLoadingContacts(false);
        });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [clientSearch, searchOpen, selectedClient, showNewContact]);

  useEffect(() => {
    if (!searchOpen) return;
    const close = (event: PointerEvent) => {
      if (!searchArea.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [searchOpen]);

  const chooseClient = (contact: StudioRecord) => {
    setSelectedClient(contact);
    setClientSearch(contact.title);
    setShowNewContact(false);
    setSearchOpen(false);
    setError("");
    setContactError("");
    setActiveOption(-1);
  };

  const startNewContact = () => {
    const proposed = suggestedName(clientSearch);
    setFirstName(proposed.first);
    setLastName(proposed.last);
    setEmail(proposed.email);
    setPhone("");
    setShowNewContact(true);
    setSearchOpen(false);
    setContactError("");
    setError("");
  };

  const handleSearchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveOption((value) => Math.min(value + 1, results.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveOption((value) => Math.max(-1, value - 1));
      return;
    }
    if (event.key === "Enter" && searchOpen) {
      event.preventDefault();
      if (activeOption >= 0 && results[activeOption]) chooseClient(results[activeOption]);
      else if (results.length === 1) chooseClient(results[0]);
      else if (results.length === 0 && clientSearch.trim() && !loadingContacts) startNewContact();
    }
  };

  const createContact = async (event: FormEvent) => {
    event.preventDefault();
    if (savingContact || savingProject) return;
    setContactError("");
    const first = firstName.trim();
    const last = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!first) {
      setContactError("Please enter the client's first name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setContactError("Please enter a valid email address.");
      return;
    }
    setSavingContact(true);
    try {
      // If the email already belongs to a saved contact, reuse it rather than creating a duplicate.
      const matches = await studioList("contacts", { search: normalizedEmail, limit: 20 });
      const existing = matches.items.find((record) => record.email?.toLowerCase() === normalizedEmail);
      if (existing) {
        chooseClient(existing);
        toast.info("This email is already in Contacts. We selected that contact.");
        return;
      }
      const record = await studioCreate("contacts", {
        title: [first, last].filter(Boolean).join(" "),
        type: "client",
        status: "client",
        email: normalizedEmail,
        phone: phone.trim(),
        details: { firstName: first, lastName: last, source: "project-creation" },
      });
      chooseClient(record);
      toast.success("Contact created and selected");
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Could not create contact");
    } finally {
      setSavingContact(false);
    }
  };

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (savingContact || savingProject) return;
    setError("");
    if (!selectedClient?._id) {
      setError("Choose an existing contact or create a new contact first.");
      setSearchOpen(true);
      return;
    }
    if (!projectName.trim()) {
      setError("Please enter a project name.");
      return;
    }
    setSavingProject(true);
    try {
      const project = await studioCreate("projects", {
        title: projectName.trim(),
        type: projectType,
        status: "inquiry",
        contactId: selectedClient._id,
      });
      toast.success("Project created for " + selectedClient.title);
      await onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
      setSavingProject(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] pb-28 pt-8 sm:pt-12">
      <Link href={PROJECTS_URL}
        className="mb-10 inline-flex items-center gap-2 text-[12px] font-medium text-[#817b89] transition hover:text-[#6337d8]">
        <ArrowLeft className="size-4" /> Back to Projects
      </Link>

      <h1 className="mb-9 text-[25px] font-medium tracking-[-.035em] text-[#211e27] sm:text-[27px]">
        Create a new project
      </h1>

      <div className="space-y-9">
        <section>
          <label htmlFor="new-project-client-search" className={LABEL}>Client <span className="text-[#ba7181]">*</span></label>
          {selectedClient ? (
            <div className="flex min-h-[56px] items-center justify-between gap-3 border border-[#cfc1f0] bg-[#faf8ff] px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ece5fb] text-[#6337d8]">
                  <UserRound className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#302b38]">{selectedClient.title}</p>
                  <p className="truncate text-[11px] text-[#837c8b]">{selectedClient.email}</p>
                </div>
              </div>
              <button type="button" aria-label="Change selected client" title="Change client" disabled={savingProject}
                onClick={() => {setSelectedClient(null);setClientSearch("");setSearchOpen(true);setResults([]);}}
                className="inline-flex shrink-0 items-center gap-1.5 px-2 py-2 text-[12px] font-semibold text-[#6337d8] hover:bg-[#eee8fb]">
                Change <X className="size-3.5"/>
              </button>
            </div>
          ) : (
            <div ref={searchArea} className="relative">
              <Search className="pointer-events-none absolute left-4 top-[17px] size-4 text-[#a59fad]"/>
              <input
                id="new-project-client-search"
                type="text"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={searchOpen}
                aria-controls="new-project-client-options"
                aria-activedescendant={activeOption >= 0 ? "new-project-contact-" + activeOption : undefined}
                placeholder="Type a contact name or email"
                value={clientSearch}
                disabled={savingContact || savingProject}
                maxLength={100}
                onChange={(e) => {setClientSearch(e.target.value);setResults([]);setActiveOption(-1);setLoadingContacts(true);setSearchOpen(true);setContactError("");}}
                onFocus={() => {setSearchOpen(true);setLoadingContacts(true);}}
                onKeyDown={handleSearchKeys}
                className={INPUT + " pl-11"}
              />
              {searchOpen && !showNewContact && (
                <div id="new-project-client-options" role="listbox" aria-label="Matching Contacts"
                  className="absolute inset-x-0 top-full z-30 mt-1 max-h-[290px] overflow-y-auto border border-[#e8e3ee] bg-white py-1 shadow-[0_16px_45px_rgba(41,31,53,.12)]">
                  {loadingContacts ? (
                    <div className="flex items-center gap-2 px-4 py-4 text-[12px] text-[#817b89]">
                      <Loader2 className="size-4 animate-spin"/> Searching contacts…
                    </div>
                  ) : results.length ? results.map((contact, index) => (
                    <button
                      key={contact._id}
                      id={"new-project-contact-" + index}
                      role="option"
                      aria-selected={activeOption === index}
                      type="button"
                      onMouseEnter={() => setActiveOption(index)}
                      onClick={() => chooseClient(contact)}
                      className={"flex w-full items-center gap-3 px-4 py-3 text-left transition " +
                        (activeOption === index ? "bg-[#f4efff]" : "hover:bg-[#faf8fd]")}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eee9f7] text-[#6337d8]">
                        <UserRound className="size-4"/>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[#292530]">{contact.title}</span>
                        <span className="block truncate text-[11px] text-[#8a8491]">{contact.email}</span>
                      </span>
                      <Check className="size-4 text-[#b4a2db]"/>
                    </button>
                  )) : (
                    <p className="px-4 py-4 text-[12px] text-[#918b96]">
                      {clientSearch.trim() ? "No matching contacts found." : "No contacts yet. Create your first one below."}
                    </p>
                  )}
                  <button type="button" onClick={startNewContact}
                    className="flex w-full items-center gap-2 border-t border-[#eeeaf1] px-4 py-3 text-left text-[12px] font-semibold text-[#6337d8] hover:bg-[#f8f4ff]">
                    <Plus className="size-4"/> Create New Contact
                  </button>
                </div>
              )}
            </div>
          )}
          {!selectedClient && !showNewContact && (
            <button type="button" onClick={startNewContact}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6337d8] hover:underline">
              <Plus className="size-3.5"/> Create a new contact
            </button>
          )}
          {contactError && !showNewContact && <p role="alert" className="mt-2 text-[12px] text-red-700">{contactError}</p>}

          {showNewContact && !selectedClient && (
            <form onSubmit={(e) => void createContact(e)}
              className="mt-5 space-y-4 border border-[#e9e3f0] bg-[#fbfaff] px-5 py-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-semibold">Create a new contact</h2>
                  <p className="mt-1 text-[11px] text-[#88818f]">This person will be saved in Contacts and linked to your project.</p>
                </div>
                <button type="button" aria-label="Cancel creating contact"
                  disabled={savingContact} onClick={() => {setShowNewContact(false);setContactError("");}}
                  className="rounded p-2 text-[#999] hover:bg-[#eee8f5]"><X className="size-4"/></button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-[12px] font-medium">First name *
                  <input required autoFocus disabled={savingContact} maxLength={100} value={firstName}
                    onChange={e=>setFirstName(e.target.value)} placeholder="Jane" className={INPUT+" mt-2"}/>
                </label>
                <label className="block text-[12px] font-medium">Last name
                  <input disabled={savingContact} maxLength={100} value={lastName}
                    onChange={e=>setLastName(e.target.value)} placeholder="Smith" className={INPUT+" mt-2"}/>
                </label>
                <label className="block text-[12px] font-medium">Email *
                  <input required type="email" autoComplete="email" disabled={savingContact} maxLength={180} value={email}
                    onChange={e=>setEmail(e.target.value)} placeholder="jane@example.com" className={INPUT+" mt-2"}/>
                </label>
                <label className="block text-[12px] font-medium">Phone (optional)
                  <input type="tel" autoComplete="tel" disabled={savingContact} maxLength={60} value={phone}
                    onChange={e=>setPhone(e.target.value)} placeholder="Phone number" className={INPUT+" mt-2"}/>
                </label>
              </div>
              {contactError&&<p role="alert" className="text-[12px] text-red-700">{contactError}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={savingContact} className={BUTTON}>
                  {savingContact?<Loader2 className="size-4 animate-spin"/>:<Plus className="size-4"/>}
                  {savingContact?"Saving contact…":"Save & Select Contact"}
                </button>
                <button type="button" disabled={savingContact} onClick={()=>{setShowNewContact(false);setSearchOpen(true);}}
                  className="px-3 py-2 text-[12px] text-[#817b89] hover:underline">Back to contact search</button>
              </div>
            </form>
          )}
        </section>

        <form onSubmit={(e) => void createProject(e)} className="space-y-9">
          <div>
            <label htmlFor="new-project-name" className={LABEL}>Project Name <span className="text-[#ba7181]">*</span></label>
            <input id="new-project-name" required type="text" maxLength={220} value={projectName}
              onChange={e=>setProjectName(e.target.value)}
              placeholder="Add project name" className={INPUT} disabled={savingProject}/>
          </div>
          <div>
            <label htmlFor="new-project-type" className={LABEL}>New Project Type</label>
            <div className="relative">
              <select id="new-project-type" value={projectType} onChange={e=>setProjectType(e.target.value)}
                disabled={savingProject}
                className={INPUT+" appearance-none pr-11"}>
                {TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-[17px] size-4 text-[#88828d]"/>
            </div>
          </div>
          {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-[12px] text-red-700">{error}</p>}
          <button type="submit" disabled={savingProject || savingContact} className={BUTTON+" min-w-[148px]"}>
            {savingProject&&<Loader2 className="size-4 animate-spin"/>}
            {savingProject?"Creating Project…":"Create Project"}
          </button>
        </form>
      </div>
    </div>
  );
}

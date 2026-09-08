"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useBookingManager,
  type BookingCoworkerRecord,
  type BookingEventRecord,
  type BookingSettings,
  type BookingShareLinkRecord,
  type BookingTypeRecord,
} from "@/api-hooks/use-bookings";

type BookingTab = "calendar" | "bookings" | "links" | "types" | "coworkers" | "settings";

type EventDraft = {
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  notes: string;
  coworkerIds: string[];
};

type ServiceDraft = {
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  currency: string;
  location: string;
  active: boolean;
  coworkerIds: string[];
};

type CoworkerDraft = {
  name: string;
  email: string;
  phone: string;
  role: string;
  notes: string;
  active: boolean;
};

const emptyService: ServiceDraft = {
  name: "",
  description: "",
  durationMinutes: 60,
  price: 0,
  currency: "USD",
  location: "",
  active: true,
  coworkerIds: [],
};

const emptyCoworker: CoworkerDraft = {
  name: "",
  email: "",
  phone: "",
  role: "Photographer",
  notes: "",
  active: true,
};

const tabItems: Array<{ key: BookingTab; label: string; icon: typeof CalendarDays }> = [
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "bookings", label: "Bookings", icon: Clock3 },
  { key: "links", label: "Share Links", icon: Link2 },
  { key: "types", label: "Booking Types", icon: Settings2 },
  { key: "coworkers", label: "Co-workers", icon: Users },
  { key: "settings", label: "Settings", icon: Settings2 },
];

export function BookingManager() {
  const manager = useBookingManager();
  const data = manager.query.data?.data;
  const [tab, setTab] = useState<BookingTab>("calendar");
  const [month, setMonth] = useState(() => new Date());
  const [eventOpen, setEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BookingEventRecord | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft>(() => newEventDraft(new Date()));

  const events = data?.events ?? [];
  const coworkers = data?.coworkers ?? [];
  const services = data?.services ?? [];
  const shareLinks = data?.shareLinks ?? [];
  const bookings = useMemo(
    () => events.filter((event) => event.kind === "booking").sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)),
    [events],
  );

  const openNewEvent = (date = new Date()) => {
    setEditingEvent(null);
    setEventDraft(newEventDraft(date));
    setEventOpen(true);
  };

  const openEditEvent = (event: BookingEventRecord) => {
    setEditingEvent(event);
    setEventDraft({
      title: event.title,
      startAt: toLocalInput(event.startAt),
      endAt: toLocalInput(event.endAt),
      location: event.location || "",
      notes: event.notes || "",
      coworkerIds: event.coworkerIds ?? [],
    });
    setEventOpen(true);
  };

  const saveEvent = async () => {
    if (!eventDraft.title.trim()) return toast.error("Event title is required");
    const startAt = new Date(eventDraft.startAt);
    const endAt = new Date(eventDraft.endAt);
    if (!eventDraft.startAt || !eventDraft.endAt || endAt <= startAt) return toast.error("Choose a valid start and end time");
    const payload = {
      ...eventDraft,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      kind: editingEvent?.kind ?? "event",
      status: editingEvent?.status ?? "confirmed",
    } as Partial<BookingEventRecord>;
    try {
      if (editingEvent) await manager.updateEvent.mutateAsync({ id: editingEvent._id, payload });
      else await manager.createEvent.mutateAsync(payload);
      toast.success(editingEvent ? "Event updated" : "Event added");
      setEventOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save event");
    }
  };

  if (manager.query.isLoading || !data) {
    return <div className="flex min-h-[520px] items-center justify-center"><Loader2 className="size-7 animate-spin text-[#6337d8]" /></div>;
  }

  const todayBookings = bookings.filter((item) => isSameDay(parseISO(item.startAt), new Date()) && item.status !== "cancelled").length;
  const upcoming = bookings.filter((item) => +new Date(item.startAt) >= Date.now() && item.status !== "cancelled").length;
  const activeCoworkers = coworkers.filter((item) => item.active).length;
  const activeShareLinks = shareLinks.filter((item) => !item.usedAt && !item.bookingEventId && +new Date(item.expiresAt) > +new Date()).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8a8a8a]">Studio scheduling</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#202326]">Bookings & Events</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b6b6b]">Take client bookings, keep your calendar organized, and assign work to your team from one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setTab("links")} className="rounded-lg border-[#cfc4ed] text-[#6337d8] hover:bg-[#f8f5ff]"><Link2 className="size-4" /> Share booking link</Button>
          <Button onClick={() => openNewEvent()} className="rounded-lg bg-[#6337d8] text-white hover:bg-[#5527c9]"><Plus className="size-4" /> Add event</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Today" value={todayBookings} detail="bookings" />
        <Metric label="Upcoming" value={upcoming} detail="confirmed + pending" />
        <Metric label="Active links" value={activeShareLinks} detail="private booking invites" />
        <Metric label="Team" value={activeCoworkers} detail="active co-workers" />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[#e7e7e7]">
        {tabItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => setTab(item.key)} className={cn("flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold", tab === item.key ? "border-[#6337d8] text-[#6337d8]" : "border-transparent text-[#777] hover:text-[#333]")}>
              <Icon className="size-4" /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === "calendar" && <CalendarTab month={month} setMonth={setMonth} events={events} coworkers={coworkers} openNewEvent={openNewEvent} openEditEvent={openEditEvent} />}
      {tab === "bookings" && <BookingsTab events={bookings} coworkers={coworkers} manager={manager} openEditEvent={openEditEvent} />}
      {tab === "links" && <BookingShareLinksTab links={shareLinks} services={services} manager={manager} />}
      {tab === "types" && <BookingTypesTab services={services} coworkers={coworkers} manager={manager} />}
      {tab === "coworkers" && <CoworkersTab coworkers={coworkers} manager={manager} />}
      {tab === "settings" && <BookingSettingsTab settings={data.settings} publicIdentifier={data.publicIdentifier} manager={manager} />}

      <EventDialog open={eventOpen} setOpen={setEventOpen} editing={editingEvent} draft={eventDraft} setDraft={setEventDraft} coworkers={coworkers} busy={manager.createEvent.isPending || manager.updateEvent.isPending} onSave={saveEvent} />
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl border border-[#ececec] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#929292]">{label}</p><div className="mt-2 flex items-end gap-2"><span className="text-3xl font-semibold text-[#202326]">{value}</span><span className="pb-1 text-xs text-[#888]">{detail}</span></div></div>;
}

function CalendarTab({ month, setMonth, events, coworkers, openNewEvent, openEditEvent }: {
  month: Date; setMonth: (date: Date) => void; events: BookingEventRecord[]; coworkers: BookingCoworkerRecord[];
  openNewEvent: (date?: Date) => void; openEditEvent: (event: BookingEventRecord) => void;
}) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  const upcoming = events.filter((item) => item.status !== "cancelled" && +new Date(item.endAt) >= Date.now()).slice(0, 8);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b p-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999]">Calendar</p><h2 className="mt-1 text-xl font-semibold">{format(month, "MMMM yyyy")}</h2></div>
          <div className="flex items-center gap-1"><Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="size-4" /></Button><Button variant="outline" className="px-3" onClick={() => setMonth(new Date())}>Today</Button><Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="size-4" /></Button></div>
        </div>
        <div className="grid grid-cols-7 border-b bg-[#fafafa] text-center text-[11px] font-bold uppercase tracking-wide text-[#888]">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div key={day} className="px-2 py-3">{day}</div>)}</div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((event) => isSameDay(parseISO(event.startAt), day) && event.status !== "cancelled").slice(0, 3);
            return (
              <button key={day.toISOString()} type="button" onDoubleClick={() => openNewEvent(day)} className={cn("min-h-28 border-b border-r p-2 text-left transition hover:bg-[#faf9ff]", !isSameMonth(day, month) && "bg-[#fbfbfb] text-[#aaa]")}>
                <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold", isSameDay(day, new Date()) && "bg-[#6337d8] text-white")}>{format(day, "d")}</span>
                <div className="mt-1 space-y-1">
                  {dayEvents.map((event) => <span key={event._id} onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditEvent(event); }} className={cn("block truncate rounded px-1.5 py-1 text-[10px] font-semibold", event.kind === "booking" ? "bg-[#efe9ff] text-[#6337d8]" : "bg-[#eef2f4] text-[#45525b]")}>{format(parseISO(event.startAt), "HH:mm")} {event.title}</span>)}
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <aside className="rounded-xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999]">Next up</p><h3 className="mt-1 text-lg font-semibold">Upcoming</h3></div><Button variant="outline" size="sm" onClick={() => openNewEvent()}><Plus className="size-4" /> Event</Button></div>
        <div className="mt-5 space-y-3">
          {upcoming.map((event) => <UpcomingCard key={event._id} event={event} coworkers={coworkers} onClick={() => openEditEvent(event)} />)}
          {!upcoming.length && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-[#888]">Nothing scheduled yet.</div>}
        </div>
      </aside>
    </div>
  );
}

function UpcomingCard({ event, coworkers, onClick }: { event: BookingEventRecord; coworkers: BookingCoworkerRecord[]; onClick: () => void }) {
  const names = coworkers.filter((person) => event.coworkerIds?.includes(person._id)).map((person) => person.name).join(", ");
  return (
    <button type="button" onClick={onClick} className="w-full rounded-lg border border-[#ececec] p-3 text-left transition hover:border-[#d8cdf7] hover:bg-[#faf8ff]">
      <div className="flex items-start justify-between gap-2"><span className="line-clamp-1 text-sm font-semibold text-[#252525]">{event.title}</span><StatusBadge status={event.status} /></div>
      <p className="mt-2 flex items-center gap-2 text-xs text-[#777]"><Clock3 className="size-3.5" />{format(parseISO(event.startAt), "MMM d, h:mm a")}</p>
      {event.location && <p className="mt-1 flex items-center gap-2 truncate text-xs text-[#777]"><MapPin className="size-3.5" />{event.location}</p>}
      {names && <p className="mt-2 text-[11px] font-semibold text-[#6337d8]">Assigned: {names}</p>}
    </button>
  );
}

function BookingsTab({ events, coworkers, manager, openEditEvent }: { events: BookingEventRecord[]; coworkers: BookingCoworkerRecord[]; manager: ReturnType<typeof useBookingManager>; openEditEvent: (event: BookingEventRecord) => void }) {
  const updateStatus = async (event: BookingEventRecord, status: BookingEventRecord["status"]) => {
    try {
      await manager.updateEvent.mutateAsync({ id: event._id, payload: { status } });
      toast.success(`Booking ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update booking");
    }
  };
  return (
    <section className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999]">Client requests</p><h2 className="mt-1 text-xl font-semibold">Bookings</h2></div><span className="text-sm text-[#777]">{events.length} total</span></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b bg-[#fafafa] text-xs uppercase text-[#777]"><tr><th className="px-5 py-3">Client</th><th className="px-4 py-3">Session</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Assigned</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
          <tbody>
            {events.map((event) => {
              const assigned = coworkers.filter((person) => event.coworkerIds?.includes(person._id)).map((person) => person.name).join(", ") || "Owner";
              return <tr key={event._id} className="border-b last:border-0"><td className="px-5 py-4"><p className="font-semibold">{event.clientName || "Client"}</p><p className="mt-1 text-xs text-[#888]">{event.clientEmail}</p></td><td className="px-4 py-4"><p className="font-medium">{event.serviceName || event.title}</p>{event.location && <p className="mt-1 text-xs text-[#888]">{event.location}</p>}</td><td className="px-4 py-4"><p>{format(parseISO(event.startAt), "MMM d, yyyy")}</p><p className="mt-1 text-xs text-[#888]">{format(parseISO(event.startAt), "h:mm a")} - {format(parseISO(event.endAt), "h:mm a")}</p></td><td className="px-4 py-4">{assigned}</td><td className="px-4 py-4"><StatusBadge status={event.status} /></td><td className="px-5 py-4"><div className="flex justify-end gap-2">{event.status === "pending" && <Button size="sm" className="bg-[#6337d8] text-white" onClick={() => void updateStatus(event, "confirmed")}><CheckCircle2 className="size-4" /> Confirm</Button>}{event.status === "confirmed" && <Button size="sm" variant="outline" onClick={() => void updateStatus(event, "completed")}>Complete</Button>}{event.status !== "cancelled" && event.status !== "completed" && <Button size="sm" variant="outline" onClick={() => void updateStatus(event, "cancelled")}><XCircle className="size-4" /> Cancel</Button>}<Button size="icon" variant="ghost" onClick={() => openEditEvent(event)}><Pencil className="size-4" /></Button></div></td></tr>;
            })}
            {!events.length && <tr><td colSpan={6} className="px-5 py-14 text-center text-[#888]">No client bookings yet. Share your public booking link from Settings.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BookingShareLinksTab({ links, services, manager }: { links: BookingShareLinkRecord[]; services: BookingTypeRecord[]; manager: ReturnType<typeof useBookingManager> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => newShareLinkDraft());
  const activeServices = services.filter((item) => item.active);

  const showCreate = () => {
    setDraft(newShareLinkDraft());
    setOpen(true);
  };
  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Booking link copied");
  };
  const remove = async (item: BookingShareLinkRecord) => {
    if (!window.confirm(`Delete this booking link${item.recipientEmail ? ` for ${item.recipientEmail}` : ""}? It will stop working immediately.`)) return;
    try {
      await manager.deleteShareLink.mutateAsync(item._id);
      toast.success("Booking link deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete booking link");
    }
  };
  const create = async () => {
    if (draft.sendEmail && !/^\S+@\S+\.\S+$/.test(draft.recipientEmail.trim())) return toast.error("Enter the recipient email to send this link");
    const expiresAt = new Date(draft.expiresAt);
    if (!draft.expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return toast.error("Choose a future expiry time");
    try {
      const result = await manager.createShareLink.mutateAsync({
        recipientName: draft.recipientName.trim(),
        recipientEmail: draft.recipientEmail.trim(),
        serviceId: draft.serviceId || undefined,
        expiresAt: expiresAt.toISOString(),
        sendEmail: draft.sendEmail,
      });
      await navigator.clipboard.writeText(result.url).catch(() => undefined);
      setOpen(false);
      if (draft.sendEmail && result.emailSent) toast.success("Private booking link emailed and copied");
      else if (draft.sendEmail) toast.warning("Link created and copied, but the email could not be sent");
      else toast.success("Private booking link created and copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create booking link");
    }
  };

  return (
    <section className="rounded-xl border border-[#e8e8e8] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999]">Private invitations</p>
          <h2 className="mt-1 text-xl font-semibold">Booking Share Links</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777]">Create a unique one-time booking link for a client. Set who it is for, optionally lock it to one booking type, choose exactly when it expires, and revoke it any time.</p>
        </div>
        <Button onClick={showCreate} disabled={!activeServices.length} className="bg-[#6337d8] text-white"><Link2 className="size-4" /> Create private link</Button>
      </div>

      {!activeServices.length && <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Create at least one active Booking Type before sending a private booking link.</div>}

      <div className="divide-y">
        {links.map((item) => {
          const status = shareLinkStatus(item);
          return (
            <div key={item._id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,.8fr)_170px_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-[#252525]">{item.recipientName || item.recipientEmail || "Private booking link"}</p>
                  <ShareLinkStatusBadge status={status} />
                </div>
                <p className="mt-1 truncate text-xs text-[#777]">{item.recipientEmail || "No email lock - anyone with this private link can use it once"}</p>
                <button type="button" onClick={() => void copy(item.url)} className="mt-2 block max-w-full truncate text-left text-xs font-medium text-[#6337d8] hover:underline">{item.url}</button>
              </div>
              <div className="text-sm">
                <p className="font-medium text-[#333]">{item.serviceName || "Any active booking type"}</p>
                <p className="mt-1 text-xs text-[#888]">Created {formatShortDate(item.createdAt)}</p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-[#333]">Expires</p>
                <p className="mt-1 text-xs text-[#888]">{formatShortDate(item.expiresAt)}</p>
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button size="sm" variant="outline" onClick={() => void copy(item.url)} disabled={status !== "active"}><Copy className="size-4" /> Copy</Button>
                <Button size="icon" variant="outline" asChild={status === "active"} disabled={status !== "active"}>{status === "active" ? <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open booking link"><ExternalLink className="size-4" /></a> : <ExternalLink className="size-4" />}</Button>
                <Button size="icon" variant="ghost" onClick={() => void remove(item)} disabled={manager.deleteShareLink.isPending} aria-label="Delete booking link"><Trash2 className="size-4 text-red-500" /></Button>
              </div>
            </div>
          );
        })}
        {!links.length && <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><Link2 className="size-10 text-[#c8bdea]" /><h3 className="mt-4 font-semibold">No private booking links yet</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#777]">Create one when you want a specific person to book through a controlled link instead of sharing your permanent public booking page.</p></div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader><DialogTitle>Create private booking link</DialogTitle><DialogDescription>The link works once, stops immediately if you delete it, and cannot be used after its expiry time.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">Client name <span className="font-normal text-[#999]">optional</span><Input value={draft.recipientName} onChange={(e) => setDraft({ ...draft, recipientName: e.target.value })} placeholder="Jessie Ryan" /></label>
              <label className="grid gap-2 text-sm font-semibold">Client email <span className="font-normal text-[#999]">optional</span><Input type="email" value={draft.recipientEmail} onChange={(e) => setDraft({ ...draft, recipientEmail: e.target.value })} placeholder="client@example.com" /></label>
            </div>
            <label className="grid gap-2 text-sm font-semibold">Booking type<select value={draft.serviceId} onChange={(e) => setDraft({ ...draft, serviceId: e.target.value })} className="h-11 rounded-md border bg-white px-3 font-normal"><option value="">Any active booking type</option>{activeServices.map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Link expires at<Input type="datetime-local" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} /></label>
            <div className="flex flex-wrap gap-2">{[[1,"24 hours"],[3,"3 days"],[7,"7 days"],[30,"30 days"]].map(([days,label]) => <button key={String(days)} type="button" onClick={() => setDraft({ ...draft, expiresAt: localDateTime(new Date(Date.now() + Number(days) * 86400000)) })} className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-[#666] hover:border-[#6337d8] hover:text-[#6337d8]">{label}</button>)}</div>
            <div className="flex items-start justify-between gap-4 rounded-lg bg-[#faf8ff] p-4"><div><p className="text-sm font-semibold">Email the link now</p><p className="mt-1 text-xs leading-5 text-[#777]">If enabled, the client receives the private booking link immediately. The link is also copied to your clipboard.</p></div><Switch checked={draft.sendEmail} onCheckedChange={(sendEmail) => setDraft({ ...draft, sendEmail })} /></div>
            {draft.recipientEmail && <div className="flex items-start gap-2 text-xs leading-5 text-[#777]"><Mail className="mt-0.5 size-4 shrink-0 text-[#6337d8]" /><span>When an email is set, the booking form is locked to that exact email address so forwarding the link does not let another address use it.</span></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void create()} disabled={manager.createShareLink.isPending} className="bg-[#6337d8] text-white">{manager.createShareLink.isPending && <Loader2 className="size-4 animate-spin" />} Create link</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function BookingTypesTab({ services, coworkers, manager }: { services: BookingTypeRecord[]; coworkers: BookingCoworkerRecord[]; manager: ReturnType<typeof useBookingManager> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BookingTypeRecord | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(emptyService);
  const showNew = () => { setEditing(null); setDraft({ ...emptyService }); setOpen(true); };
  const showEdit = (item: BookingTypeRecord) => { setEditing(item); setDraft({ name: item.name, description: item.description || "", durationMinutes: item.durationMinutes, price: item.price, currency: item.currency || "USD", location: item.location || "", active: item.active, coworkerIds: item.coworkerIds ?? [] }); setOpen(true); };
  const save = async () => {
    if (!draft.name.trim()) return toast.error("Booking type name is required");
    try {
      if (editing) await manager.updateService.mutateAsync({ id: editing._id, payload: draft });
      else await manager.createService.mutateAsync(draft);
      toast.success(editing ? "Booking type updated" : "Booking type created");
      setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save booking type"); }
  };
  const remove = async (item: BookingTypeRecord) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try { await manager.deleteService.mutateAsync(item._id); toast.success("Booking type deleted"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete booking type"); }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999]">Services</p><h2 className="mt-1 text-xl font-semibold">Booking Types</h2><p className="mt-1 text-sm text-[#777]">Create the sessions clients can book online.</p></div><Button onClick={showNew} className="bg-[#6337d8] text-white"><Plus className="size-4" /> New booking type</Button></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((item) => {
          const assigned = coworkers.filter((person) => item.coworkerIds?.includes(person._id)).map((person) => person.name);
          return <div key={item._id} className="rounded-xl border border-[#e8e8e8] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase", item.active ? "bg-emerald-50 text-emerald-700" : "bg-[#f1f1f1] text-[#777]")}>{item.active ? "Active" : "Hidden"}</span><h3 className="mt-3 text-lg font-semibold">{item.name}</h3></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => showEdit(item)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(item)}><Trash2 className="size-4 text-red-500" /></Button></div></div><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#777]">{item.description || "No description yet."}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-[#666]"><span className="rounded bg-[#f5f5f5] px-2 py-1">{item.durationMinutes} min</span><span className="rounded bg-[#f5f5f5] px-2 py-1">{item.price > 0 ? `${item.currency} ${item.price}` : "No online price"}</span></div>{item.location && <p className="mt-4 flex items-center gap-2 text-xs text-[#777]"><MapPin className="size-3.5" />{item.location}</p>}<p className="mt-3 text-xs text-[#777]">Team: {assigned.length ? assigned.join(", ") : "Any available co-worker / owner"}</p></div>;
        })}
        {!services.length && <button type="button" onClick={showNew} className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[#cfc4ed] bg-[#faf8ff] p-6 text-center"><Plus className="size-8 text-[#6337d8]" /><span className="mt-3 font-semibold text-[#6337d8]">Create your first booking type</span><span className="mt-1 text-sm text-[#777]">Examples: Wedding consultation, portrait session, mini session.</span></button>}
      </div>
      <ServiceDialog open={open} setOpen={setOpen} editing={editing} draft={draft} setDraft={setDraft} coworkers={coworkers} busy={manager.createService.isPending || manager.updateService.isPending} onSave={save} />
    </div>
  );
}

function CoworkersTab({ coworkers, manager }: { coworkers: BookingCoworkerRecord[]; manager: ReturnType<typeof useBookingManager> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BookingCoworkerRecord | null>(null);
  const [draft, setDraft] = useState<CoworkerDraft>(emptyCoworker);
  const showNew = () => { setEditing(null); setDraft({ ...emptyCoworker }); setOpen(true); };
  const showEdit = (item: BookingCoworkerRecord) => { setEditing(item); setDraft({ name: item.name, email: item.email || "", phone: item.phone || "", role: item.role || "Photographer", notes: item.notes || "", active: item.active }); setOpen(true); };
  const save = async () => {
    if (!draft.name.trim()) return toast.error("Co-worker name is required");
    try { if (editing) await manager.updateCoworker.mutateAsync({ id: editing._id, payload: draft }); else await manager.createCoworker.mutateAsync(draft); toast.success(editing ? "Co-worker updated" : "Co-worker added"); setOpen(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save co-worker"); }
  };
  const remove = async (item: BookingCoworkerRecord) => {
    if (!window.confirm(`Remove ${item.name}?`)) return;
    try { await manager.deleteCoworker.mutateAsync(item._id); toast.success("Co-worker removed"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not remove co-worker"); }
  };
  return (
    <section className="rounded-xl border border-[#e8e8e8] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999]">Team</p><h2 className="mt-1 text-xl font-semibold">Co-workers</h2><p className="mt-1 text-sm text-[#777]">Assign photographers, assistants, editors, or other staff to events.</p></div><Button onClick={showNew} className="bg-[#6337d8] text-white"><UserPlus className="size-4" /> Add co-worker</Button></div><div className="divide-y">{coworkers.map((person) => <div key={person._id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex min-w-0 items-center gap-4"><div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#efe9ff] font-bold text-[#6337d8]">{initials(person.name)}</div><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold">{person.name}</p><span className={cn("size-2 rounded-full", person.active ? "bg-emerald-500" : "bg-[#bbb]")} /></div><p className="mt-1 text-xs text-[#777]">{person.role}{person.email ? ` · ${person.email}` : ""}</p></div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => showEdit(person)}><Pencil className="size-4" /> Edit</Button><Button variant="ghost" size="icon" onClick={() => void remove(person)}><Trash2 className="size-4 text-red-500" /></Button></div></div>)}{!coworkers.length && <div className="p-10 text-center text-sm text-[#888]">No co-workers yet. Add your team so bookings can be assigned automatically.</div>}</div><CoworkerDialog open={open} setOpen={setOpen} editing={editing} draft={draft} setDraft={setDraft} busy={manager.createCoworker.isPending || manager.updateCoworker.isPending} onSave={save} /></section>
  );
}

function BookingSettingsTab({ settings, publicIdentifier, manager }: { settings: BookingSettings; publicIdentifier: string; manager: ReturnType<typeof useBookingManager> }) {
  const [draft, setDraft] = useState<BookingSettings>(settings);
  useEffect(() => setDraft(settings), [settings]);
  const bookingPath = `/book/${encodeURIComponent(publicIdentifier)}`;
  const save = async () => {
    try { await manager.updateSettings.mutateAsync(draft); toast.success("Booking settings saved"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save settings"); }
  };
  const copyLink = async () => {
    const url = `${window.location.origin}${bookingPath}`;
    await navigator.clipboard.writeText(url);
    toast.success("Booking link copied");
  };
  const updateHour = (day: number, patch: Partial<BookingSettings["businessHours"][number]>) => setDraft((current) => ({ ...current, businessHours: current.businessHours.map((item) => item.day === day ? { ...item, ...patch } : item) }));
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999]">Online booking</p><h2 className="mt-1 text-xl font-semibold">Availability settings</h2><p className="mt-1 text-sm text-[#777]">Control when clients can request sessions.</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold">{draft.enabled ? "Live" : "Off"}</span><Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft((value) => ({ ...value, enabled }))} /></div></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">Time zone<select value={draft.timezone} onChange={(e) => setDraft((value) => ({ ...value, timezone: e.target.value }))} className="h-11 rounded-md border bg-white px-3 font-normal">{timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-semibold">Slot interval<select value={draft.slotIntervalMinutes} onChange={(e) => setDraft((value) => ({ ...value, slotIntervalMinutes: Number(e.target.value) }))} className="h-11 rounded-md border bg-white px-3 font-normal"><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option></select></label>
          <label className="grid gap-2 text-sm font-semibold">Minimum notice (hours)<Input type="number" min={0} max={720} value={draft.minNoticeHours} onChange={(e) => setDraft((value) => ({ ...value, minNoticeHours: Number(e.target.value) }))} /></label>
          <label className="grid gap-2 text-sm font-semibold">Booking window (days)<Input type="number" min={1} max={730} value={draft.maxAdvanceDays} onChange={(e) => setDraft((value) => ({ ...value, maxAdvanceDays: Number(e.target.value) }))} /></label>
        </div>
        <div className="mt-7"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Business hours</h3><p className="mt-1 text-sm text-[#777]">These hours create the available time slots clients see.</p></div></div><div className="mt-4 divide-y rounded-lg border">{draft.businessHours.slice().sort((a,b) => a.day-b.day).map((item) => <div key={item.day} className="grid items-center gap-3 p-3 sm:grid-cols-[110px_90px_1fr_1fr]"><span className="text-sm font-semibold">{dayNames[item.day]}</span><label className="flex items-center gap-2 text-xs text-[#666]"><Switch checked={item.enabled} onCheckedChange={(enabled) => updateHour(item.day, { enabled })} />{item.enabled ? "Open" : "Closed"}</label><Input type="time" disabled={!item.enabled} value={item.start} onChange={(e) => updateHour(item.day, { start: e.target.value })} /><Input type="time" disabled={!item.enabled} value={item.end} onChange={(e) => updateHour(item.day, { end: e.target.value })} /></div>)}</div></div>
        <div className="mt-7 flex items-center justify-between gap-4 rounded-lg bg-[#fafafa] p-4"><div><p className="font-semibold">Automatically confirm bookings</p><p className="mt-1 text-xs text-[#777]">Turn this off when you want new requests to stay pending until you approve them.</p></div><Switch checked={draft.autoConfirm} onCheckedChange={(autoConfirm) => setDraft((value) => ({ ...value, autoConfirm }))} /></div>
        <label className="mt-6 grid gap-2 text-sm font-semibold">Confirmation message<Textarea rows={4} value={draft.confirmationMessage} onChange={(e) => setDraft((value) => ({ ...value, confirmationMessage: e.target.value }))} /></label>
        <Button onClick={() => void save()} disabled={manager.updateSettings.isPending} className="mt-6 bg-[#6337d8] text-white">{manager.updateSettings.isPending && <Loader2 className="size-4 animate-spin" />} Save settings</Button>
      </section>
      <aside className="h-fit rounded-xl border border-[#dcd2f6] bg-[#f8f5ff] p-6">
        <CalendarDays className="size-8 text-[#6337d8]" /><h3 className="mt-4 text-xl font-semibold">Your public booking page</h3><p className="mt-2 text-sm leading-6 text-[#6d6380]">Share this link anywhere. Clients choose a booking type, date and available time without messaging back and forth.</p><div className="mt-5 rounded-lg border border-[#ded6f1] bg-white p-3 text-xs font-medium text-[#555] break-all">{bookingPath}</div><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => void copyLink()}><Copy className="size-4" /> Copy</Button><Button asChild className="bg-[#6337d8] text-white"><a href={bookingPath} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open</a></Button></div><div className="mt-5 rounded-lg border border-[#e7e0f6] bg-white/70 p-4 text-xs leading-5 text-[#746985]">Co-workers assigned to a booking type are used as available resources. If one person is busy, another available co-worker can receive the booking automatically.</div>
      </aside>
    </div>
  );
}

function EventDialog({ open, setOpen, editing, draft, setDraft, coworkers, busy, onSave }: { open: boolean; setOpen: (open: boolean) => void; editing: BookingEventRecord | null; draft: EventDraft; setDraft: (value: EventDraft) => void; coworkers: BookingCoworkerRecord[]; busy: boolean; onSave: () => void }) {
  const toggleCoworker = (id: string) => setDraft({ ...draft, coworkerIds: draft.coworkerIds.includes(id) ? draft.coworkerIds.filter((value) => value !== id) : [...draft.coworkerIds, id] });
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-[640px]"><DialogHeader><DialogTitle>{editing ? "Edit event" : "Add event"}</DialogTitle><DialogDescription>{editing?.kind === "booking" ? "Update this client booking, assignment, location, or notes." : "Block time on your calendar or add a studio event."}</DialogDescription></DialogHeader><div className="grid gap-4"><label className="grid gap-2 text-sm font-semibold">Title<Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Engagement session" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Starts<Input type="datetime-local" value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} /></label><label className="grid gap-2 text-sm font-semibold">Ends<Input type="datetime-local" value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} /></label></div><label className="grid gap-2 text-sm font-semibold">Location<Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Studio, venue, Zoom..." /></label>{coworkers.length > 0 && <div><p className="mb-2 text-sm font-semibold">Assign co-workers</p><div className="flex flex-wrap gap-2">{coworkers.filter((person) => person.active).map((person) => <button key={person._id} type="button" onClick={() => toggleCoworker(person._id)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", draft.coworkerIds.includes(person._id) ? "border-[#6337d8] bg-[#efe9ff] text-[#6337d8]" : "bg-white text-[#666]")}>{person.name}</button>)}</div></div>}<label className="grid gap-2 text-sm font-semibold">Notes<Textarea rows={4} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Internal notes, call details, equipment..." /></label></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={onSave} disabled={busy} className="bg-[#6337d8] text-white">{busy && <Loader2 className="size-4 animate-spin" />} Save</Button></DialogFooter></DialogContent></Dialog>;
}

function ServiceDialog({ open, setOpen, editing, draft, setDraft, coworkers, busy, onSave }: { open: boolean; setOpen: (open: boolean) => void; editing: BookingTypeRecord | null; draft: ServiceDraft; setDraft: (value: ServiceDraft) => void; coworkers: BookingCoworkerRecord[]; busy: boolean; onSave: () => void }) {
  const toggle = (id: string) => setDraft({ ...draft, coworkerIds: draft.coworkerIds.includes(id) ? draft.coworkerIds.filter((value) => value !== id) : [...draft.coworkerIds, id] });
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-[680px]"><DialogHeader><DialogTitle>{editing ? "Edit booking type" : "New booking type"}</DialogTitle><DialogDescription>Define what clients can book and who can be assigned.</DialogDescription></DialogHeader><div className="grid gap-4"><label className="grid gap-2 text-sm font-semibold">Name<Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Portrait session" /></label><label className="grid gap-2 text-sm font-semibold">Description<Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label><div className="grid gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm font-semibold">Duration<Input type="number" min={15} value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} /></label><label className="grid gap-2 text-sm font-semibold">Price<Input type="number" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></label><label className="grid gap-2 text-sm font-semibold">Currency<Input value={draft.currency} maxLength={6} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} /></label></div><label className="grid gap-2 text-sm font-semibold">Location<Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Studio address, Online, Client location" /></label>{coworkers.length > 0 && <div><p className="mb-2 text-sm font-semibold">Available co-workers</p><div className="flex flex-wrap gap-2">{coworkers.filter((person) => person.active).map((person) => <button key={person._id} type="button" onClick={() => toggle(person._id)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", draft.coworkerIds.includes(person._id) ? "border-[#6337d8] bg-[#efe9ff] text-[#6337d8]" : "bg-white text-[#666]")}>{person.name}</button>)}</div><p className="mt-2 text-xs text-[#888]">Leave everyone unselected to allow any active co-worker.</p></div>}<div className="flex items-center justify-between rounded-lg bg-[#fafafa] p-4"><div><p className="text-sm font-semibold">Available for online booking</p><p className="mt-1 text-xs text-[#777]">Hidden booking types stay in your history but clients cannot select them.</p></div><Switch checked={draft.active} onCheckedChange={(active) => setDraft({ ...draft, active })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={onSave} disabled={busy} className="bg-[#6337d8] text-white">{busy && <Loader2 className="size-4 animate-spin" />} Save</Button></DialogFooter></DialogContent></Dialog>;
}

function CoworkerDialog({ open, setOpen, editing, draft, setDraft, busy, onSave }: { open: boolean; setOpen: (open: boolean) => void; editing: BookingCoworkerRecord | null; draft: CoworkerDraft; setDraft: (value: CoworkerDraft) => void; busy: boolean; onSave: () => void }) {
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-[620px]"><DialogHeader><DialogTitle>{editing ? "Edit co-worker" : "Add co-worker"}</DialogTitle><DialogDescription>Team members can be assigned to events and used for booking availability.</DialogDescription></DialogHeader><div className="grid gap-4"><label className="grid gap-2 text-sm font-semibold">Name<Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Alex Morgan" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Email<Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label><label className="grid gap-2 text-sm font-semibold">Phone<Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label></div><label className="grid gap-2 text-sm font-semibold">Role<Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Photographer" /></label><label className="grid gap-2 text-sm font-semibold">Notes<Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label><div className="flex items-center justify-between rounded-lg bg-[#fafafa] p-4"><div><p className="text-sm font-semibold">Active team member</p><p className="mt-1 text-xs text-[#777]">Inactive people stay in history but are not auto-assigned.</p></div><Switch checked={draft.active} onCheckedChange={(active) => setDraft({ ...draft, active })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={onSave} disabled={busy} className="bg-[#6337d8] text-white">{busy && <Loader2 className="size-4 animate-spin" />} Save</Button></DialogFooter></DialogContent></Dialog>;
}

function newShareLinkDraft() {
  return {
    recipientName: "",
    recipientEmail: "",
    serviceId: "",
    expiresAt: localDateTime(new Date(Date.now() + 7 * 86400000)),
    sendEmail: false,
  };
}

function localDateTime(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function shareLinkStatus(item: BookingShareLinkRecord): "active" | "booked" | "expired" {
  if (item.usedAt || item.bookingEventId) return "booked";
  return +new Date(item.expiresAt) <= Date.now() ? "expired" : "active";
}

function ShareLinkStatusBadge({ status }: { status: "active" | "booked" | "expired" }) {
  const classes = status === "active" ? "bg-emerald-50 text-emerald-700" : status === "booked" ? "bg-[#efe9ff] text-[#6337d8]" : "bg-[#f1f1f1] text-[#777]";
  return <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide", classes)}>{status}</span>;
}

function formatShortDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function StatusBadge({ status }: { status: BookingEventRecord["status"] }) {
  const classes = status === "confirmed" ? "bg-emerald-50 text-emerald-700" : status === "pending" ? "bg-amber-50 text-amber-700" : status === "completed" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700";
  return <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide", classes)}>{status}</span>;
}

function newEventDraft(date: Date): EventDraft {
  const start = new Date(date);
  start.setHours(Math.max(9, new Date().getHours() + (isSameDay(date, new Date()) ? 1 : 0)), 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60000);
  return { title: "", startAt: format(start, "yyyy-MM-dd'T'HH:mm"), endAt: format(end, "yyyy-MM-dd'T'HH:mm"), location: "", notes: "", coworkerIds: [] };
}

function toLocalInput(value: string) {
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd'T'HH:mm");
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "T";
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

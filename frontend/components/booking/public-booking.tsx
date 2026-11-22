"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PublicBookingService = {
  _id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  currency: string;
  timezone?: string;
  confirmationMessage?: string;
  location: string;
  sessionStyle?: "full" | "mini";
  coverImageUrl?: string;
  intakeFields?: Array<{ name: string; label: string; type: string; required: boolean; options?: string }>;
  paymentPolicy?: "none" | "manual";
  bookingRules?: { minNoticeHours?: number; maxAdvanceDays?: number };
};

type PublicBookingData = {
  owner: { name: string; avatar?: string; website?: string; email?: string; phoneNumber?: string; businessAddress?: string };
  profile?: { socialLinks?: { instagram?: string; facebook?: string; youtube?: string; linkedin?: string } };
  settings: {
    timezone: string; minNoticeHours: number; maxAdvanceDays: number; confirmationMessage: string;
    welcomeMessage?: string; showSocialLinks?: boolean; showWebsite?: boolean; showContactEmail?: boolean;
    showPhoneNumber?: boolean; showBusinessAddress?: boolean;
  };
  services: PublicBookingService[];
  invite?: {
    recipientName?: string;
    recipientEmail?: string;
    serviceId?: string;
    serviceName?: string;
    expiresAt: string;
  };
};

type Slot = { startAt: string; endAt: string };

export function PublicBooking({ identifier, inviteToken = "", initialServiceId = "", data }: { identifier: string; inviteToken?: string; initialServiceId?: string; data: PublicBookingData }) {
  const serviceId = data.invite?.serviceId || (data.services.some((service) => service._id === initialServiceId) ? initialServiceId : "");
  const [date, setDate] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [slotBusy, setSlotBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [form, setForm] = useState({
    clientName: data.invite?.recipientName || "",
    clientEmail: data.invite?.recipientEmail || "",
    clientPhone: "",
    notes: "",
  });
  const [intakeResponses, setIntakeResponses] = useState<Record<string, string>>({});
  const activeService = useMemo(() => data.services.find((item) => item._id === serviceId), [data.services, serviceId]);

  useEffect(() => {
    if (!serviceId || !date) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear stale slots when a booking selection is incomplete.
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotBusy(true);
    setSelected(null);
    setNotice("");
    fetch(`/api/public/bookings/${encodeURIComponent(identifier)}/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || "Could not load available times");
        if (!cancelled) setSlots(payload?.data?.slots ?? []);
      })
      .catch((error) => !cancelled && setNotice(error instanceof Error ? error.message : "Could not load available times"))
      .finally(() => !cancelled && setSlotBusy(false));
    return () => { cancelled = true; };
  }, [identifier, inviteToken, serviceId, date]);

  const submit = async () => {
    if (!selected) return setNotice("Choose an available time first");
    if (!form.clientName.trim() || !/^\S+@\S+\.\S+$/.test(form.clientEmail.trim())) return setNotice("Enter your name and a valid email");
    setSubmitBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/public/bookings/${encodeURIComponent(identifier)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, intakeResponses, serviceId, date, startAt: selected.startAt, inviteToken: inviteToken || undefined }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Could not create your booking");
      setConfirmation(payload?.data?.confirmationMessage || activeService?.confirmationMessage || data.settings.confirmationMessage || "Your booking request has been received.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create your booking");
    } finally {
      setSubmitBusy(false);
    }
  };

  if (confirmation) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f6f4f0] p-5"><div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-12"><CheckCircle2 className="mx-auto size-14 text-emerald-500" /><p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-[#8a8a8a]">Booking received</p><h1 className="mt-3 text-3xl font-semibold text-[#202326]">Thank you, {form.clientName}.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#6c6c6c]">{confirmation}</p>{selected && <div className="mt-7 rounded-2xl bg-[#f7f5fb] p-4 text-sm text-[#54436f]"><strong>{activeService?.name}</strong><br />{formatSlot(selected.startAt, activeService?.timezone || data.settings.timezone)} · {data.settings.timezone}</div>}</div></main>;
  }

  // The base Booking Site URL is a storefront. A session detail/booking flow is shown only
  // after a guest selects a public session or opens a private invitation.
  if (!inviteToken && !initialServiceId) {
    return <PublicBookingCatalog identifier={identifier} data={data} />;
  }

  return (
    <main className="min-h-screen bg-[#f6f4f0] px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          {data.owner.avatar ? <img src={data.owner.avatar} alt="" className="mx-auto size-16 rounded-full object-cover" /> : <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#6337d8] text-xl font-bold text-white">{data.owner.name.slice(0, 2).toUpperCase()}</div>}
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[#8d8d8d]">Book a session</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#202326] sm:text-4xl">{data.owner.name}</h1>
          <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm leading-6 text-[#737373]">{data.settings.welcomeMessage || "Welcome to my booking site. Please follow the instructions to book a session."}</p>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-[#929292]">Choose a session, pick an available time, and send your booking request.</p>
        </header>

        {data.invite && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#d9cef6] bg-[#f8f5ff] px-5 py-4 text-sm text-[#5f4b7d] shadow-sm">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-[#6337d8]" />
              <div>
                <p className="font-semibold text-[#3d2c5d]">
                  Private booking invitation{data.invite.recipientName ? ` for ${data.invite.recipientName}` : ""}
                </p>
                <p className="mt-1 leading-6">
                  {data.invite.serviceName ? `This link is reserved for ${data.invite.serviceName}. ` : ""}
                  It can be used once and expires {formatInviteExpiry(data.invite.expiresAt)}.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-3xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-7">
            {!data.invite && <Link href={"/book/" + encodeURIComponent(identifier)} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[#6e5a8b] transition hover:text-[#6337d8]"><ArrowLeft className="size-4"/> All sessions</Link>}
            <Step number="1" title={data.invite ? "Your invited session" : "Your session"} />
            {activeService && <div className="mt-4 overflow-hidden rounded-2xl border border-[#ece8f0]">
              {activeService.coverImageUrl && isDisplayableImage(activeService.coverImageUrl) ? <img src={activeService.coverImageUrl} alt={activeService.name} className="h-48 w-full object-cover sm:h-56" /> : <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[#eee8fb] to-[#f7f4ed]"><CalendarDays className="size-10 text-[#8067ad]" /></div>}
              <div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#25212b]">{activeService.name}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#777]">{activeService.description || "Photography session"}</p></div><span className="shrink-0 rounded-full bg-[#f2edff] px-3 py-1.5 text-xs font-semibold text-[#6337d8]">{formatSessionPrice(activeService)}</span></div><div className="mt-4 flex flex-wrap gap-4 text-xs text-[#777]"><span className="flex items-center gap-1.5"><Clock3 className="size-4"/>{activeService.durationMinutes} minutes</span>{activeService.location && <span className="flex items-center gap-1.5"><MapPin className="size-4"/>{activeService.location}</span>}</div></div>
            </div>}
            {activeService && <><div className="mt-8"><Step number="2" title="Pick a date" /><Input type="date" min={format(new Date(), "yyyy-MM-dd")} max={format(addDays(new Date(), activeService.bookingRules?.maxAdvanceDays || data.settings.maxAdvanceDays), "yyyy-MM-dd")} value={date} onChange={(e) => setDate(e.target.value)} className="mt-4 h-12" /></div><div className="mt-8"><Step number="3" title="Choose an available time" /><p className="mt-2 text-xs text-[#888]">Times shown in {activeService?.timezone || data.settings.timezone}.</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{slotBusy ? <div className="col-span-full flex h-24 items-center justify-center"><Loader2 className="size-5 animate-spin text-[#6337d8]" /></div> : slots.map((slot) => <button key={slot.startAt} type="button" onClick={() => setSelected(slot)} className={cn("h-11 rounded-xl border text-sm font-semibold transition", selected?.startAt === slot.startAt ? "border-[#6337d8] bg-[#6337d8] text-white" : "border-[#dfdfdf] bg-white text-[#444] hover:border-[#6337d8]")}>{timeOnly(slot.startAt, activeService?.timezone || data.settings.timezone)}</button>)}{!slotBusy && !slots.length && <div className="col-span-full rounded-xl bg-[#fafafa] p-5 text-center text-sm text-[#888]">No open times on this date. Try another day.</div>}</div></div></>}
          </section>

          <aside className="h-fit rounded-3xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-7">
            <Step number="4" title="Your details" />
            <div className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-semibold">Name<Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Your full name" /></label><label className="grid gap-2 text-sm font-semibold">Email<Input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder="you@example.com" readOnly={Boolean(data.invite?.recipientEmail)} className={data.invite?.recipientEmail ? "bg-[#f5f3f8]" : undefined} /></label><label className="grid gap-2 text-sm font-semibold">Phone <span className="font-normal text-[#999]">optional</span><Input value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} /></label><label className="grid gap-2 text-sm font-semibold">Anything we should know? <span className="font-normal text-[#999]">optional</span><Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></div>
            {(activeService?.intakeFields || []).map((field) => (
              <label key={field.name} className="mt-4 grid gap-2 text-sm font-semibold">
                {field.label}{field.required ? " *" : ""}
                {field.type === "textarea" ? (
                  <Textarea rows={3} required={field.required} value={intakeResponses[field.name] || ""}
                    onChange={(e) => setIntakeResponses({ ...intakeResponses, [field.name]: e.target.value })} />
                ) : field.type === "select" ? (
                  <select required={field.required} className="h-10 rounded-lg border border-[#ddd] px-3 text-sm"
                    value={intakeResponses[field.name] || ""} onChange={(e) => setIntakeResponses({ ...intakeResponses, [field.name]: e.target.value })}>
                    <option value="">Choose an option</option>
                    {String(field.options || "").split(",").map((option) => option.trim()).filter(Boolean).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <Input type={field.type === "date" ? "date" : "text"} required={field.required}
                    value={intakeResponses[field.name] || ""}
                    onChange={(e) => setIntakeResponses({ ...intakeResponses, [field.name]: e.target.value })} />
                )}
              </label>
            ))}
            {activeService?.paymentPolicy === "manual" && activeService.price > 0 && (
              <p className="mt-6 rounded-xl bg-[#f7f2ff] p-4 text-xs leading-6 text-[#69558f]">
                Session price: {activeService.currency} {activeService.price}. Payment will be arranged directly with the studio; this booking form does not charge your card.
              </p>
            )}
            {selected && <div className="mt-5 rounded-2xl bg-[#f7f5fb] p-4 text-sm leading-6 text-[#5f4b7d]"><div className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4" />{formatSlot(selected.startAt, activeService?.timezone || data.settings.timezone)}</div><p className="mt-1">{activeService?.name}</p></div>}
            {notice && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{notice}</p>}
            <Button onClick={() => void submit()} disabled={!selected || submitBusy || !activeService} className="mt-6 h-12 w-full rounded-xl bg-[#6337d8] text-white hover:bg-[#5527c9]">{submitBusy && <Loader2 className="size-4 animate-spin" />} Request booking</Button>
            <p className="mt-4 text-center text-[11px] leading-5 text-[#999]">Submitting a request reserves only the selected time. Your photographer will confirm it according to their booking settings.</p>
          </aside>
        </div>
        <BookingSiteFooter data={data} />
      </div>
    </main>
  );
}

function Step({ number, title }: { number: string; title: string }) { return <div className="flex items-center gap-3"><span className="flex size-7 items-center justify-center rounded-full bg-[#efe9ff] text-xs font-bold text-[#6337d8]">{number}</span><h2 className="font-semibold text-[#2a2a2a]">{title}</h2></div>; }
function timeOnly(value: string, timeZone: string) { return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatSlot(value: string, timeZone: string) { return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatInviteExpiry(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function PublicBookingCatalog({ identifier, data }: { identifier: string; data: PublicBookingData }) {
  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <section className="relative overflow-hidden bg-[#241b35] text-white">
        <div className="pointer-events-none absolute -right-24 -top-40 size-[30rem] rounded-full bg-[#7250ad]/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-10">
          <div className="flex items-center gap-3">
            {data.owner.avatar && isDisplayableImage(data.owner.avatar) ? <img src={data.owner.avatar} alt="" className="size-11 rounded-full border border-white/20 object-cover" /> : <div className="flex size-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">{(data.owner.name || "S").slice(0, 2).toUpperCase()}</div>}
            <span className="text-sm font-semibold tracking-wide">{data.owner.name || "Studio"}</span>
          </div>
          <div className="mt-16 max-w-3xl sm:mt-20">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#c5b5e5]">Booking site</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Find the session that feels like you.</h1>
            <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-7 text-white/70 sm:text-base">{data.settings.welcomeMessage || "Explore our photography sessions and choose the experience that suits you. Pick your session to see available dates and times."}</p>
            <a href="#sessions" className="mt-8 inline-flex h-12 items-center gap-3 bg-white px-6 text-sm font-semibold text-[#2c2140] transition hover:bg-[#eee8f7]">Explore sessions <ArrowRight className="size-4" /></a>
          </div>
        </div>
      </section>
      <section id="sessions" className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#806c9d]">Choose your experience</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#25212b] sm:text-3xl">Available sessions</h2></div><span className="text-xs text-[#88818e]">{data.services.length} {data.services.length === 1 ? "session" : "sessions"}</span></div>
        {data.services.length ? <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{data.services.map((service) => (
          <Link key={service._id} href={"/book/" + encodeURIComponent(identifier) + "?service=" + encodeURIComponent(service._id)} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e9e5ed] bg-white shadow-[0_8px_28px_rgba(37,29,48,0.04)] transition duration-200 hover:-translate-y-1 hover:border-[#d4c5ec] hover:shadow-[0_18px_42px_rgba(37,29,48,0.10)]">
            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#eee8f7] to-[#e9e5df]">{service.coverImageUrl && isDisplayableImage(service.coverImageUrl) ? <img src={service.coverImageUrl} alt={service.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" /> : <div className="flex h-full items-center justify-center"><CalendarDays className="size-12 text-[#9885b4]" /></div>}<span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d4a78] shadow-sm">{service.sessionStyle === "mini" ? "Mini session" : "Full session"}</span></div>
            <div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold text-[#28232e] transition group-hover:text-[#6337d8]">{service.name}</h3><span className="shrink-0 text-sm font-semibold text-[#6337d8]">{formatSessionPrice(service)}</span></div><p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-[#77717e]">{service.description || "A photography experience, thoughtfully planned around you."}</p><div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#f0edf2] pt-4 text-xs text-[#817b87]"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{service.durationMinutes} minutes</span>{service.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{service.location}</span>}</div><span className="mt-6 inline-flex h-11 items-center justify-center gap-2 bg-[#6337d8] px-4 text-xs font-semibold text-white transition group-hover:bg-[#5129be]">Book this session <ArrowRight className="size-4" /></span></div>
          </Link>
        ))}</div> : <div className="mt-8 rounded-2xl border border-dashed border-[#dcd5e4] bg-white px-6 py-16 text-center"><CalendarDays className="mx-auto size-10 text-[#9b8bad]" /><h3 className="mt-4 text-lg font-semibold text-[#302a38]">No sessions available right now</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#817b87]">Please check back later or contact the studio for more information.</p></div>}
      </section>
      <BookingSiteFooter data={data} />
    </main>
  );
}

function BookingSiteFooter({ data }: { data: PublicBookingData }) {
  const hasSocial = data.settings.showSocialLinks !== false && Object.values(data.profile?.socialLinks || {}).some(Boolean);
  const hasDetails = (data.settings.showWebsite && data.owner.website) || (data.settings.showContactEmail && data.owner.email) || (data.settings.showPhoneNumber && data.owner.phoneNumber) || (data.settings.showBusinessAddress && data.owner.businessAddress);
  if (!hasSocial && !hasDetails) return null;
  return <footer className="mx-auto mt-4 flex max-w-6xl flex-wrap items-start justify-between gap-6 border-t border-[#e8e3e9] px-5 py-8 text-sm text-[#77717e] sm:px-8">
    {hasSocial && <div className="flex flex-wrap gap-4">{Object.entries(data.profile?.socialLinks || {}).map(([network, url]) => typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://")) ? <a key={network} href={url} target="_blank" rel="noreferrer" className="font-medium capitalize hover:text-[#6337d8]">{network}</a> : null)}</div>}
    {hasDetails && <div className="flex flex-wrap gap-x-5 gap-y-2">{data.settings.showWebsite && data.owner.website && <a href={data.owner.website} target="_blank" rel="noreferrer" className="hover:text-[#6337d8]">Website</a>}{data.settings.showContactEmail && data.owner.email && <a href={"mailto:" + data.owner.email} className="hover:text-[#6337d8]">{data.owner.email}</a>}{data.settings.showPhoneNumber && data.owner.phoneNumber && <a href={"tel:" + data.owner.phoneNumber} className="hover:text-[#6337d8]">{data.owner.phoneNumber}</a>}{data.settings.showBusinessAddress && data.owner.businessAddress && <span>{data.owner.businessAddress}</span>}</div>}
  </footer>;
}

function isDisplayableImage(value: string) { return value.startsWith("https://") || value.startsWith("http://") || (value.startsWith("/") && !value.startsWith("//")); }
function formatSessionPrice(service: PublicBookingService) {
  if (!Number(service.price)) return "Free";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: service.currency || "USD", maximumFractionDigits: 2 }).format(service.price); }
  catch { return (service.currency || "USD") + " " + Number(service.price).toFixed(2); }
}


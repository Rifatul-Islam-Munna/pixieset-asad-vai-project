"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { CalendarDays, CheckCircle2, Clock3, Loader2, MapPin } from "lucide-react";
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
  location: string;
};

type PublicBookingData = {
  owner: { name: string; avatar?: string; website?: string };
  settings: { timezone: string; minNoticeHours: number; maxAdvanceDays: number; confirmationMessage: string };
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

export function PublicBooking({ identifier, inviteToken = "", data }: { identifier: string; inviteToken?: string; data: PublicBookingData }) {
  const [serviceId, setServiceId] = useState(data.invite?.serviceId || data.services[0]?._id || "");
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
  const activeService = useMemo(() => data.services.find((item) => item._id === serviceId), [data.services, serviceId]);

  useEffect(() => {
    if (!serviceId || !date) { setSlots([]); return; }
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
        body: JSON.stringify({ ...form, serviceId, date, startAt: selected.startAt, inviteToken: inviteToken || undefined }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Could not create your booking");
      setConfirmation(payload?.data?.confirmationMessage || data.settings.confirmationMessage || "Your booking request has been received.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create your booking");
    } finally {
      setSubmitBusy(false);
    }
  };

  if (confirmation) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f6f4f0] p-5"><div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-12"><CheckCircle2 className="mx-auto size-14 text-emerald-500" /><p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-[#8a8a8a]">Booking received</p><h1 className="mt-3 text-3xl font-semibold text-[#202326]">Thank you, {form.clientName}.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#6c6c6c]">{confirmation}</p>{selected && <div className="mt-7 rounded-2xl bg-[#f7f5fb] p-4 text-sm text-[#54436f]"><strong>{activeService?.name}</strong><br />{formatSlot(selected.startAt, data.settings.timezone)} · {data.settings.timezone}</div>}</div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f6f4f0] px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          {data.owner.avatar ? <img src={data.owner.avatar} alt="" className="mx-auto size-16 rounded-full object-cover" /> : <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#6337d8] text-xl font-bold text-white">{data.owner.name.slice(0, 2).toUpperCase()}</div>}
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[#8d8d8d]">Book a session</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#202326] sm:text-4xl">{data.owner.name}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#737373]">Choose a session, pick an available time, and send your booking request.</p>
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
            <Step number="1" title="Choose a booking type" />
            <div className="mt-4 grid gap-3">
              {data.services.map((service) => <button key={service._id} type="button" onClick={() => setServiceId(service._id)} className={cn("rounded-2xl border p-4 text-left transition", serviceId === service._id ? "border-[#6337d8] bg-[#faf8ff] ring-1 ring-[#6337d8]" : "border-[#e8e8e8] hover:border-[#cabeea]")}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-[#252525]">{service.name}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-[#777]">{service.description || "Photography session"}</p></div>{service.price > 0 && <span className="shrink-0 text-sm font-semibold text-[#6337d8]">{service.currency} {service.price}</span>}</div><div className="mt-3 flex flex-wrap gap-3 text-xs text-[#777]"><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />{service.durationMinutes} min</span>{service.location && <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{service.location}</span>}</div></button>)}
              {!data.services.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-[#888]">No booking types are currently available.</div>}
            </div>

            {activeService && <><div className="mt-8"><Step number="2" title="Pick a date" /><Input type="date" min={format(new Date(), "yyyy-MM-dd")} max={format(addDays(new Date(), data.settings.maxAdvanceDays), "yyyy-MM-dd")} value={date} onChange={(e) => setDate(e.target.value)} className="mt-4 h-12" /></div><div className="mt-8"><Step number="3" title="Choose an available time" /><p className="mt-2 text-xs text-[#888]">Times shown in {data.settings.timezone}.</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{slotBusy ? <div className="col-span-full flex h-24 items-center justify-center"><Loader2 className="size-5 animate-spin text-[#6337d8]" /></div> : slots.map((slot) => <button key={slot.startAt} type="button" onClick={() => setSelected(slot)} className={cn("h-11 rounded-xl border text-sm font-semibold transition", selected?.startAt === slot.startAt ? "border-[#6337d8] bg-[#6337d8] text-white" : "border-[#dfdfdf] bg-white text-[#444] hover:border-[#6337d8]")}>{timeOnly(slot.startAt, data.settings.timezone)}</button>)}{!slotBusy && !slots.length && <div className="col-span-full rounded-xl bg-[#fafafa] p-5 text-center text-sm text-[#888]">No open times on this date. Try another day.</div>}</div></div></>}
          </section>

          <aside className="h-fit rounded-3xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-7">
            <Step number="4" title="Your details" />
            <div className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-semibold">Name<Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Your full name" /></label><label className="grid gap-2 text-sm font-semibold">Email<Input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder="you@example.com" readOnly={Boolean(data.invite?.recipientEmail)} className={data.invite?.recipientEmail ? "bg-[#f5f3f8]" : undefined} /></label><label className="grid gap-2 text-sm font-semibold">Phone <span className="font-normal text-[#999]">optional</span><Input value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} /></label><label className="grid gap-2 text-sm font-semibold">Anything we should know? <span className="font-normal text-[#999]">optional</span><Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></div>
            {selected && <div className="mt-5 rounded-2xl bg-[#f7f5fb] p-4 text-sm leading-6 text-[#5f4b7d]"><div className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4" />{formatSlot(selected.startAt, data.settings.timezone)}</div><p className="mt-1">{activeService?.name}</p></div>}
            {notice && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{notice}</p>}
            <Button onClick={() => void submit()} disabled={!selected || submitBusy || !activeService} className="mt-6 h-12 w-full rounded-xl bg-[#6337d8] text-white hover:bg-[#5527c9]">{submitBusy && <Loader2 className="size-4 animate-spin" />} Request booking</Button>
            <p className="mt-4 text-center text-[11px] leading-5 text-[#999]">Submitting a request reserves only the selected time. Your photographer will confirm it according to their booking settings.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Step({ number, title }: { number: string; title: string }) { return <div className="flex items-center gap-3"><span className="flex size-7 items-center justify-center rounded-full bg-[#efe9ff] text-xs font-bold text-[#6337d8]">{number}</span><h2 className="font-semibold text-[#2a2a2a]">{title}</h2></div>; }
function timeOnly(value: string, timeZone: string) { return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatSlot(value: string, timeZone: string) { return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatInviteExpiry(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

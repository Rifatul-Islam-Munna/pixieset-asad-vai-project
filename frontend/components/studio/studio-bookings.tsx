"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { StudioCalendarSync } from "./studio-calendar-sync";
import { StudioSessionShare } from "./studio-session-share";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Copy, ExternalLink,
  ImagePlus, ListChecks, Loader2, Plus, Trash2, UploadCloud, X,
} from "lucide-react";
import {
  studioCreateBookingEvent, studioCreateBookingService, studioDeleteBookingEvent,
  studioDeleteBookingService, studioUpdateBookingEvent, studioUpdateBookingService,
  studioUpdateBookingSettings, studioUploadSessionCover,
  type StudioBookings, type StudioSession, type StudioSessionType,
} from "@/actions/studio";

const BASE = "/dashboard/studio-management";
const INPUT = "h-11 w-full border border-[#e7e5eb] bg-white px-3 text-sm outline-none focus:border-[#6337d8]";
const BTN = "inline-flex h-10 items-center justify-center gap-2 bg-[#6337d8] px-5 text-sm font-semibold text-white hover:bg-[#5124bf] disabled:opacity-50";
const OUT = "inline-flex h-10 items-center justify-center gap-2 border border-[#e6e3ea] px-4 text-sm hover:bg-[#f8f7fa]";
const heading = "text-xl font-medium tracking-tight text-[#211f28]";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dateValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (x: number) => String(x).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}
function when(value?: string) {
  if (!value) return "TBD";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function money(value: number, currency = "EUR") {
  return currency + " " + (value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function bookingSiteUrl(identifier: string, origin: string) {
  const raw = String(process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").trim();
  const host = raw.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].toLowerCase();
  if (host && host !== "localhost" && host !== "127.0.0.1") return "https://" + identifier + "." + host + "/book/" + encodeURIComponent(identifier);
  return origin + "/book/" + encodeURIComponent(identifier);
}
function dateKey(value: string | Date) {
  const d = new Date(value);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function StudioBookingsPage({
  page, data, refresh, notify, sessionTypeId,
}: {
  page: string; data: StudioBookings | null; refresh: () => Promise<void>; notify: (message: string) => void; sessionTypeId?: string;
}) {
  const router = useRouter();
  const [savedService, setSavedService] = useState<StudioSessionType | null>(null);
  const [sharingService, setSharingService] = useState<StudioSessionType | null>(null);
  const [calendarSyncOpen,setCalendarSyncOpen] = useState(false);
  const [calendarFilter,setCalendarFilter] = useState<"all"|"confirmed"|"pending"|"events">("all");
  const [selectedCalendarDate,setSelectedCalendarDate] = useState<Date|null>(null);
  const [sessionEditor, setSessionEditor] = useState<StudioSession | "new" | "block" | null>(null);
  const [newSessionServiceId, setNewSessionServiceId] = useState("");
  const [selectedTab, setSelectedTab] = useState("All Sessions");
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [filter, setFilter] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [setting, setSetting] = useState<StudioBookings["settings"]>({
    enabled: true, timezone: "UTC", minNoticeHours: 24, maxAdvanceDays: 180,
    slotIntervalMinutes: 30, autoConfirm: false, confirmationMessage: "",
    welcomeMessage: "Welcome to my booking site. Please follow the instructions to book a session.",
    showSocialLinks: true, showWebsite: false, showContactEmail: false, showPhoneNumber: false, showBusinessAddress: false,
    businessHours: [],
  });
  const [now] = useState(Date.now);
  const [error, setError] = useState("");


  useEffect(() => {
    // A refreshed booking settings response replaces the editable form's prior server values.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data?.settings) setSetting({ ...data.settings, welcomeMessage: data.settings.welcomeMessage || "Welcome to my booking site. Please follow the instructions to book a session.", showSocialLinks: data.settings.showSocialLinks ?? true, showWebsite: data.settings.showWebsite ?? false, showContactEmail: data.settings.showContactEmail ?? false, showPhoneNumber: data.settings.showPhoneNumber ?? false, showBusinessAddress: data.settings.showBusinessAddress ?? false, businessHours: (data.settings.businessHours || []).map((h) => ({ ...h })) });
  }, [data?.settings]);

  const sessions = data?.events || [];
  const services = data?.services || [];
  const filtered = sessions.filter((s) => {
    const v = selectedTab.toLowerCase();
    const today = now;
    const start = new Date(s.startAt).getTime();
    const statusOk = selectedTab === "All Sessions" ||
      (v === "upcoming" && start >= today && s.status !== "cancelled") ||
      (v === "past" && start < today && s.status !== "cancelled") ||
      (v === "inquiry" && s.status === "pending") ||
      (v === "awaiting client" && s.status === "awaiting-client") ||
      (v === "cancelled" && s.status === "cancelled");
    const searchOk = !filter || [s.title, s.clientName, s.clientEmail].join(" ").toLowerCase().includes(filter.toLowerCase());
    return statusOk && searchOk;
  });
  const awaitingServices = selectedTab === "Awaiting Client"
    ? services.filter((service) => service.active && service.status !== "draft" &&
      (!filter || [service.name, service.description, service.bookingVisibility].join(" ").toLowerCase().includes(filter.toLowerCase())))
    : [];

  const changeStatus = async (session: StudioSession, status: string) => {
    try {
      await studioUpdateBookingEvent(session._id, { status });
      notify("Session updated");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update session"); }
  };
  const removeService = async (item: StudioSessionType) => {
    if (!window.confirm("Delete this session type? Existing bookings will remain.")) return;
    try { await studioDeleteBookingService(item._id); notify("Session type deleted"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  };

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstGrid = new Date(monthStart);
  firstGrid.setDate(firstGrid.getDate() - firstGrid.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(firstGrid);
    d.setDate(d.getDate() + i);
    return d;
  });
  const calendarTitle = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const calendarSessions = (d: Date) => sessions.filter((s) => {
    if (dateKey(s.startAt) !== dateKey(d)) return false;
    if (calendarFilter === "events") return s.kind === "event";
    if (calendarFilter === "confirmed") return s.status === "confirmed";
    if (calendarFilter === "pending") return s.status === "pending";
    return true;
  });
  const navigateCalendar=(direction:number)=>{
    if(view==="month")setMonthDate(new Date(monthDate.getFullYear(),monthDate.getMonth()+direction,1));
    else {const day=new Date(monthDate);day.setDate(day.getDate()+(view==="week"?7:1)*direction);setMonthDate(day);}
  };

  const link = data?.publicIdentifier && typeof window !== "undefined"
    ? bookingSiteUrl(data.publicIdentifier, window.location.origin)
    : "";
  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    notify("Booking link copied");
  };
  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setSettingsBusy(true); setError("");
    try { await studioUpdateBookingSettings({ enabled: true, welcomeMessage: setting.welcomeMessage, showSocialLinks: setting.showSocialLinks, showWebsite: setting.showWebsite, showContactEmail: setting.showContactEmail, showPhoneNumber: setting.showPhoneNumber, showBusinessAddress: setting.showBusinessAddress }); notify("Booking site saved"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save settings"); }
    finally { setSettingsBusy(false); }
  };

  if (!data) return <div className="flex min-h-[400px] items-center justify-center text-sm text-[#8e8b97]">Loading booking management…</div>;

  if (page === "session-types" && sessionTypeId) {
    const initial = (savedService?._id === sessionTypeId ? savedService : null) ||
      services.find((service) => service._id === sessionTypeId) || null;
    if (sessionTypeId !== "new" && !initial) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"><p className="text-sm text-[#777]">This session type could not be found.</p><button className={OUT} onClick={() => router.push(BASE + "/session-types")}>Back to Session Types</button></div>;
    return <ServiceEditor initial={initial} publicIdentifier={data.publicIdentifier} timezone={data.settings.timezone} defaultAvailability={data.settings.businessHours}
      onClose={() => router.push(BASE + "/session-types")}
      onSaved={async (saved, automatic) => {
        setSavedService(saved);
        if (sessionTypeId === "new") router.replace(BASE + "/session-types/" + encodeURIComponent(saved._id));
        if (!automatic) notify(saved.status === "published" ? (initial?.status === "published" ? "Session changes saved" : "Session published") : "Draft saved");
      }} />;
  }

  return (
    <div className="space-y-8">
      {page === "session-types" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4"><h1 className={heading}>Session Types</h1>
            <button className={BTN} onClick={() => router.push(BASE + "/session-types/new")}><Plus className="size-4"/> New Session Type</button>
          </div>
          {!services.length ? <EmptyBooking icon="types" title="Create bookable session types" text="Set up full or mini photography sessions, availability, and pricing for clients." action="New Session Type" onClick={()=>router.push(BASE + "/session-types/new")}/> :
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((s) => <div key={s._id} className="border border-[#eceaf0] bg-white p-5">
                {s.coverImageUrl&&/^https:\/\//.test(s.coverImageUrl)&&<img src={s.coverImageUrl} alt="" loading="lazy" className="mb-4 h-32 w-full object-cover"/>}
                <div className="flex items-start justify-between"><div className="flex size-11 items-center justify-center text-white" style={{backgroundColor:s.sessionColor || "#6337d8"}}><CalendarDays className="size-5"/></div>
                  <span className={"px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] " + (s.status === "draft" ? "bg-amber-50 text-amber-700" : s.active ? "bg-emerald-50 text-emerald-700" : "bg-[#f1eff4] text-[#777]")}>{s.status === "draft" ? "Draft" : s.active ? "Published" : "Inactive"}</span></div>
                <h2 className="mt-5 text-lg font-semibold">{s.name}</h2>
                <p className="mt-1 line-clamp-2 min-h-9 text-sm text-[#777]">{s.description || "Bookable studio session"}</p>
                <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-[#555]">
                  <span><Clock3 className="mr-1 inline size-4"/>{s.durationMinutes} min</span>
                  <span className="font-semibold">{money(s.price,s.currency)}</span>
                </div>
                <div className="mt-5 flex flex-wrap justify-between gap-3">
                  <button onClick={()=>router.push(BASE + "/session-types/" + encodeURIComponent(s._id))} className="text-sm font-semibold text-[#6337d8]">Edit settings</button>
                  <button disabled={s.status === "draft" || !s.active} onClick={()=>setSharingService(s)} className="inline-flex items-center gap-2 text-sm font-semibold text-[#6337d8] disabled:cursor-not-allowed disabled:opacity-40"><Copy className="size-3.5"/>{s.bookingVisibility==="private"?"Private invitation":"Share"}</button>
                  <button onClick={()=>void removeService(s)} className="text-xs text-[#a19da9] hover:text-red-600">Delete</button>
                </div>
              </div>)}
            </div>}
        </>
      )}

      {page === "sessions" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6"><h1 className={heading}>Sessions</h1><input className={INPUT+" max-w-xs"} placeholder="Search email or client name" value={filter} onChange={(e)=>setFilter(e.target.value)}/></div>
            <button className={BTN} onClick={()=>{setNewSessionServiceId("");setSessionEditor("new");}}><Plus className="size-4"/> New Session</button>
          </div>
          <div className="flex flex-wrap gap-7 border-b border-[#f0eef1]">
            {["All Sessions","Upcoming","Inquiry","Awaiting Client","Past","Cancelled"].map((tab) =>
              <button key={tab} onClick={()=>setSelectedTab(tab)} className={"border-b-2 pb-3 text-[13px] " + (tab===selectedTab?"border-[#6337d8] font-semibold text-[#18151e]":"border-transparent text-[#777]")}>{tab}</button>)}
          </div>
          {!filtered.length && !awaitingServices.length ? <EmptyBooking icon="sessions" title={selectedTab === "Awaiting Client" ? "Nothing awaiting a client" : "No sessions found"} text={selectedTab === "Awaiting Client" ? "Published session types and bookings waiting for a client will appear here." : "Bookings matching this tab will appear here. You can also schedule a session manually."} action="New Session" onClick={()=>{setNewSessionServiceId("");setSessionEditor("new");}}/> :
            <div className="overflow-x-auto"><table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[10px] uppercase tracking-[.12em] text-[#92909b]"><th className="pb-3 font-medium">Session</th><th className="pb-3 font-medium">Client</th><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">Actions</th></tr></thead>
              <tbody>
                {awaitingServices.map((service)=><tr key={"service-"+service._id} className="border-b border-[#eee]">
                  <td className="py-5 font-medium">{service.name}<div className="text-xs font-normal text-[#999]">Published session type · {service.durationMinutes} min · {money(service.price,service.currency)}</div></td>
                  <td className="text-[#888]">Waiting for a client</td><td className="text-[#888]">Booking link active</td>
                  <td><span className="inline-flex bg-[#f3efff] px-2.5 py-1.5 text-xs font-medium text-[#6337d8]">Awaiting Client</span></td>
                  <td className="space-x-3 text-right whitespace-nowrap"><button className="text-[#6337d8]" onClick={()=>router.push(BASE+"/session-types/"+encodeURIComponent(service._id))}>Edit type</button><button className="text-[#6337d8]" onClick={()=>setSharingService(service)}>{service.bookingVisibility==="private"?"Invite":"Share"}</button></td>
                </tr>)}
                {filtered.map((s)=><tr key={s._id} className="border-b border-[#eee]">
                  <td className="py-5 font-medium">{s.title}<div className="text-xs font-normal text-[#999]">{s.serviceName || s.kind}</div></td>
                  <td>{s.clientName||"—"}</td><td>{when(s.startAt)}</td>
                  <td><select value={s.status} onChange={(e)=>void changeStatus(s,e.target.value)} className="border-0 bg-[#f7f6fa] px-2 py-2 text-xs"><option value="pending">Inquiry</option><option value="awaiting-client">Awaiting Client</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td>
                  <td className="space-x-3 text-right"><button className="text-[#6337d8]" onClick={()=>setSessionEditor(s)}>Edit</button><button className="text-[#aa9faf]" onClick={async()=>{if(window.confirm("Delete this event?")){await studioDeleteBookingEvent(s._id);await refresh();}}}>Delete</button></td>
                </tr>)}
              </tbody>
            </table></div>}
        </>
      )}

      {page === "calendar" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4"><h1 className={heading}>Calendar</h1>
            <div className="flex gap-3"><button className={OUT} onClick={()=>setSessionEditor("block")}>Block Off Time</button>
              <button className={BTN} onClick={()=>setCalendarSyncOpen(true)}>Calendar Sync</button></div></div>
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-[#f5f3fa]" onClick={()=>navigateCalendar(-1)} aria-label="Previous calendar period"><ArrowLeft className="size-4"/></button>
              <button onClick={()=>setMonthDate(new Date())} className="font-medium">Today</button>
              <button className="p-2 hover:bg-[#f5f3fa]" onClick={()=>navigateCalendar(1)} aria-label="Next calendar period"><ArrowRight className="size-4"/></button>
              <strong className="text-base">{view==="month"?calendarTitle:monthDate.toLocaleDateString(undefined,{dateStyle:"medium"})}</strong>
            </div>
            <div className="flex border border-[#eee]">{(["day","week","month"] as const).map((x)=><button key={x} onClick={()=>setView(x)} className={"px-4 py-2 text-xs font-semibold uppercase "+(view===x?"bg-[#f2eeff] text-[#6337d8]":"text-[#777]")}>{x}</button>)}</div>
            <label className="flex items-center gap-2 text-xs text-[#777]">Filter
              <select className="h-9 border border-[#eee] px-2" value={calendarFilter} onChange={e=>setCalendarFilter(e.target.value as typeof calendarFilter)}>
                <option value="all">All</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="events">Events / blocked time</option>
              </select>
            </label>
          </div>
          <div className="border border-[#e8e5eb]">
            {view==="month" ? <>
              <div className="grid grid-cols-7">{weekdays.map((day)=><div key={day} className="border-r border-b py-2 text-center text-[10px] font-semibold uppercase tracking-[.1em] text-[#98949f]">{day}</div>)}</div>
              <div className="grid grid-cols-7">{calendarDays.map((day,i)=>(
                <div key={i} className={"min-h-[125px] border-r border-b p-2 text-left align-top hover:bg-[#faf8ff] "+(day.getMonth()!==monthDate.getMonth()?"bg-[#fcfcfd] text-[#b9b6bc]":"")}>
                  <button className="grid size-6 place-items-center rounded-full text-xs hover:bg-[#f4eaff]" aria-label={"Add event on "+dateKey(day)} onClick={()=>{setSelectedCalendarDate(day);setMonthDate(day);setSessionEditor("new");}}>{day.getDate()}</button>
                  <div className="mt-2 space-y-1">{calendarSessions(day).slice(0,3).map((s)=><button key={s._id} onClick={()=>setSessionEditor(s)} className="block w-full truncate bg-[#eee9ff] px-1.5 py-1 text-left text-[10px] text-[#5434ac]" title={s.title}>{s.title}</button>)}
                    {calendarSessions(day).length>3&&<span className="text-[10px] text-[#777]">+{calendarSessions(day).length-3} more</span>}</div>
                </div>
              ))}</div>
            </>:<div className="space-y-2 p-5">{(view==="day" ? [monthDate] : Array.from({length:7},(_,i)=>{const d=new Date(monthDate);d.setDate(d.getDate()-d.getDay()+i);return d;})).map((day)=><div key={dateKey(day)} className="flex min-h-14 gap-4 border-b py-2"><div className="w-28 shrink-0 text-xs font-semibold">{day.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</div>
              <div className="flex-1 space-y-1">{calendarSessions(day).length ? calendarSessions(day).map((s)=><button onClick={()=>setSessionEditor(s)} key={s._id} className="block w-full bg-[#f4efff] p-2 text-left text-xs text-[#5131a3]">{when(s.startAt).split(",").pop()} · {s.title}</button>):<span className="text-xs text-[#bbb]">No sessions</span>}</div>
            </div>)}</div>}
          </div>
        </>
      )}

      {page === "booking-site" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className={heading}>Booking Site</h1>
            {link && <a className="inline-flex h-10 items-center justify-center gap-2 bg-[#16bfa5] px-5 text-sm font-semibold text-white hover:bg-[#109f8a]" href={link} target="_blank" rel="noopener noreferrer">View Site <ExternalLink className="size-4"/></a>}
          </div>
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_470px]">
            <form onSubmit={(event)=>void saveSettings(event)} className="min-w-0 space-y-6">
              <section className="border border-[#e9e7ed] bg-white p-5 sm:p-6">
                <label className="block text-xs font-semibold">Booking Site URL</label>
                <div className="mt-4 flex flex-wrap gap-2 bg-[#f5f6f6] p-2">
                  <input className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-[#34313a] outline-none" readOnly value={link || "Your booking site link will appear here"}/>
                  <button type="button" className="h-10 shrink-0 bg-white px-5 text-xs font-semibold text-[#504a58] hover:bg-[#f9f9f9]" disabled={!link} onClick={()=>void copyLink()}>Copy Link</button>
                </div>
                <p className="mt-3 max-w-xl text-xs leading-5 text-[#8a8590]">Share this public page with clients. Only published public session types will appear on the booking site.</p>
              </section>

              <section className="border border-[#e9e7ed] bg-white p-5 sm:p-6">
                <label className="block text-xs font-semibold">Welcome Message</label>
                <textarea maxLength={500} rows={6} className="mt-4 min-h-36 w-full resize-y border border-[#e7e5eb] p-4 text-sm leading-6 outline-none focus:border-[#16bfa5]" value={setting.welcomeMessage||""} onChange={(e)=>setSetting({...setting,welcomeMessage:e.target.value})} placeholder="Welcome to my booking site. Please follow the instructions to book a session."/>
                <p className="mt-2 text-right text-xs text-[#999]">{(setting.welcomeMessage||"").length}/500</p>
              </section>

              <section className="border border-[#e9e7ed] bg-white p-5 sm:p-6">
                <h2 className="text-sm font-semibold">Booking Site Info</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={setting.showSocialLinks!==false} onChange={(e)=>setSetting({...setting,showSocialLinks:e.target.checked})}/> Social Links</label>
                  <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(setting.showWebsite)} onChange={(e)=>setSetting({...setting,showWebsite:e.target.checked})}/> Website</label>
                  <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(setting.showContactEmail)} onChange={(e)=>setSetting({...setting,showContactEmail:e.target.checked})}/> Contact Email</label>
                  <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(setting.showPhoneNumber)} onChange={(e)=>setSetting({...setting,showPhoneNumber:e.target.checked})}/> Phone Number</label>
                  <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(setting.showBusinessAddress)} onChange={(e)=>setSetting({...setting,showBusinessAddress:e.target.checked})}/> Business Address</label>
                </div>
                <p className="mt-5 text-xs leading-5 text-[#8b8690]">To update these details, go to your Account Profile. Any information left blank will not appear on your booking site.</p>
                <div className="mt-4 space-y-2 text-xs text-[#777]">
                  {setting.showSocialLinks && Object.values(data.owner.socialLinks||{}).filter(Boolean).length===0 && <p>No social links added to your profile yet.</p>}
                  {setting.showWebsite && !data.owner.website && <p>No website added to your profile yet.</p>}
                  {setting.showContactEmail && !data.owner.email && <p>No contact email added to your profile yet.</p>}
                  {setting.showPhoneNumber && !data.owner.phoneNumber && <p>No phone number added to your profile yet.</p>}
                  {setting.showBusinessAddress && !data.owner.businessAddress && <p>No business address added to your profile yet.</p>}
                </div>
              </section>


              <button type="submit" className={BTN} disabled={settingsBusy}><Check className="size-4"/>{settingsBusy?"Saving…":"Save Booking Site"}</button>
            </form>

            <aside className="self-start bg-[#f3f4f4] p-5 sm:p-7">
              <div className="mx-auto min-h-[560px] max-w-[410px] bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,0.08)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  {data.owner.avatar ? <img src={data.owner.avatar} alt="" className="size-8 rounded-full object-cover"/> : <div className="grid size-8 place-items-center rounded-full bg-[#e8f5f1] text-xs font-bold text-[#159d85]">{data.owner.name.slice(0,1).toUpperCase()}</div>}
                  <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#3d3a42]">{data.owner.name}</span>
                  <div className="flex gap-1">{setting.showSocialLinks && Object.entries(data.owner.socialLinks||{}).filter(([,url])=>Boolean(url)).slice(0,3).map(([name])=><span key={name} className="text-[9px] text-[#666]">{name.slice(0,1).toUpperCase()}</span>)}</div>
                </div>
                <p className="mx-auto mt-7 max-w-[280px] text-center text-[10px] leading-4 text-[#333]">{setting.welcomeMessage||"Welcome to my booking site. Please follow the instructions to book a session."}</p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {services.filter((service)=>service.active&&service.status!=="draft"&&service.bookingVisibility!=="private").slice(0,6).map((service)=><div key={service._id} className="min-w-0">
                    {service.coverImageUrl?<img src={service.coverImageUrl} alt="" className="h-16 w-full object-cover"/>:<div className="h-16 bg-[#d9d9d9]"/>}
                    <p className="mt-2 truncate text-[9px] font-semibold text-[#333]">{service.name}</p>
                    <div className="mt-1 h-1 bg-[#dedede]"/>
                    <div className="mt-1 h-1 w-2/3 bg-[#e7e7e7]"/>
                  </div>)}
                </div>
                {!services.some((service)=>service.active&&service.status!=="draft"&&service.bookingVisibility!=="private") && <p className="mt-8 text-center text-[10px] text-[#999]">Published session types will appear here.</p>}
                <div className="mt-8 border-t border-[#eee] pt-4 text-[9px] text-[#777]">
                  {setting.showWebsite&&data.owner.website&&<p>{data.owner.website}</p>}
                  {setting.showContactEmail&&data.owner.email&&<p>{data.owner.email}</p>}
                  {setting.showPhoneNumber&&data.owner.phoneNumber&&<p>{data.owner.phoneNumber}</p>}
                  {setting.showBusinessAddress&&data.owner.businessAddress&&<p>{data.owner.businessAddress}</p>}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
      {error&&<p role="alert" className="bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {sessionEditor && <SessionEditor initial={typeof sessionEditor==="object"?sessionEditor:null} initialDate={selectedCalendarDate} block={sessionEditor==="block"} services={services} defaultServiceId={newSessionServiceId} onClose={()=>{setSessionEditor(null);setSelectedCalendarDate(null);setNewSessionServiceId("");}} onSaved={async()=>{setSessionEditor(null);setSelectedCalendarDate(null);setNewSessionServiceId("");notify("Session saved");await refresh();}}/>}
      {sharingService&&<StudioSessionShare service={sharingService} data={data} onClose={()=>setSharingService(null)} onChanged={refresh}/>}
      {calendarSyncOpen&&<StudioCalendarSync onClose={()=>setCalendarSyncOpen(false)}/>}
    </div>
  );
}

function EmptyBooking({ icon, title, text, action, onClick }: { icon:string; title:string; text:string; action:string; onClick:()=>void }) {
  return <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
    <div className="grid size-32 place-items-center rounded-full bg-[#f5f1ff] text-[#6337d8]">{icon==="types"?<ListChecks className="size-14 stroke-[1.15]"/>:<CalendarDays className="size-14 stroke-[1.15]"/>}</div>
    <h2 className="mt-6 text-base font-semibold">{title}</h2><p className="mt-2 max-w-[340px] text-sm leading-6 text-[#7d7986]">{text}</p>
    <button onClick={onClick} className={BTN+" mt-6"}><Plus className="size-4"/>{action}</button>
  </div>;
}

function ServiceEditor({ initial, publicIdentifier, timezone, defaultAvailability, onClose, onSaved }: { initial: StudioSessionType|null; publicIdentifier: string; timezone: string; defaultAvailability: Array<{day:number;enabled:boolean;start:string;end:string}>; onClose:()=>void; onSaved:(saved:StudioSessionType, automatic?:boolean)=>Promise<void> }) {
  const steps = ["General", "Availability", "Intake Form", "Payments", "Confirmation", "Booking Rules"];
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const hoursDefault = Array.from({ length: 7 }, (_, day) => ({
    day, enabled: day > 0 && day < 6, start: "09:00", end: "17:00",
  }));
  type IntakeField = { name: string; label: string; type: string; required: boolean; options?: string };
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    sessionStyle: initial?.sessionStyle || "full",
    sessionColor: initial?.sessionColor || "#16bfa5",
    createProjectOnBooking: initial?.createProjectOnBooking ?? true,
    projectStage: initial?.projectStage || "inquiry",
    projectType: initial?.projectType || "portrait",
    durationMinutes: initial?.durationMinutes || 60,
    price: initial?.price || 0,
    currency: initial?.currency || "EUR",
    location: initial?.location || "",
    active: initial?.active ?? false,
    coverImageUrl: initial?.coverImageUrl || "",
    bookingVisibility: initial?.bookingVisibility || "public",
    paymentPolicy: initial?.paymentPolicy || "none",
    confirmationMessage: initial?.confirmationMessage || "",
    timezone: initial?.timezone || timezone || "UTC",
    bookingRules: initial?.bookingRules || { minNoticeHours: 1, maxAdvanceDays: 180, slotIntervalMinutes: 30, autoConfirm: false },
  });
  const legacyHours = initial && defaultAvailability?.length ? defaultAvailability : hoursDefault;
  const [availability, setAvailability] = useState(initial?.availability?.length ? initial.availability.map((h) => ({ ...h })) : legacyHours.map((h) => ({ ...h })));
  const [sessionDates, setSessionDates] = useState(initial?.sessionDates?.map((item) => ({ ...item })) || []);
  const [intakeFields, setIntakeFields] = useState<IntakeField[]>(initial?.intakeFields?.map((x) => ({ ...x })) || []);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState("");
  const [serviceId, setServiceId] = useState(initial?._id || "");
  const [origin, setOrigin] = useState("");
  const lastSavedSnapshot = useRef<string | null>(null);
  const lastAttemptedSnapshot = useRef<string | null>(null);

  const isPublished = initial?.status === "published" || (!initial?.status && initial?.active === true);
  const savedSessionDates = sessionDates.filter((item) =>
    Boolean(item.date && item.start && item.end && item.end > item.start));
  const savedIntakeFields = intakeFields
    .filter((field) => Boolean(field.label.trim()))
    .map((field, index) => ({
      ...field,
      name: field.name || "question-" + (index + 1),
      label: field.label.trim(),
    }));
  const draftPayload = {
    ...form,
    status: isPublished ? "published" : "draft",
    active: isPublished ? (initial?.active ?? form.active) : false,
    availability,
    sessionDates: savedSessionDates,
    intakeFields: savedIntakeFields,
  };
  const draftSnapshot = JSON.stringify(draftPayload);
  const sessionLink = publicIdentifier && serviceId && origin
    ? bookingSiteUrl(publicIdentifier, origin) + "?service=" + encodeURIComponent(serviceId)
    : "";

  useEffect(() => {
    // The public origin is only available in the browser; the booking path itself is deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const save = useCallback(async (publish = false, automatic = false): Promise<boolean> => {
    if (!form.name.trim()) { setStep(0); setError("Session name is required"); return false; }
    if (uploadingCover) { setError("Wait for the cover image to finish uploading."); return false; }
    if (publish && !serviceId) { setError("Save the draft before publishing it."); return false; }
    if (publish && savedSessionDates.length !== sessionDates.length) {
      setStep(1); setError("Complete or remove every mini-session date before publishing."); return false;
    }
    if (publish && savedIntakeFields.length !== intakeFields.length) {
      setStep(2); setError("Give every booking question a label before publishing."); return false;
    }

    const payload = JSON.parse(draftSnapshot) as Record<string, unknown>;
    if (publish) {
      payload.status = "published";
      payload.active = true;
    }
    const snapshot = JSON.stringify(payload);
    if (!publish && serviceId && snapshot === lastSavedSnapshot.current) return true;
    lastAttemptedSnapshot.current = snapshot;
    setSaving(true);
    setError("");
    try {
      const saved = serviceId
        ? await studioUpdateBookingService(serviceId, payload)
        : await studioCreateBookingService(payload);
      setServiceId(saved._id);
      lastSavedSnapshot.current = snapshot;
      await onSaved(saved, automatic);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save session type");
      return false;
    } finally {
      setSaving(false);
    }
  }, [form.name, uploadingCover, serviceId, savedSessionDates.length, sessionDates.length,
    savedIntakeFields.length, intakeFields.length, draftSnapshot, onSaved]);

  useEffect(() => {
    if (lastSavedSnapshot.current === null) {
      lastSavedSnapshot.current = draftSnapshot;
      return;
    }
    if (!form.name.trim() || saving || uploadingCover ||
        draftSnapshot === lastSavedSnapshot.current ||
        draftSnapshot === lastAttemptedSnapshot.current) return;

    const timeout = window.setTimeout(() => {
      lastAttemptedSnapshot.current = draftSnapshot;
      void save(false, true);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [draftSnapshot, form.name, saving, uploadingCover, save]);

  const goNext = async () => {
    setError("");
    if (step < steps.length - 1) {
      const saved = await save(false);
      if (saved) setStep((current) => Math.min(steps.length - 1, current + 1));
      return;
    }
    if (isPublished) {
      const saved = await save(false);
      if (saved) onClose();
      return;
    }
    await save(true);
  };
  const closeEditor = async () => {
    if (form.name.trim()) {
      const saved = await save(false);
      if (!saved) return;
    }
    onClose();
  };
  const setDay = (day: number, field: string, value: boolean | string) => {
    setAvailability((old) => old.map((item) => item.day === day ? { ...item, [field]: value } : item));
  };
  const addSessionDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    const date = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    setSessionDates((old) => [...old, { date, start: "09:00", end: "17:00" }]);
  };
  const updateSessionDate = (index: number, field: "date" | "start" | "end", value: string) => {
    setSessionDates((old) => old.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  const setField = (index: number, field: keyof IntakeField, value: string | boolean) => {
    setIntakeFields((items) => items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  const uploadCover = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) { setError("Choose a JPG, PNG, WebP or AVIF image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Cover images must be 5 MB or smaller."); return; }
    setUploadingCover(true); setError("");
    try { const body = new FormData(); body.append("file", file); const url = await studioUploadSessionCover(body); setForm((current) => ({ ...current, coverImageUrl: url })); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Could not upload the cover image."); }
    finally { setUploadingCover(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#faf9fc] text-[#231e2d]">
      <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#ece9ef] bg-white px-4 py-3 sm:px-7 lg:px-9">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" disabled={saving || uploadingCover} onClick={() => void closeEditor()} className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-[#5f5967] hover:text-[#6337d8] disabled:opacity-50"><ArrowLeft className="size-4"/> Session Types</button>
          <span className="hidden h-6 w-px bg-[#ece9ef] sm:block"/>
          <span className="max-w-[220px] truncate text-sm font-semibold text-[#25212d] sm:max-w-[360px]">{form.name || "New session type"}</span>
          <span className={"shrink-0 rounded-full px-3 py-1 text-[10px] font-bold tracking-[.08em] " + (isPublished ? "bg-emerald-50 text-emerald-700" : "bg-[#f3f3f4] text-[#777]")}>{isPublished ? "PUBLISHED" : "DRAFT"}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span aria-live="polite" className="hidden text-xs text-[#8c8593] sm:inline">
            {saving ? "Saving…" : error ? "Could not save" : !form.name.trim() ? "Enter a name to start your draft" : "Changes save automatically"}
          </span>
          <button type="button" className={BTN} disabled={saving || uploadingCover} onClick={() => void goNext()}>
            {step < steps.length - 1 ? "Next" : isPublished ? "Done" : "Publish"}
            {step < steps.length - 1 && <ArrowRight className="size-4"/>}
          </button>
        </div>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1500px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-[#ece9ef] bg-white lg:border-b-0 lg:border-r lg:py-12">
          <p className="hidden px-6 pb-4 text-[10px] font-bold uppercase tracking-[.15em] text-[#a39da9] lg:block">Session Settings</p>
          <div className="flex gap-1 overflow-x-auto px-3 py-2 lg:block lg:px-0 lg:py-0">
            {(initial || serviceId ? steps : steps.slice(0, 1)).map((label, index) => (
              <button type="button" key={label} onClick={() => { setError(""); setStep(index); }} className={"my-1 flex h-11 shrink-0 items-center gap-3 border-b-2 px-4 text-left text-xs transition lg:h-12 lg:w-full lg:border-b-0 lg:border-l-2 lg:px-6 " +
                (step === index ? "border-[#6337d8] bg-[#f8f5ff] font-semibold text-[#6337d8]" :
                  "border-transparent text-[#847e8a] hover:bg-[#faf9fc]")}>
                <span className={"grid size-6 place-items-center rounded-full border text-[10px] " +
                  (step === index ? "border-[#6337d8] bg-[#6337d8] text-white" : "border-[#ddd]")}>{index + 1}</span>{label}
              </button>
            ))}
          </div>
          {!initial && !serviceId && <p className="hidden px-6 pt-5 text-xs leading-5 text-[#928b9a] lg:block">Your changes save automatically as a draft. Add a session name to unlock the remaining settings.</p>}
        </aside>
        <form onSubmit={(e) => { e.preventDefault(); void goNext(); }} className="mx-auto flex w-full max-w-[900px] flex-col px-5 pb-10 pt-8 sm:px-8 lg:pt-14">
          <div className="flex-1">
            {step === 0 && <>
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#6337d8]">General</p>
              <h1 className="mt-3 text-3xl font-medium">Create a new type of session</h1>
              <p className="mt-3 text-sm leading-6 text-[#8d8793]">Set up the photography sessions your clients can book online.</p>
              <label className="mt-10 block space-y-3 text-xs font-semibold">Name your session type *
                <input className={INPUT} placeholder="e.g. Family Portrait, Wedding, Holiday Minis" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}/>
              </label>
              <div className="mt-7 space-y-2">
                <label className="block text-xs font-semibold">Booking Link</label>
                <div className="flex flex-wrap gap-2">
                  <input className={INPUT+" min-w-0 flex-1"} readOnly value={form.bookingVisibility === "private"
                    ? "Invitation link is generated when you share this session"
                    : sessionLink || (form.name.trim() ? "Generating your booking link…" : "Enter a session name to generate your booking link")}/>
                  <button type="button" className={OUT} disabled={!isPublished || !initial?.active || !sessionLink}
                    onClick={() => { if (sessionLink) void navigator.clipboard.writeText(sessionLink); }}>Copy link</button>
                </div>
                <p className="text-[11px] text-[#928b9a]">{form.bookingVisibility === "private"
                  ? "Private sessions use a unique invitation URL."
                  : isPublished ? "This is the live link guests can use to book this session."
                  : "This exact URL becomes active after you publish the session."}</p>
              </div>
              <p className="mt-9 text-xs font-semibold">What type of session are you creating?</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(["full", "mini"] as const).map((value) => (
                  <button type="button" key={value} onClick={() => setForm({ ...form, sessionStyle: value })}
                    className={"min-h-36 border p-5 text-left transition " + (form.sessionStyle === value ? "border-[#6337d8] bg-white ring-1 ring-[#6337d8]" : "border-[#ebe7ef] bg-white hover:border-[#c5b2f6]")}>
                    <div className="flex justify-between gap-2"><strong className="text-sm">{value === "full" ? "Full Session" : "Mini Session"}</strong>
                      <span className={"grid size-5 place-items-center rounded-full border " + (form.sessionStyle === value ? "border-[#6337d8] bg-[#6337d8] text-white" : "border-[#ddd]")}>
                        {form.sessionStyle === value && <Check className="size-3"/>}</span></div>
                    <p className="mt-4 text-xs leading-6 text-[#89828f]">{value === "full"
                      ? "Single longer bookings such as family or wedding portraits."
                      : "Short back-to-back sessions like seasonal or holiday minis."}</p>
                  </button>
                ))}
              </div>
            </>}
            {step === 0 && <>
              <h1 className="text-3xl font-medium">Session details</h1>
              <p className="mt-3 text-sm text-[#888]">Set the duration, pricing, location, and description clients will see.</p>
              <div className="mt-10 space-y-7">
                <div className="space-y-3">
                  <div><p className="text-xs font-semibold">Cover image <span className="font-normal text-[#999]">(optional)</span></p><p className="mt-1 text-xs text-[#888]">Upload a photo guests will see on your booking page. JPG, PNG, WebP or AVIF, up to 5 MB.</p></div>
                  {form.coverImageUrl ? <div className="overflow-hidden border border-[#e7e4ed] bg-white"><img src={form.coverImageUrl} alt="Session cover preview" className="h-48 w-full object-cover"/><div className="flex flex-wrap items-center justify-between gap-3 p-3"><span className="text-xs text-emerald-700">Cover image ready</span><div className="flex gap-2"><label className={OUT+" cursor-pointer"}>{uploadingCover?<Loader2 className="size-4 animate-spin"/>:<UploadCloud className="size-4"/>}Replace<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploadingCover} onChange={(e)=>{void uploadCover(e.target.files?.[0]);e.currentTarget.value="";}}/></label><button type="button" className={OUT} onClick={()=>setForm({...form,coverImageUrl:""})}>Remove</button></div></div></div> : <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-[#dcd5e8] bg-white px-5 py-7 text-center transition hover:border-[#6337d8] hover:bg-[#faf8ff]">{uploadingCover?<Loader2 className="size-6 animate-spin text-[#6337d8]"/>:<ImagePlus className="size-7 text-[#6337d8]"/>}<span className="text-sm font-semibold text-[#342b43]">{uploadingCover?"Uploading image…":"Choose a cover image"}</span><span className="text-xs text-[#888]">Select from your device</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploadingCover} onChange={(e)=>{void uploadCover(e.target.files?.[0]);e.currentTarget.value="";}}/></label>}
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block space-y-3 text-xs font-semibold">Location
                    <input className={INPUT} value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})} placeholder="Studio or location"/>
                  </label>
                </div>
                <label className="block space-y-3 text-xs font-semibold">Description
                  <textarea rows={5} className="w-full border border-[#e7e4ed] bg-white p-4 text-sm outline-none focus:border-[#6337d8]" value={form.description}
                    onChange={(e) => setForm({...form,description:e.target.value})}/>
                </label>
                <div className="space-y-3"><p className="text-xs font-semibold">Who can book this session?</p><div className="grid gap-3 sm:grid-cols-2">{(["public","private"] as const).map((value)=><button type="button" key={value} onClick={()=>setForm({...form,bookingVisibility:value})} className={"border bg-white p-4 text-left "+(form.bookingVisibility===value?"border-[#6337d8] ring-1 ring-[#6337d8]":"border-[#e7e5ed]")}><strong className="text-sm">{value==="public"?"Public booking":"Invitation only"}</strong><p className="mt-2 text-xs leading-5 text-[#888]">{value==="public"?"Anyone with your booking page can book.":"Only guests with a private invitation can book."}</p></button>)}</div></div>
                <div className="space-y-3"><p className="text-xs font-semibold">Session Color</p><div className="flex flex-wrap gap-3">{["#16bfa5","#4299e1","#635bce","#d61f45","#df5bd5","#e65b32","#f09b42","#e9bf3f","#e5e94c","#8fdf3d","#35d6c8"].map((color)=><button type="button" key={color} onClick={()=>setForm({...form,sessionColor:color})} aria-label={"Choose session color "+color} className={"size-6 rounded-full border border-black/5 transition "+(form.sessionColor===color?"ring-2 ring-offset-2 ring-[#6337d8]":"hover:scale-110")} style={{backgroundColor:color}}/>)}</div><p className="text-[11px] text-[#928b9a]">Used to distinguish this session type in your studio calendar.</p></div>
                <div className="space-y-4 border-t border-[#eeeaf1] pt-5"><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={form.createProjectOnBooking} onChange={(e)=>setForm({...form,createProjectOnBooking:e.target.checked})}/><span><strong className="text-xs">Create new project</strong><span className="mt-1 block text-xs leading-5 text-[#888]">Automatically create a project when a guest books this session.</span></span></label>{form.createProjectOnBooking&&<div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-xs font-semibold">Project stage<select className={INPUT} value={form.projectStage} onChange={(e)=>setForm({...form,projectStage:e.target.value})}><option value="inquiry">Inquiry</option><option value="booked">Booked</option><option value="post-production">Post-production</option><option value="completed">Completed</option></select></label><label className="block space-y-2 text-xs font-semibold">Project type<select className={INPUT} value={form.projectType} onChange={(e)=>setForm({...form,projectType:e.target.value})}><option value="portrait">Portrait</option><option value="wedding">Wedding</option><option value="event">Event</option><option value="commercial">Commercial</option><option value="other">Other</option></select></label></div>}</div>
              </div>
            </>}
            {step === 1 && <>
              <h1 className="text-3xl font-medium">Availability</h1>
              <p className="mt-3 text-sm leading-6 text-[#888]">Choose when guests can book this session. Add exact dates for mini sessions, or use your regular weekly hours.</p>
              <div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="block space-y-2 text-xs font-semibold">Duration in minutes<input className={INPUT} type="number" min={15} max={1440} value={form.durationMinutes} onChange={(e)=>setForm({...form,durationMinutes:Number(e.target.value)})}/></label><label className="block space-y-2 text-xs font-semibold">Time zone (IANA)<input className={INPUT} value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})} placeholder="Asia/Dhaka"/></label></div>
              <section className="mt-7 border border-[#e8e5ed] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeaf1] p-4 sm:p-5"><div><h2 className="text-sm font-semibold">Mini Session Dates</h2><p className="mt-1 text-xs text-[#89828f]">Add the exact dates and times guests can choose.</p></div><button type="button" className={OUT} onClick={addSessionDate}><Plus className="size-4"/> Add date</button></div>
                {sessionDates.length ? <div className="divide-y divide-[#eeeaf1]">{sessionDates.map((item,index)=><div key={item.date+"-"+index} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_145px_145px_auto] sm:items-end sm:p-5"><label className="block space-y-2 text-xs font-semibold">Date<input type="date" className={INPUT} value={item.date} onChange={(e)=>updateSessionDate(index,"date",e.target.value)}/></label><label className="block space-y-2 text-xs font-semibold">Starts<input type="time" className={INPUT} value={item.start} onChange={(e)=>updateSessionDate(index,"start",e.target.value)}/></label><label className="block space-y-2 text-xs font-semibold">Ends<input type="time" className={INPUT} value={item.end} onChange={(e)=>updateSessionDate(index,"end",e.target.value)}/></label><button type="button" className="inline-flex h-11 items-center justify-center gap-2 px-3 text-xs font-semibold text-[#9b929f] hover:text-red-600" onClick={()=>setSessionDates((old)=>old.filter((_,i)=>i!==index))} aria-label="Remove date"><Trash2 className="size-4"/> <span className="sm:hidden">Remove date</span></button></div>)}</div> : <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-5 text-center"><CalendarDays className="size-6 text-[#b4aabf]"/><p className="text-sm text-[#817987]">No dates added yet</p><button type="button" className="text-xs font-semibold text-[#6337d8]" onClick={addSessionDate}>Add your first date</button></div>}
              </section>
              <p className="mt-5 text-xs leading-5 text-[#8e8795]">These hours belong only to this session type. If you add specific dates above, guests can book only those dates; otherwise this weekly schedule is used.</p>
              <div className="mt-6 border border-[#eeeaf1] bg-white">
                <div className="border-b border-[#eeeaf1] px-4 py-3"><h2 className="text-sm font-semibold">Weekly hours for this session</h2><p className="mt-1 text-xs text-[#888]">Choose the days and times this session can be booked.</p></div>
                {availability.map((hour) => (
                  <div key={hour.day} className="flex flex-wrap items-center gap-3 border-b border-[#e9e5ec] px-3 py-4 text-xs last:border-b-0">
                    <label className="flex w-32 items-center gap-2">
                      <input type="checkbox" checked={hour.enabled} onChange={(e)=>setDay(hour.day,"enabled",e.target.checked)}/>
                      <strong>{weekdays[hour.day]}</strong>
                    </label>
                    <input className={INPUT+" !w-32"} type="time" disabled={!hour.enabled} value={hour.start} onChange={(e)=>setDay(hour.day,"start",e.target.value)}/>
                    <span className="text-[#999]">to</span>
                    <input className={INPUT+" !w-32"} type="time" disabled={!hour.enabled} value={hour.end} onChange={(e)=>setDay(hour.day,"end",e.target.value)}/>
                  </div>
                ))}
              </div>

            </>}
            {step === 2 && <>
              <h1 className="text-3xl font-medium">Booking questionnaire</h1>
              <p className="mt-3 text-sm leading-6 text-[#888]">Add custom intake questions to collect client details at booking. Name, email and phone are always available.</p>
              <div className="mt-10 space-y-5">{intakeFields.map((field,i)=>
                <div key={i} className="space-y-4 border border-[#e7e3ed] bg-white p-5">
                  <div className="flex items-center justify-between"><strong className="text-sm">Question {i+1}</strong>
                    <button type="button" className="text-[#bbb] hover:text-red-600" onClick={()=>setIntakeFields((old)=>old.filter((_,n)=>n!==i))}><Trash2 className="size-4"/></button>
                  </div>
                  <input className={INPUT} value={field.label} placeholder="Question label" onChange={(e)=>{
                    const label=e.target.value;
                    setIntakeFields((old)=>old.map((f,n)=>n===i?{...f,label,name:label.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,60)}:f));
                  }}/>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <select className={INPUT} value={field.type} onChange={(e)=>setField(i,"type",e.target.value)}>
                      <option value="text">Short answer</option><option value="textarea">Long answer</option>
                      <option value="select">Dropdown</option><option value="date">Date</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={field.required} onChange={(e)=>setField(i,"required",e.target.checked)}/> Required</label>
                  </div>
                  {field.type==="select"&&<input className={INPUT} placeholder="Options, separated by commas" value={field.options||""} onChange={(e)=>setField(i,"options",e.target.value)}/>}
                </div>)}</div>
              <button type="button" className={OUT+" mt-6"} onClick={()=>setIntakeFields((old)=>[...old,{name:"question-"+(old.length+1),label:"",type:"text",required:false}])}>
                <Plus className="size-4"/> Add question
              </button>
            </>}
            {step === 3 && <>
              <h1 className="text-3xl font-medium">Payments</h1>
              <p className="mt-3 text-sm leading-6 text-[#888]">Set your session price and choose how guests will pay.</p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="block space-y-3 text-xs font-semibold">Session price<input className={INPUT} type="number" min={0} step={0.01} value={form.price} onChange={(e)=>setForm({...form,price:Number(e.target.value)})}/></label><label className="block space-y-3 text-xs font-semibold">Currency<select className={INPUT} value={form.currency} onChange={(e)=>setForm({...form,currency:e.target.value})}>{["BDT","USD","EUR","GBP","SGD","INR"].map(x=><option key={x}>{x}</option>)}</select></label></div>
              <div className="mt-8 space-y-4">{([
                ["none","No payment required to book","Clients can reserve without paying online."],
                ["manual","Collect payment separately","Share your own payment instructions after the booking is confirmed."],
              ] as const).map(([value,label,description])=>
                <button type="button" key={value} onClick={()=>setForm({...form,paymentPolicy:value})}
                  className={"flex w-full items-start gap-4 border bg-white p-6 text-left "+(form.paymentPolicy===value?"border-[#6337d8] ring-1 ring-[#6337d8]":"border-[#e8e5ed]")}>
                  <span className={"mt-1 grid size-5 place-items-center rounded-full border "+(form.paymentPolicy===value?"border-[#6337d8] bg-[#6337d8] text-white":"border-[#ddd]")}>
                    {form.paymentPolicy===value&&<Check className="size-3"/>}</span>
                  <span><strong className="text-sm">{label}</strong><span className="mt-2 block text-xs leading-6 text-[#888]">{description}</span></span>
                </button>)}</div>
              <div className="mt-8 border-l-2 border-[#6337d8] bg-[#f3efff] p-5 text-xs leading-6 text-[#73628d]">
                Stripe and PayPal are connected once in Studio Manager → Settings. This session editor does not ask for payment keys. Guest card checkout still needs to be enabled for booking sessions; the manual option does not charge a card.
              </div>
            </>}
            {step === 4 && <>
              <h1 className="text-3xl font-medium">Confirmation & publishing</h1>
              <p className="mt-3 text-sm text-[#888]">Set the final details before making this session available for bookings.</p>
              <label className="mt-10 block space-y-3 text-xs font-semibold">Confirmation message
                <textarea rows={5} className="w-full border border-[#e7e4ed] bg-white p-4 text-sm outline-none focus:border-[#6337d8]"
                  value={form.confirmationMessage} onChange={(e)=>setForm({...form,confirmationMessage:e.target.value})}
                  placeholder="Thanks! We've received your booking request."/>
              </label>
            </>}
            {step === 5 && <>
              <h1 className="text-3xl font-medium">Booking Rules</h1>
              <p className="mt-3 text-sm leading-6 text-[#888]">Control how far in advance clients can request this session and how much notice is required. These settings are enforced by the booking server.</p>
              <div className="mt-10 grid gap-5 sm:grid-cols-2">
                <label className="block space-y-3 text-xs font-semibold">Minimum notice (hours)
                  <input type="number" min={0} max={720} className={INPUT} value={form.bookingRules.minNoticeHours??1}
                    onChange={(e)=>setForm({...form,bookingRules:{...form.bookingRules,minNoticeHours:Number(e.target.value)}})}/>
                </label>
                <label className="block space-y-3 text-xs font-semibold">Accept bookings in advance (days)
                  <input type="number" min={1} max={730} className={INPUT} value={form.bookingRules.maxAdvanceDays??180}
                    onChange={(e)=>setForm({...form,bookingRules:{...form.bookingRules,maxAdvanceDays:Number(e.target.value)}})}/>
                </label>
                <label className="block space-y-3 text-xs font-semibold">Start times every (minutes)
                  <input type="number" min={5} max={240} className={INPUT} value={form.bookingRules.slotIntervalMinutes??30}
                    onChange={(e)=>setForm({...form,bookingRules:{...form.bookingRules,slotIntervalMinutes:Number(e.target.value)}})}/>
                </label>
              </div>
              <label className="mt-7 flex items-start gap-3 border border-[#eeeaf1] bg-white p-4 text-sm">
                <input type="checkbox" className="mt-1" checked={Boolean(form.bookingRules.autoConfirm)} onChange={(e)=>setForm({...form,bookingRules:{...form.bookingRules,autoConfirm:e.target.checked}})}/>
                <span><strong className="text-xs">Automatically confirm bookings</strong><span className="mt-1 block text-xs leading-5 text-[#888]">When enabled, available bookings for this session are confirmed immediately. Otherwise, they arrive as inquiries.</span></span>
              </label>
              <div className="mt-5 border-l-2 border-[#6337d8] bg-[#f3efff] p-5 text-xs leading-6 text-[#716186]">
                These rules apply only to this session type. You can use different notice periods, booking windows and confirmation behavior for every session.
              </div>
            </>}
          </div>
          {error&&<p role="alert" className="my-5 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        </form>
      </div>
    </div>
  );
}

function SessionEditor({ initial, initialDate, block, services, defaultServiceId, onClose, onSaved }: {initial:StudioSession|null;initialDate:Date|null;block:boolean;services:StudioSessionType[];defaultServiceId?:string;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const chosenStart=initialDate?new Date(initialDate.getFullYear(),initialDate.getMonth(),initialDate.getDate(),9,0):new Date();
  const chosenEnd=new Date(chosenStart.getTime()+60*60*1000);
  const [form,setForm]=useState({
    title:initial?.title||(block?"Blocked time":services.find((service)=>service._id===defaultServiceId)?.name||""),kind:initial?.kind||(block?"event":"booking"),
    status:initial?.status||"confirmed",startAt:dateValue(initial?.startAt)||dateValue(chosenStart.toISOString()),
    endAt:dateValue(initial?.endAt)||dateValue(chosenEnd.toISOString()),
    clientName:initial?.clientName||"",clientEmail:initial?.clientEmail||"",clientPhone:initial?.clientPhone||"",
    serviceId:initial?.serviceId||defaultServiceId||"",serviceName:initial?.serviceName||services.find((service)=>service._id===defaultServiceId)?.name||"",location:initial?.location||"",notes:initial?.notes||"",
    allDay:initial?.allDay||false,
  });
  const [error,setError]=useState("");const [saving,setSaving]=useState(false);
  const save=async(e:FormEvent)=>{e.preventDefault();setError("");setSaving(true);try{
    const payload={...form,startAt:new Date(form.startAt).toISOString(),endAt:new Date(form.endAt).toISOString()};
    if(initial)await studioUpdateBookingEvent(initial._id,payload);
    else await studioCreateBookingEvent(payload);
    await onSaved();
  }catch(err){setError(err instanceof Error?err.message:"Could not save event");}finally{setSaving(false);}};
  return <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[#17131f]/45 px-4 py-10" role="dialog" aria-modal="true" aria-label="Session editor">
    <form onSubmit={(e)=>void save(e)} className="w-full max-w-[620px] space-y-5 bg-white px-7 py-7 shadow-xl sm:px-10">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{block?"Block Off Time":initial?"Edit Session":"New Session"}</h2><button type="button" onClick={onClose}><X className="size-5"/></button></div>
      <label className="block space-y-2 text-xs font-medium">Session title<input className={INPUT} required value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-xs font-medium">Starts<input type="datetime-local" required className={INPUT} value={form.startAt} onChange={(e)=>setForm({...form,startAt:e.target.value})}/></label>
        <label className="block space-y-2 text-xs font-medium">Ends<input type="datetime-local" required className={INPUT} value={form.endAt} onChange={(e)=>setForm({...form,endAt:e.target.value})}/></label></div>
      {!block&&<>
        <label className="block space-y-2 text-xs font-medium">Session type<select className={INPUT} value={form.serviceId} onChange={(e)=>{const s=services.find(x=>x._id===e.target.value);setForm({...form,serviceId:e.target.value,serviceName:s?.name||"",title:form.title||s?.name||""})}}><option value="">Unassigned</option>{services.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-xs font-medium">Client name<input className={INPUT} value={form.clientName} onChange={(e)=>setForm({...form,clientName:e.target.value})}/></label><label className="block space-y-2 text-xs font-medium">Client email<input className={INPUT} type="email" value={form.clientEmail} onChange={(e)=>setForm({...form,clientEmail:e.target.value})}/></label></div>
        <label className="block space-y-2 text-xs font-medium">Status<select className={INPUT} value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as StudioSession["status"]})}>{["pending","awaiting-client","confirmed","completed","cancelled"].map(v=><option value={v} key={v}>{v==="pending"?"Inquiry":v.replace("-"," ")}</option>)}</select></label>
      </>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allDay} onChange={e=>setForm({...form,allDay:e.target.checked})}/> All-day event</label>
      <label className="block space-y-2 text-xs font-medium">Location<input className={INPUT} value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/></label>
      <label className="block space-y-2 text-xs font-medium">Notes<textarea className="min-h-20 w-full border p-3 text-sm" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label>
      {error&&<p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex justify-end gap-3 pt-3"><button type="button" className={OUT} onClick={onClose}>Cancel</button><button className={BTN} disabled={saving}>{saving?"Saving…":"Save Session"}</button></div>
    </form></div>;
}

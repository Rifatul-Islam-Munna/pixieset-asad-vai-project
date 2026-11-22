import { PublicBooking } from "@/components/booking/public-booking";
import { apiBaseUrl } from "@/lib/api-base-url";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<{ invite?: string; service?: string }>;
}) {
  const { identifier } = await params;
  const { invite = "", service = "" } = await searchParams;
  const query = new URLSearchParams();
  if (invite) query.set("invite", invite);
  if (service) query.set("service", service);

  const response = await fetch(
    apiBaseUrl() + "/public/bookings/" + encodeURIComponent(identifier) + (query.size ? "?" + query.toString() : ""),
    { cache: "no-store" },
  ).catch(() => null);

  if (!response) {
    return <BookingUnavailable title="Booking site unavailable" message="We could not reach the booking service. Please try again in a moment." />;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    const message = typeof payload?.message === "string"
      ? payload.message
      : response.status === 404
        ? "This booking page or session could not be found. It may be unpublished or the link may be incorrect."
        : "The booking service could not load this session. Please try again.";
    return <BookingUnavailable title={invite ? "Invitation unavailable" : "Booking page unavailable"} message={message} />;
  }

  return <PublicBooking identifier={identifier} inviteToken={invite} initialServiceId={service} data={payload.data} />;
}

function BookingUnavailable({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4f0] p-5">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8a8a8a]">Studio bookings</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#202326]">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#777]">{message}</p>
      </div>
    </main>
  );
}

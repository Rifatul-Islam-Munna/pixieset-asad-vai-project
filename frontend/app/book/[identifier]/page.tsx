import { notFound } from "next/navigation";
import { PublicBooking } from "@/components/booking/public-booking";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { identifier } = await params;
  const { invite = "" } = await searchParams;
  const query = invite ? `?invite=${encodeURIComponent(invite)}` : "";
  const response = await fetch(`${baseUrl}/public/bookings/${encodeURIComponent(identifier)}${query}`, { cache: "no-store" }).catch(() => null);
  if (!response) notFound();
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (!invite) notFound();
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f4f0] p-5">
        <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8a8a8a]">Booking link unavailable</p>
          <h1 className="mt-4 text-3xl font-semibold text-[#202326]">{payload?.message || "This private booking link is no longer available."}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#777]">Ask the studio for a new booking link if you still need to schedule a session.</p>
        </div>
      </main>
    );
  }
  if (!payload?.data) notFound();
  return <PublicBooking identifier={identifier} inviteToken={invite} data={payload.data} />;
}

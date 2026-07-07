"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type VerifyState = {
  loading: boolean;
  success?: boolean;
  message: string;
};

export function PublicCheckoutSuccess({
  sessionId,
  backHref,
}: {
  sessionId?: string;
  backHref: string;
}) {
  const [state, setState] = useState<VerifyState>({
    loading: true,
    message: "Verifying payment...",
  });

  useEffect(() => {
    if (!sessionId) {
      setState({ loading: false, success: false, message: "Missing Stripe session." });
      return;
    }

    fetch(`/api/public-print-store/checkout-session/${encodeURIComponent(sessionId)}`)
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (!ok) {
          setState({ loading: false, success: false, message: payload?.message ?? "Payment verification failed." });
          return;
        }
        setState({
          loading: false,
          success: Boolean(payload?.data?.success),
          message: payload?.data?.success ? "Payment successful." : "Payment not completed.",
        });
      })
      .catch(() => setState({ loading: false, success: false, message: "Payment verification failed." }));
  }, [sessionId]);

  const Icon = state.success ? CheckCircle2 : XCircle;
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 text-[#111]">
      <div className="max-w-[440px] text-center">
        {state.loading ? <Loader2 className="mx-auto size-12 animate-spin" /> : <Icon className="mx-auto size-12" />}
        <h1 className="mt-5 text-3xl font-semibold">{state.message}</h1>
        <p className="mt-3 text-sm leading-6 text-[#666]">
          {state.success ? "Your order is now visible to the collection owner." : "No paid order was confirmed."}
        </p>
        <Link href={backHref} className="mt-8 inline-flex bg-[#111] px-6 py-3 text-sm font-bold text-white">
          Back to store
        </Link>
      </div>
    </main>
  );
}

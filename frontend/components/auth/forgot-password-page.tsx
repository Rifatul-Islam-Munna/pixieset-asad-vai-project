"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { requestPasswordlessAccess } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthCms, BrandSettings } from "@/lib/home-cms";

export function ForgotPasswordPageClient({ auth, brand }: { auth: AuthCms; brand: BrandSettings }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await requestPasswordlessAccess(email);
      if (result.error) { setError(result.error.message); return; }
      setSent(true);
    });
  };
  const logoUrl = brand.logoUrl?.trim() || brand.brandImageUrl?.trim() || "";
  const brandText = brand.brandText?.trim() || "Gallerista";

  return (
    <main className="min-h-screen bg-[#f7f6f3] px-4 py-4 text-[#111] sm:px-7 sm:py-7 lg:px-10 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1435px] overflow-hidden rounded-[18px] bg-white shadow-[0_22px_70px_rgba(31,25,18,.08)] sm:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[41%_59%]">
        <section className="flex flex-col px-7 py-7 sm:px-12 sm:py-10 lg:px-14 xl:px-16">
          <Link href="/" className="inline-flex w-fit items-center">
            {logoUrl ? <img src={logoUrl} alt="" className="h-11 w-auto max-w-[220px] object-contain" /> : <span className="font-heading text-xl font-semibold tracking-[0.14em]">{brandText}</span>}
          </Link>

          <div className="flex flex-1 items-center py-10">
            <div className="w-full max-w-[460px]">
              {!sent ? (
                <form onSubmit={submit}>
                  <p className="text-[17px] font-medium text-[#5f35c8]">Account access</p>
                  <h1 className="mt-3 font-serif text-[38px] leading-[1.08] tracking-[-.025em] sm:text-[42px]">Forgot your password?</h1>
                  <p className="mt-4 max-w-[410px] text-[17px] leading-7 text-[#69686d]">Enter the email on your account. We&apos;ll send a 6-digit PIN and a secure direct login link valid for 30 days.</p>

                  <label className="mt-8 grid gap-2.5">
                    <span className="text-[15px] font-medium">Email address</span>
                    <div className="flex h-[60px] items-center rounded-[9px] border border-[#dedde1] bg-white px-4 focus-within:border-[#6f43d6] focus-within:ring-2 focus-within:ring-[#6f43d6]/10">
                      <Mail className="mr-4 size-5 text-[#747378]" />
                      <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required className="h-12 rounded-none border-0 px-0 text-[16px] shadow-none focus-visible:ring-0" />
                    </div>
                  </label>
                  {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

                  <Button className="mt-8 h-[62px] w-full rounded-[8px] bg-gradient-to-r from-[#4f24bd] to-[#823bd9] text-[16px] font-semibold text-white shadow-[0_12px_28px_rgba(95,53,200,.24)] hover:opacity-95" disabled={pending}>
                    {pending ? <Loader2 className="size-5 animate-spin" /> : "Send login access"}
                    {!pending && <ArrowRight className="size-5" />}
                  </Button>
                  <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5f35c8] hover:text-[#4b28aa]"><ArrowLeft className="size-4" />Back to login</Link>
                </form>
              ) : (
                <div>
                  <div className="grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-7" /></div>
                  <h1 className="mt-5 font-serif text-[38px] leading-[1.08] tracking-[-.025em] sm:text-[42px]">Check your email</h1>
                  <p className="mt-4 text-[17px] leading-7 text-[#69686d]">If an account exists for <strong className="font-semibold text-[#333]">{email}</strong>, we sent a 6-digit PIN and a direct login link. Both are valid for 30 days and can be used once.</p>
                  <div className="mt-6 rounded-[10px] border border-[#e2dff0] bg-[#faf9ff] p-4 text-sm leading-6 text-[#66656a]"><ShieldCheck className="mr-2 inline size-4 text-[#6337d8]" />You can open the link from the email, or return to login and choose <strong>One-time PIN</strong>.</div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Button asChild className="h-12 bg-[#6337d8] text-white hover:bg-[#542dbd]"><Link href={`/login?email=${encodeURIComponent(email)}`}>Go to login</Link></Button>
                    <Button type="button" variant="outline" className="h-12" onClick={() => setSent(false)}>Use another email</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="relative hidden min-h-[760px] overflow-hidden rounded-l-[18px] lg:block">
          <img src={auth.loginImageUrl} alt="Photography gallery" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/85" />
          <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-14">
            <p className="font-serif text-6xl leading-none text-[#b69b69]">“</p>
            <h2 className="mt-1 max-w-[520px] font-serif text-[34px] leading-[1.08] tracking-[-.02em]">Secure access without resetting anything.</h2>
            <p className="mt-4 max-w-[500px] text-[17px] leading-7 text-white/75">Use your private PIN or one-click login link to get back into your workspace.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

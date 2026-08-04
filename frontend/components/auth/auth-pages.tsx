"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, Eye, EyeOff, ImageIcon, Loader2, LockKeyhole, Mail, Phone, ShieldCheck, UserRound, VenusAndMars } from "lucide-react";
import { loginUser, registerUser } from "@/actions/auth";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthCms } from "@/lib/home-cms";


export function LoginPageClient({ auth }: { auth: AuthCms }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ phoneNumber: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await loginUser(form.phoneNumber, form.password);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      window.location.assign(result.data?.user?.role === "admin" ? "/admin" : "/dashboard/client-gallery");
    });
  };

  return (
    <main className="min-h-screen bg-[#f7f6f3] px-4 py-4 text-[#111] sm:px-7 sm:py-7 lg:px-10 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1435px] overflow-hidden rounded-[18px] bg-white shadow-[0_22px_70px_rgba(31,25,18,.08)] sm:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[41%_59%]">
        <section className="flex flex-col px-7 py-7 sm:px-12 sm:py-10 lg:px-14 xl:px-16">
          <AuthBrand brand={auth.brand} />

          <div className="flex flex-1 items-center py-10 lg:py-8">
            <form onSubmit={submit} className="w-full max-w-[460px]">
              <p className="text-[17px] font-medium text-[#5f35c8]">Welcome back! 👋</p>
              <h1 className="mt-3 font-serif text-[38px] leading-[1.08] tracking-[-.025em] text-[#111] sm:text-[42px]">{auth.loginTitle}</h1>
              <p className="mt-4 max-w-[390px] text-[17px] leading-7 text-[#69686d]">{auth.loginSubtitle}</p>

              <div className="mt-9 grid gap-6">
                <label className="grid gap-2.5">
                  <span className="text-[15px] font-medium">Email or Phone Number</span>
                  <div className="flex h-[60px] items-center rounded-[9px] border border-[#6f43d6] bg-white px-4 shadow-[0_0_0_1px_rgba(111,67,214,.06)] focus-within:ring-2 focus-within:ring-[#6f43d6]/10">
                    <UserRound className="mr-4 size-5 text-[#6e6d72]" />
                    <Input value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="ceoatsi@gmail.com" className="h-12 rounded-none border-0 px-0 text-[16px] shadow-none focus-visible:ring-0" required />
                  </div>
                </label>

                <label className="grid gap-2.5">
                  <span className="text-[15px] font-medium">Password</span>
                  <div className="flex h-[60px] items-center rounded-[9px] border border-[#dedde1] bg-white px-4 focus-within:border-[#6f43d6] focus-within:ring-2 focus-within:ring-[#6f43d6]/10">
                    <LockKeyhole className="mr-4 size-5 text-[#747378]" />
                    <Input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" type={showPassword ? "text" : "password"} className="h-12 rounded-none border-0 px-0 text-[16px] shadow-none focus-visible:ring-0" required />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-3 text-[#77767b]" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </label>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 text-[14px]">
                <label className="flex cursor-pointer items-center gap-2.5 text-[#66656a]">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-[19px] accent-[#673bd2]" />
                  Remember me
                </label>
                <Link href="/forgot-password" className="font-medium text-[#5f35c8] hover:text-[#4b28aa]">Forgot password?</Link>
              </div>

              {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

              <Button className="mt-8 h-[62px] w-full rounded-[8px] bg-gradient-to-r from-[#4f24bd] to-[#823bd9] text-[16px] font-semibold text-white shadow-[0_12px_28px_rgba(95,53,200,.24)] hover:opacity-95" disabled={pending}>
                {pending ? <Loader2 className="size-5 animate-spin" /> : "Log in"}
                {!pending && <ArrowRight className="size-5" />}
              </Button>

              <div className="my-7 flex items-center gap-5 text-[13px] font-medium uppercase text-[#77767b]">
                <span className="h-px flex-1 bg-[#dedde1]" />
                or
                <span className="h-px flex-1 bg-[#dedde1]" />
              </div>

              <GoogleLoginButton />
              <p className="mt-8 text-center text-[15px] text-[#77767b]">New here? <Link href="/register" className="font-semibold text-[#5f35c8] hover:text-[#4b28aa]">Create an account</Link></p>
            </form>
          </div>
        </section>

        <LoginVisualPanel imageUrl={auth.loginImageUrl} />
      </div>
    </main>
  );
}

function LoginVisualPanel({ imageUrl }: { imageUrl: string }) {
  return (
    <section className="relative hidden min-h-[760px] overflow-hidden rounded-l-[18px] lg:block">
      <img src={imageUrl} alt="Wedding gallery" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/30 to-black/85" />
      <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-14">
        <div className="max-w-[520px]">
          <p className="font-serif text-6xl leading-none text-[#b69b69]">“</p>
          <h2 className="mt-1 font-serif text-[34px] leading-[1.08] tracking-[-.02em]">Beautiful moments.<br />Organized perfectly.</h2>
          <p className="mt-4 text-[17px] text-white/75">All your galleries, in one place.</p>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-8">
          <LoginBenefit icon={<ImageIcon className="size-6" />} title="Manage Galleries" text="Organize and manage all your client galleries." />
          <LoginBenefit icon={<ShieldCheck className="size-6" />} title="Secure & Private" text="Enterprise-grade security for your data." />
          <LoginBenefit icon={<ChartNoAxesCombined className="size-6" />} title="Grow Your Business" text="Powerful tools to streamline and grow your business." />
        </div>
      </div>
    </section>
  );
}

function LoginBenefit({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-4">
      <div className="grid size-14 shrink-0 place-items-center rounded-full border border-[#7645df] text-[#8c56ef]">{icon}</div>
      <div>
        <h3 className="font-serif text-[16px] font-semibold">{title}</h3>
        <p className="mt-2 text-[12px] leading-5 text-white/65">{text}</p>
      </div>
    </div>
  );
}

export function RegisterPageClient({ auth }: { auth: AuthCms }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phoneNumber: "", password: "", gender: "" });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await registerUser(form);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      window.location.assign("/dashboard/client-gallery");
    });
  };

  return (
    <main className="min-h-screen bg-[#f7f6f3] px-4 py-4 text-[#111] sm:px-7 sm:py-7 lg:px-10 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1435px] overflow-hidden rounded-[18px] bg-white shadow-[0_22px_70px_rgba(31,25,18,.08)] sm:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[41%_59%]">
        <section className="flex flex-col px-7 py-7 sm:px-12 sm:py-10 lg:px-14 xl:px-16">
          <AuthBrand brand={auth.brand} />

          <div className="flex flex-1 items-center py-8 lg:py-6">
            <form onSubmit={submit} className="w-full max-w-[470px]">
              <p className="text-[17px] font-medium text-[#5f35c8]">Start creating today ✨</p>
              <h1 className="mt-3 font-serif text-[38px] leading-[1.08] tracking-[-.025em] text-[#111] sm:text-[42px]">{auth.registerTitle}</h1>
              <p className="mt-4 max-w-[410px] text-[17px] leading-7 text-[#69686d]">{auth.registerSubtitle}</p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <AuthInput icon={<UserRound className="size-5" />} label="Full Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Your name" required />
                <AuthInput icon={<Phone className="size-5" />} label="Phone Number" value={form.phoneNumber} onChange={(value) => setForm({ ...form, phoneNumber: value })} placeholder="01712345678" required />
                <div className="sm:col-span-2"><AuthInput icon={<Mail className="size-5" />} label="Email Address" value={form.email} onChange={(value) => setForm({ ...form, email: value })} placeholder="you@example.com" type="email" /></div>
                <AuthInput icon={<VenusAndMars className="size-5" />} label="Gender" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} placeholder="Gender" />
                <AuthInput icon={<LockKeyhole className="size-5" />} label="Password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} placeholder="Create password" type="password" required />
              </div>

              {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

              <Button className="mt-7 h-[60px] w-full rounded-[8px] bg-gradient-to-r from-[#4f24bd] to-[#823bd9] text-[16px] font-semibold text-white shadow-[0_12px_28px_rgba(95,53,200,.24)] hover:opacity-95" disabled={pending}>
                {pending ? <Loader2 className="size-5 animate-spin" /> : "Create account"}
                {!pending && <ArrowRight className="size-5" />}
              </Button>

              <div className="my-6 flex items-center gap-5 text-[13px] font-medium uppercase text-[#77767b]">
                <span className="h-px flex-1 bg-[#dedde1]" />
                or
                <span className="h-px flex-1 bg-[#dedde1]" />
              </div>

              <GoogleLoginButton />
              <p className="mt-7 text-center text-[15px] text-[#77767b]">Already have an account? <Link href="/login" className="font-semibold text-[#5f35c8] hover:text-[#4b28aa]">Log in</Link></p>
            </form>
          </div>
        </section>

        <RegisterVisualPanel imageUrl={auth.registerImageUrl} />
      </div>
    </main>
  );
}

function RegisterVisualPanel({ imageUrl }: { imageUrl: string }) {
  return (
    <section className="relative hidden min-h-[820px] overflow-hidden rounded-l-[18px] lg:block">
      <img src={imageUrl} alt="Photography workspace" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/30 to-black/85" />
      <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-14">
        <div className="max-w-[520px]">
          <p className="font-serif text-6xl leading-none text-[#b69b69]">“</p>
          <h2 className="mt-1 font-serif text-[34px] leading-[1.08] tracking-[-.02em]">Your best work.<br />Beautifully delivered.</h2>
          <p className="mt-4 text-[17px] text-white/75">Everything you need to create a memorable client experience.</p>
        </div>
        <div className="mt-12 grid grid-cols-3 gap-8">
          <LoginBenefit icon={<ImageIcon className="size-6" />} title="Beautiful Galleries" text="Present every collection with a polished experience." />
          <LoginBenefit icon={<ShieldCheck className="size-6" />} title="Secure Delivery" text="Protect client work with dependable privacy tools." />
          <LoginBenefit icon={<ChartNoAxesCombined className="size-6" />} title="Grow Faster" text="Manage clients and scale your photography business." />
        </div>
      </div>
    </section>
  );
}

function AuthBrand({ brand }: { brand: string }) {
  return (
    <Link href="/" className="flex w-fit items-center gap-3 text-sm font-bold">
      <span className="size-5 rounded-full bg-[#6F57D9]" />
      {brand}
    </Link>
  );
}

function AuthImagePanel({ title, meta, imageUrl }: { title: string; meta: string; imageUrl: string }) {
  return (
    <section className="hidden bg-[#F8F7F4] p-10 lg:flex lg:items-center lg:justify-center">
      <div className="w-full max-w-[660px]">
        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm font-bold">{title}</p>
          <span className="text-xs font-semibold text-[#777]">{meta}</span>
        </div>
        <div className="border border-[#E8E5E1] bg-[#FFFFFF] p-8 shadow-[0_28px_80px_rgba(21,21,21,0.10)]">
          <img src={imageUrl} alt="" className="h-[520px] w-full object-cover" />
        </div>
      </div>
    </section>
  );
}

function AuthInput({ icon, label, value, onChange, placeholder, type = "text", required = false }: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === "password" && showPassword ? "text" : type;

  return (
    <label className="grid gap-2.5">
      <span className="text-[14px] font-medium">{label}</span>
      <div className="flex h-[58px] items-center rounded-[9px] border border-[#dedde1] bg-white px-4 text-[#747378] focus-within:border-[#6f43d6] focus-within:ring-2 focus-within:ring-[#6f43d6]/10">
        <span className="mr-3.5">{icon}</span>
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={inputType} required={required} className="h-11 rounded-none border-0 px-0 text-[15px] text-[#151515] shadow-none focus-visible:ring-0" />
        {type === "password" && (
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-3 text-[#777]" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </label>
  );
}




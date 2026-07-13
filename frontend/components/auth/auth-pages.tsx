"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, UserRound, VenusAndMars } from "lucide-react";
import { loginUser, registerUser } from "@/actions/auth";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthCms } from "@/lib/home-cms";
import { cn } from "@/lib/utils";

export function LoginPageClient({ auth }: { auth: AuthCms }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ phoneNumber: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

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

  const formPanel = (
    <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
      <AuthBrand brand={auth.brand} />
      <div className="flex flex-1 items-center">
        <form onSubmit={submit} className="w-full max-w-[390px]">
          <p className="text-sm font-semibold text-[#777]">{auth.loginSubtitle}</p>
          <h1 className="mt-3 text-[32px] font-medium leading-tight tracking-normal">{auth.loginTitle}</h1>
          <div className="mt-10 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Email or Phone Number</span>
              <div className="flex h-12 items-center border bg-white px-4 focus-within:border-primary">
                <UserRound className="mr-3 size-4 text-[#777]" />
                <Input value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="test@gmail.com" className="h-11 rounded-none border-0 px-0 shadow-none focus-visible:ring-0" required />
              </div>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold">Password</span>
              <div className="flex h-12 items-center border bg-white px-4 focus-within:border-primary">
                <LockKeyhole className="mr-3 size-4 text-[#777]" />
                <Input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" type={showPassword ? "text" : "password"} className="h-11 rounded-none border-0 px-0 shadow-none focus-visible:ring-0" required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-3 text-[#777]" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
          </div>
          {error && <p className="mt-4 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">{error}</p>}
          <Button className="mt-7 h-12 w-full rounded-none bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Log in"}
            {!pending && <ArrowRight className="size-4" />}
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase text-[#999]">
            <span className="h-px flex-1 bg-[#e5e5e5]" />
            or
            <span className="h-px flex-1 bg-[#e5e5e5]" />
          </div>
          <GoogleLoginButton />
          <p className="mt-6 text-sm text-[#667085]">New here? <Link href="/register" className="font-bold text-primary hover:text-primary/80">Create an account</Link></p>
        </form>
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-white text-[#151515]">
      <div className={cn("grid min-h-screen lg:grid-cols-[minmax(420px,520px)_1fr]", auth.loginImageSide === "left" && "lg:grid-cols-[1fr_minmax(420px,520px)]")}>
        {auth.loginImageSide === "left" && <AuthImagePanel title="Homepage preview" meta={`${auth.brand.toLowerCase()}.com`} imageUrl={auth.loginImageUrl} />}
        {formPanel}
        {auth.loginImageSide !== "left" && <AuthImagePanel title="Homepage preview" meta={`${auth.brand.toLowerCase()}.com`} imageUrl={auth.loginImageUrl} />}
      </div>
    </main>
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

  const formPanel = (
    <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
      <AuthBrand brand={auth.brand} />
      <div className="flex flex-1 items-center">
        <form onSubmit={submit} className="w-full max-w-[430px]">
          <p className="text-sm font-semibold text-[#777]">{auth.registerSubtitle}</p>
          <h1 className="mt-3 text-[32px] font-medium leading-tight tracking-normal">{auth.registerTitle}</h1>
          <div className="mt-10 grid gap-4">
            <AuthInput icon={<UserRound className="size-4" />} label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Your name" required />
            <AuthInput icon={<Phone className="size-4" />} label="Phone Number" value={form.phoneNumber} onChange={(value) => setForm({ ...form, phoneNumber: value })} placeholder="01712345678" required />
            <AuthInput icon={<Mail className="size-4" />} label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} placeholder="you@example.com" type="email" />
            <AuthInput icon={<VenusAndMars className="size-4" />} label="Gender" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} placeholder="Gender" />
            <AuthInput icon={<LockKeyhole className="size-4" />} label="Password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} placeholder="Password" type="password" required />
          </div>
          {error && <p className="mt-4 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">{error}</p>}
          <Button className="mt-7 h-12 w-full rounded-none bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
            {!pending && <ArrowRight className="size-4" />}
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase text-[#999]">
            <span className="h-px flex-1 bg-[#e5e5e5]" />
            or
            <span className="h-px flex-1 bg-[#e5e5e5]" />
          </div>
          <GoogleLoginButton />
          <p className="mt-6 text-sm text-[#667085]">Already have account? <Link href="/login" className="font-bold text-primary hover:text-primary/80">Log in</Link></p>
        </form>
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-white text-[#151515]">
      <div className={cn("grid min-h-screen lg:grid-cols-[1fr_minmax(420px,560px)]", auth.registerImageSide === "right" && "lg:grid-cols-[minmax(420px,560px)_1fr]")}>
        {auth.registerImageSide !== "right" && <AuthImagePanel title="Client gallery setup" meta="Free plan included" imageUrl={auth.registerImageUrl} />}
        {formPanel}
        {auth.registerImageSide === "right" && <AuthImagePanel title="Client gallery setup" meta="Free plan included" imageUrl={auth.registerImageUrl} />}
      </div>
    </main>
  );
}

function AuthBrand({ brand }: { brand: string }) {
  return (
    <Link href="/" className="flex w-fit items-center gap-3 text-sm font-bold">
      <span className="size-5 rounded-full bg-primary" />
      {brand}
    </Link>
  );
}

function AuthImagePanel({ title, meta, imageUrl }: { title: string; meta: string; imageUrl: string }) {
  return (
    <section className="hidden bg-[#f4f4f2] p-10 lg:flex lg:items-center lg:justify-center">
      <div className="w-full max-w-[660px]">
        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm font-bold">{title}</p>
          <span className="text-xs font-semibold text-[#777]">{meta}</span>
        </div>
        <div className="bg-white p-8 shadow-[0_28px_80px_rgba(0,0,0,0.10)]">
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
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex h-12 items-center border bg-white px-4 text-[#777] focus-within:border-primary">
        <span className="mr-3">{icon}</span>
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={inputType} required={required} className="h-11 rounded-none border-0 px-0 text-[#151515] shadow-none focus-visible:ring-0" />
        {type === "password" && (
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-3 text-[#777]" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </label>
  );
}

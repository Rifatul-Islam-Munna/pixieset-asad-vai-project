"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, LockKeyhole, Mail, Phone, UserRound, VenusAndMars } from "lucide-react";
import { registerUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    gender: "",
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await registerUser(form);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      router.push("/dashboard/client-gallery/homepage");
    });
  };

  return (
    <main className="min-h-screen bg-white text-[#151515]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,560px)]">
        <section className="hidden bg-[#f4f4f2] p-10 lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-[660px]">
            <div className="mb-8 flex items-center justify-between">
              <p className="text-sm font-bold">Client gallery setup</p>
              <span className="text-xs font-semibold text-[#777]">3 GB included</span>
            </div>
            <div className="relative bg-white p-8 shadow-[0_28px_80px_rgba(0,0,0,0.10)]">
              <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
                <img
                  src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80"
                  alt=""
                  className="h-[420px] w-full object-cover"
                />
                <div className="flex flex-col justify-between bg-[#fafafa] p-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">New collection</p>
                    <h2 className="mt-4 text-3xl font-medium leading-tight">Share, proof, deliver</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=260&q=80",
                      "https://images.unsplash.com/photo-1508808787069-421e7986016e?auto=format&fit=crop&w=260&q=80",
                      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=260&q=80",
                      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=260&q=80",
                    ].map((src) => (
                      <img key={src} src={src} alt="" className="aspect-square w-full object-cover" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
          <Link href="/" className="flex w-fit items-center gap-3 text-sm font-bold">
            <span className="size-5 rounded-full bg-[#0dc6b5]" />
            Pixieset
          </Link>

          <div className="flex flex-1 items-center">
            <form onSubmit={submit} className="w-full max-w-[430px]">
              <p className="text-sm font-semibold text-[#777]">Start workspace</p>
              <h1 className="mt-3 text-[32px] font-medium leading-tight tracking-normal">
                Create your account
              </h1>

              <div className="mt-10 grid gap-4">
                <AuthInput icon={<UserRound className="size-4" />} label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Your name" required />
                <AuthInput icon={<Phone className="size-4" />} label="Phone Number" value={form.phoneNumber} onChange={(value) => setForm({ ...form, phoneNumber: value })} placeholder="01712345678" required />
                <AuthInput icon={<Mail className="size-4" />} label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} placeholder="you@example.com" type="email" />
                <AuthInput icon={<VenusAndMars className="size-4" />} label="Gender" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} placeholder="Gender" />
                <AuthInput icon={<LockKeyhole className="size-4" />} label="Password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} placeholder="Password" type="password" required />
              </div>

              {error && <p className="mt-4 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">{error}</p>}

              <Button className="mt-7 h-12 w-full rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
                {!pending && <ArrowRight className="size-4" />}
              </Button>

              <p className="mt-6 text-sm text-[#667085]">
                Already have account? <Link href="/login" className="font-bold text-[#00a997]">Log in</Link>
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthInput({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex h-12 items-center border bg-white px-4 text-[#777] focus-within:border-[#22bda7]">
        <span className="mr-3">{icon}</span>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          required={required}
          className="h-11 rounded-none border-0 px-0 text-[#151515] shadow-none focus-visible:ring-0"
        />
      </div>
    </label>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { loginUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
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
      router.push(result.data?.user?.role === "admin" ? "/admin" : "/dashboard/client-gallery/homepage");
    });
  };

  return (
    <main className="min-h-screen bg-white text-[#151515]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,520px)_1fr]">
        <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
          <Link href="/" className="flex w-fit items-center gap-3 text-sm font-bold">
            <span className="size-5 rounded-full bg-[#0dc6b5]" />
            Pixieset
          </Link>

          <div className="flex flex-1 items-center">
            <form onSubmit={submit} className="w-full max-w-[390px]">
              <p className="text-sm font-semibold text-[#777]">Client Gallery</p>
              <h1 className="mt-3 text-[32px] font-medium leading-tight tracking-normal">
                Log in to your workspace
              </h1>

              <div className="mt-10 grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">Email or Phone Number</span>
                  <div className="flex h-12 items-center border bg-white px-4 focus-within:border-[#22bda7]">
                    <UserRound className="mr-3 size-4 text-[#777]" />
                    <Input
                      value={form.phoneNumber}
                      onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
                      placeholder="test@gmail.com"
                      className="h-11 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
                      required
                    />
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold">Password</span>
                  <div className="flex h-12 items-center border bg-white px-4 focus-within:border-[#22bda7]">
                    <LockKeyhole className="mr-3 size-4 text-[#777]" />
                    <Input
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      className="h-11 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="ml-3 text-[#777]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </label>
              </div>

              {error && <p className="mt-4 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">{error}</p>}

              <Button className="mt-7 h-12 w-full rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Log in"}
                {!pending && <ArrowRight className="size-4" />}
              </Button>

              <p className="mt-6 text-sm text-[#667085]">
                New here? <Link href="/register" className="font-bold text-[#00a997]">Create an account</Link>
              </p>
            </form>
          </div>
        </section>

        <section className="hidden bg-[#f4f4f2] p-10 lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-[640px]">
            <div className="mb-8 flex items-center justify-between">
              <p className="text-sm font-bold">Homepage preview</p>
              <span className="text-xs font-semibold text-[#777]">rifat39.pixieset.com</span>
            </div>
            <div className="bg-white p-8 shadow-[0_28px_80px_rgba(0,0,0,0.10)]">
              <div className="flex gap-2 text-[#c9c9c9]">
                {[0, 1, 2, 3].map((item) => (
                  <span key={item} className="size-1.5 rounded-full bg-current" />
                ))}
              </div>
              <div className="mt-8 text-center">
                <p className="text-sm font-bold tracking-wide">RIFAT</p>
                <p className="mt-3 text-[11px] font-semibold text-[#555]">email@pixieset.com</p>
                <p className="mt-1 text-[11px] font-semibold text-[#555]">101 Main Street</p>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-5">
                {[
                  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=360&q=80",
                  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80",
                  "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=360&q=80",
                  "https://images.unsplash.com/photo-1508808787069-421e7986016e?auto=format&fit=crop&w=360&q=80",
                  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=360&q=80",
                  "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=360&q=80",
                ].map((src) => (
                  <div key={src}>
                    <img src={src} alt="" className="aspect-[1.35] w-full object-cover" />
                    <div className="mx-auto mt-3 h-1 w-14 bg-[#d8d8d8]" />
                    <div className="mx-auto mt-1.5 h-1 w-10 bg-[#e4e4e4]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

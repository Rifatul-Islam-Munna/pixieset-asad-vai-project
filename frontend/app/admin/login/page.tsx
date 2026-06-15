"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, LockKeyhole, Mail } from "lucide-react";
import { loginUser, logOutUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "test@gmail.com", password: "11111111" });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await loginUser(form.email, form.password);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.data?.user?.role !== "admin") {
        await logOutUser();
        setError("Admin access only");
        return;
      }
      router.push("/admin");
    });
  };

  return (
    <main className="min-h-screen bg-white text-[#151515]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,520px)_1fr]">
        <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
          <Link href="/" className="flex w-fit items-center gap-3 text-sm font-bold">
            <span className="size-5 rounded-full bg-[#0dc6b5]" />
            Pixieset Admin
          </Link>

          <div className="flex flex-1 items-center">
            <form onSubmit={submit} className="w-full max-w-[390px]">
              <p className="text-sm font-semibold text-[#777]">Control Panel</p>
              <h1 className="mt-3 text-[32px] font-medium leading-tight tracking-normal">
                Admin workspace
              </h1>

              <div className="mt-10 grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">Email</span>
                  <div className="flex h-12 items-center border bg-white px-4 focus-within:border-[#22bda7]">
                    <Mail className="mr-3 size-4 text-[#777]" />
                    <Input
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
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
                      type="password"
                      className="h-11 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
                      required
                    />
                  </div>
                </label>
              </div>

              {error && <p className="mt-4 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">{error}</p>}

              <Button className="mt-7 h-12 w-full rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Log in"}
                {!pending && <ArrowRight className="size-4" />}
              </Button>
            </form>
          </div>
        </section>

        <section className="hidden bg-[#f4f4f2] p-10 lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-[640px] bg-white p-8 shadow-[0_28px_80px_rgba(0,0,0,0.10)]">
            <div className="flex items-center justify-between border-b pb-5">
              <p className="text-sm font-bold">Admin overview</p>
              <span className="text-xs font-semibold text-[#777]">users / collections / images</span>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-5">
              {["Users", "Collections", "Store"].map((item) => (
                <div key={item} className="border p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">{item}</p>
                  <div className="mt-8 h-2 bg-[#22bda7]" />
                  <div className="mt-3 h-2 w-2/3 bg-[#d8d8d8]" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

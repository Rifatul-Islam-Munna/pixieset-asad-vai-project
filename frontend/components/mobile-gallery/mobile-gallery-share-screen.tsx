"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink, Link2, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { MobileGalleryApp, MobileGalleryProfile } from "@/api-hooks/use-mobile-gallery";

type ShareStep = "method" | "templates" | "compose" | "link";

const shareTemplates = [
  {
    id: "ready",
    label: "Mobile App Ready",
    title: "Your Mobile Gallery App is Ready",
    subject: (name: string) => `Your ${name} mobile app is ready!`,
    intro: (name: string) => `To install your ${name} mobile gallery app, open this email on your mobile phone and click the Install App button.`,
  },
  {
    id: "wedding",
    label: "Wedding Delivery",
    title: "Your Wedding Gallery is Ready",
    subject: (name: string) => `${name} wedding gallery is ready`,
    intro: (name: string) => `Your ${name} wedding gallery is ready to view, favorite, download and install on your phone.`,
  },
  {
    id: "event",
    label: "Event Photos",
    title: "Your Event Photos are Ready",
    subject: (name: string) => `${name} event photos are ready`,
    intro: (name: string) => `The photos from ${name} are ready. Open the link below on your phone to view or install the gallery app.`,
  },
] as const;

export function MobileGalleryShareScreen({
  app,
  profile,
  sendInvite,
}: {
  app: MobileGalleryApp;
  profile: MobileGalleryProfile;
  sendInvite: any;
}) {
  const router = useRouter();
  const [step, setStep] = useState<ShareStep>("method");
  const [email, setEmail] = useState("");
  const [sendCopy, setSendCopy] = useState(true);
  const [templateId, setTemplateId] = useState<(typeof shareTemplates)[number]["id"]>("ready");
  const selectedTemplate = shareTemplates.find((template) => template.id === templateId) || shareTemplates[0];
  const [subject, setSubject] = useState(selectedTemplate.subject(app.name));
  const [message, setMessage] = useState(selectedTemplate.intro(app.name));
  const link = typeof window === "undefined" ? `/mobile-gallery/${app.slug}` : `${window.location.origin}/mobile-gallery/${app.slug}`;
  const body = `Hi,\n\n${message}\n\nInstall App: ${link}\n\nThanks`;
  const isPublished = app.status !== "draft";

  function goBack() {
    if (step === "method") {
      router.push(`/dashboard/mobile-gallery/apps/${app._id}`);
      return;
    }
    setStep(step === "compose" ? "templates" : "method");
  }

  function chooseTemplate(id: (typeof shareTemplates)[number]["id"]) {
    const template = shareTemplates.find((item) => item.id === id) || shareTemplates[0];
    setTemplateId(id);
    setSubject(template.subject(app.name));
    setMessage(template.intro(app.name));
    setStep("compose");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!isPublished) {
      toast.error("Publish this app before sharing it");
      return;
    }
    try {
      const result = await sendInvite.mutateAsync({
        to: email,
        subject,
        message,
        templateTitle: selectedTemplate.title,
        link,
        sendCopy,
      });
      if (result.data.delivered) {
        toast.success("Invitation sent");
        return;
      }
      toast.info("Server email is not configured, so the prepared invitation was opened in your email app.");
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send invitation");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f4] text-[#202020]">
      <div className="border-b bg-white px-4 py-4 sm:px-6">
        <button onClick={goBack} className="flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> {step === "method" ? `Back to ${app.name}` : "Back"}</button>
      </div>

      {!isPublished && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-4 text-center text-sm text-amber-900">
          This app is unpublished. Publish it in App Settings before sending invitations or sharing the public link.
        </div>
      )}

      {step === "method" && (
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-8">
          <div className="text-center"><h1 className="text-3xl font-light">Share {app.name}</h1><p className="mt-3 text-sm text-[#777]">Choose how you want to share this mobile gallery app.</p></div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <button disabled={!isPublished} onClick={() => setStep("templates")} className="border bg-white p-8 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"><Mail className="size-8 text-[#18bfa6]" /><h2 className="mt-5 text-xl font-semibold">Share by Email</h2><p className="mt-2 text-sm leading-6 text-[#777]">Select a template, review the invitation and send it from the server or your email app.</p></button>
            <button disabled={!isPublished} onClick={() => setStep("link")} className="border bg-white p-8 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"><Link2 className="size-8 text-[#18bfa6]" /><h2 className="mt-5 text-xl font-semibold">Get Direct Link</h2><p className="mt-2 text-sm leading-6 text-[#777]">Copy the public app link or open it in a new tab to test installation.</p></button>
          </div>
        </section>
      )}

      {step === "templates" && (
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
          <div className="text-center"><h1 className="text-3xl font-light">Select Email Template</h1><p className="mt-3 text-sm text-[#777]">The selected template opens the invitation composer on the next page.</p></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {shareTemplates.map((template) => (
              <button key={template.id} onClick={() => chooseTemplate(template.id)} className="overflow-hidden border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="border-b bg-[#fafafa] p-6 text-center"><Mail className="mx-auto size-7 text-[#18bfa6]" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#777]">{template.label}</p></div>
                <div className="p-6"><h2 className="text-lg font-semibold">{template.title}</h2><p className="mt-3 text-sm leading-6 text-[#777]">{template.intro(app.name)}</p><span className="mt-6 inline-block text-sm font-semibold text-[#18bfa6]">Use Template →</span></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "link" && (
        <section className="mx-auto max-w-xl px-4 py-16 sm:px-8">
          <div className="bg-white p-6 shadow-sm sm:p-9">
            <Link2 className="size-8 text-[#18bfa6]" />
            <h1 className="mt-5 text-2xl font-light">Direct App Link</h1>
            <p className="mt-2 text-sm leading-6 text-[#777]">Visitors see the app-install prompt and can use the public mobile gallery from this link.</p>
            <div className="mt-7 break-all border bg-[#fafafa] p-4 text-sm">{link}</div>
            <div className="mt-5 flex flex-wrap gap-3"><button onClick={copyLink} className="flex items-center gap-2 bg-[#18bfa6] px-5 py-3 font-semibold text-white"><Copy className="size-4" /> Copy Link</button><a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 border px-5 py-3"><ExternalLink className="size-4" /> Open Link</a></div>
          </div>
        </section>
      )}

      {step === "compose" && (
        <div className="grid min-h-[calc(100vh-58px)] lg:grid-cols-2">
          <form onSubmit={send} className="bg-white p-5 sm:p-10 lg:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18bfa6]">{selectedTemplate.label}</p>
            <h1 className="mt-2 text-2xl font-light">Share by Email</h1>
            <Field label="Email" value={email} onChange={setEmail} type="email" required placeholder="e.g. johnsmith@email.com" />
            <Field label="Subject" value={subject} onChange={setSubject} />
            <label className="mt-5 block text-sm font-semibold">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={7} className="mt-2 w-full border p-4 font-normal leading-6 outline-none focus:border-[#18bfa6]" /></label>
            <div className="mt-4 rounded border bg-[#fafafa] p-3 text-xs leading-5 text-[#777]">The Install App button automatically uses this link: <span className="break-all">{link}</span></div>
            {profile.contactEmail && <label className="mt-4 flex items-center gap-2 text-sm text-[#666]"><input type="checkbox" checked={sendCopy} onChange={(event) => setSendCopy(event.target.checked)} /> Send a copy to {profile.contactEmail}</label>}
            <div className="mt-5 flex flex-wrap gap-3"><button disabled={sendInvite.isPending || !isPublished} className="flex items-center gap-2 bg-[#18bfa6] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"><Mail className="size-4" /> {sendInvite.isPending ? "Sending…" : "Send Invite"}</button><button type="button" onClick={copyLink} className="flex items-center gap-2 border px-5 py-3"><Copy className="size-4" /> Copy Link</button></div>
            <p className="mt-4 text-xs leading-5 text-[#888]">When server email delivery is configured, the invitation is sent directly. Otherwise the prepared invitation opens in your email application.</p>
          </form>

          <div className="flex items-center justify-center p-5 sm:p-8">
            <div className="w-full max-w-xl bg-white shadow">
              <div className="border-b p-8 text-center sm:p-10">
                {profile.logoUrl && <img src={profile.logoUrl} alt="Business logo" className="mx-auto mb-6 h-12 max-w-[180px] object-contain" />}
                <p className="text-xs uppercase tracking-widest text-[#777]">{selectedTemplate.label}</p>
                <h2 className="mt-6 text-2xl sm:text-3xl">{selectedTemplate.title}</h2>
              </div>
              <div className="p-8 text-center sm:p-10">
                {app.iconUrl || app.coverImage ? <img src={app.iconUrl || app.coverImage} alt="" className="mx-auto size-32 rounded-[28px] object-cover sm:size-36 sm:rounded-[30px]" /> : <div className="mx-auto flex size-32 items-center justify-center rounded-[28px] bg-[#eee]"><Smartphone className="size-9" /></div>}
                <h3 className="mt-4 uppercase tracking-widest">{app.name}</h3>
                <p className="mx-auto mt-6 whitespace-pre-line max-w-md text-sm leading-6 text-[#666]">{message}</p>
                <a href={link} className="mt-8 inline-block bg-[#18bfa6] px-7 py-3 font-semibold text-white">Install App</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, value, onChange, required = false, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="mt-5 block text-sm font-semibold">{label}<input type={type} required={required} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label>;
}

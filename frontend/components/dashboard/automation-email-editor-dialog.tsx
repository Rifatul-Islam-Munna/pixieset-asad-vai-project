"use client";

import { useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CreateMarketingAutomationPayload, MarketingAutomationRecord } from "@/api-hooks/use-marketing-automations";
import type { EmailTemplateItem } from "@/lib/dashboard-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type AutomationEmailDraft = {
  name: string;
  templateId: string;
  templateName: string;
  subject: string;
  previewText: string;
  eyebrowText: string;
  message: string;
  footerText: string;
  buttonText: string;
  buttonLink: string;
  buttonColor: string;
  image: string;
  showImage: boolean;
};

function draftFromAutomation(automation: MarketingAutomationRecord): AutomationEmailDraft {
  return {
    name: automation.name || "Automated email",
    templateId: automation.templateId || "custom",
    templateName: automation.templateName || "Automated email",
    subject: automation.subject || "",
    previewText: automation.previewText || "",
    eyebrowText: automation.eyebrowText || "",
    message: automation.message || "",
    footerText: automation.footerText || "",
    buttonText: automation.buttonText || "",
    buttonLink: automation.buttonLink || "",
    buttonColor: automation.buttonColor || "#444444",
    image: automation.image || "",
    showImage: automation.showImage !== false,
  };
}

export function AutomationEmailEditorDialog({ automation, emailTemplates, busy, onClose, onSave }: {
  automation: MarketingAutomationRecord;
  emailTemplates: EmailTemplateItem[];
  busy: boolean;
  onClose: () => void;
  onSave: (patch: Partial<CreateMarketingAutomationPayload>) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<AutomationEmailDraft>(() => draftFromAutomation(automation));
  const [baseTemplateId, setBaseTemplateId] = useState(automation.templateId || "");

  const loadTemplate = (templateId: string) => {
    setBaseTemplateId(templateId);
    const template = emailTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setDraft((current) => ({
      ...current,
      templateId: template.id,
      templateName: template.name,
      subject: template.subject || template.title || current.subject,
      previewText: template.previewText || "",
      eyebrowText: template.eyebrowText || "",
      message: template.message || template.previewText || template.title || "",
      footerText: template.footerText || "",
      buttonText: template.buttonText || "",
      buttonLink: template.buttonLink || "",
      buttonColor: template.buttonColor || "#444444",
      image: template.image || "",
      showImage: template.showImage !== false,
    }));
  };

  const save = async () => {
    if (!draft.subject.trim()) return toast.error("Email subject is required");
    if (!draft.message.trim() && !draft.previewText.trim()) return toast.error("Email message is required");
    try {
      await onSave({ ...draft });
      toast.success("Automated email template saved");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Automation email could not be saved");
    }
  };

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-none sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl"><Sparkles className="size-6 text-[#6337d8]" />Edit automated email</DialogTitle>
          <DialogDescription>
            This copy belongs to this automation only. You can write it in any language and change it without editing your saved template library.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-3">
          <div className="grid gap-4 border bg-[#faf9fc] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Start from saved template</span><select value={baseTemplateId} onChange={(event) => loadTemplate(event.target.value)} className="h-11 border bg-white px-3 text-sm"><option value="">Keep current custom copy</option>{emailTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.galleryCategory || "General"} · {template.language || "English"}</option>)}</select></label>
            <div className="text-xs leading-5 text-[#777]">Selecting a template copies it here. You can then edit every field independently.</div>
          </div>

          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Automation name</span><Input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} className="h-11 rounded-none" /></label>
          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Subject</span><Input value={draft.subject} onChange={(event) => setDraft((value) => ({ ...value, subject: event.target.value }))} className="h-11 rounded-none" /></label>
          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Preview text</span><Input value={draft.previewText} onChange={(event) => setDraft((value) => ({ ...value, previewText: event.target.value }))} className="h-11 rounded-none" /></label>
          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Small heading / eyebrow</span><Input value={draft.eyebrowText} onChange={(event) => setDraft((value) => ({ ...value, eyebrowText: event.target.value }))} className="h-11 rounded-none" /></label>
          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Message</span><Textarea value={draft.message} onChange={(event) => setDraft((value) => ({ ...value, message: event.target.value }))} className="min-h-44 rounded-none" /></label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Button text</span><Input value={draft.buttonText} onChange={(event) => setDraft((value) => ({ ...value, buttonText: event.target.value }))} className="h-11 rounded-none" /></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Button link</span><Input value={draft.buttonLink} onChange={(event) => setDraft((value) => ({ ...value, buttonLink: event.target.value }))} placeholder="Collection URL or https://..." className="h-11 rounded-none" /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[170px_minmax(0,1fr)]">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Button color</span><div className="flex gap-2"><Input type="color" value={draft.buttonColor} onChange={(event) => setDraft((value) => ({ ...value, buttonColor: event.target.value }))} className="h-11 w-14 rounded-none p-1" /><Input value={draft.buttonColor} onChange={(event) => setDraft((value) => ({ ...value, buttonColor: event.target.value }))} className="h-11 rounded-none" /></div></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Hero image URL</span><Input value={draft.image} onChange={(event) => setDraft((value) => ({ ...value, image: event.target.value }))} placeholder="https://..." className="h-11 rounded-none" /></label>
          </div>

          <label className="flex items-center justify-between gap-4 border p-4 text-sm font-bold"><span><span className="block">Show hero image</span><span className="mt-1 block text-xs font-normal text-[#777]">Turn this off without deleting the saved image URL.</span></span><Switch checked={draft.showImage} onCheckedChange={(value) => setDraft((current) => ({ ...current, showImage: value }))} /></label>
          <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Footer</span><Textarea value={draft.footerText} onChange={(event) => setDraft((value) => ({ ...value, footerText: event.target.value }))} className="min-h-24 rounded-none" /></label>

          {automation.trigger !== "new-subscriber" && (
            <div className="border-l-2 border-[#6337d8] bg-[#f7f4ff] px-4 py-3 text-xs leading-6 text-[#5d5472]">
              Lifecycle placeholders: <b>{"{{galleryName}}"}</b>, <b>{"{{clientEmail}}"}</b>, and <b>{"{{event}}"}</b>. Use <b>Collection URL</b> as the button link to open the gallery that triggered the email.
            </div>
          )}
          <p className="text-xs leading-5 text-[#888]">Changes apply to future automation events. Emails that are already queued keep the copy they were queued with.</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-none" onClick={onClose}>Cancel</Button>
          <Button type="button" className="rounded-none bg-[#6337d8] px-7 text-white hover:bg-[#542bc2]" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {busy ? "Saving..." : "Save automated email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

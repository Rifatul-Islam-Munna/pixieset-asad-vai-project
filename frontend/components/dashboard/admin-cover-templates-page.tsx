"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Edit3, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateHomeCms } from "@/actions/admin";
import { CoverPreview } from "@/components/dashboard/cover-designs";
import { AdminResourceShell } from "./admin-resource-shell";
import type { CustomCoverTemplate, HomeCmsData } from "@/lib/home-cms";

export function AdminCoverTemplatesPage({ initialCms }: { initialCms: HomeCmsData }) {
  const [cms, setCms] = useState(initialCms);
  const [pendingId, setPendingId] = useState("");
  const [pending, startTransition] = useTransition();
  const templates = cms.coverTemplates ?? [];
  const sorted = useMemo(() => [...templates].sort((a, b) => a.name.localeCompare(b.name)), [templates]);

  const remove = (template: CustomCoverTemplate) => {
    if (!confirm(`Delete ${template.name}? This cannot be undone.`)) return;
    setPendingId(template.id);
    startTransition(async () => {
      try {
        const saved = await updateHomeCms({
          ...cms,
          coverTemplates: templates.filter((item) => item.id !== template.id),
        });
        setCms(saved);
        toast.success("Cover template deleted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete cover template");
      } finally {
        setPendingId("");
      }
    });
  };

  return (
    <AdminResourceShell
      active="covers"
      title="Client gallery cover templates"
      subtitle="Create and manage reusable custom covers. Every template now opens in a full-page visual editor where text and design layers can be dragged directly on the canvas."
      action={(
        <Link href="/admin/cover-templates/new" className="inline-flex h-11 items-center gap-2 bg-[#111] px-5 text-sm font-bold text-white">
          <PlusCircle className="size-4" />New custom cover
        </Link>
      )}
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Templates" value={String(sorted.length)} />
        <SummaryCard label="Total layers" value={String(sorted.reduce((sum, item) => sum + item.elements.length, 0))} />
        <SummaryCard label="Editor" value="Drag & drop" />
      </div>

      <div className="overflow-x-auto border bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b bg-[#fafafa] text-left text-xs uppercase tracking-[0.14em] text-[#777]">
            <tr>
              <th className="px-4 py-4">Preview</th>
              <th className="px-4 py-4">Template</th>
              <th className="px-4 py-4">Layers</th>
              <th className="px-4 py-4">Background</th>
              <th className="px-4 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((template) => (
              <tr key={template.id} className="border-b align-middle last:border-b-0">
                <td className="w-52 px-4 py-4">
                  <div className="aspect-[1.55] overflow-hidden bg-[#111]">
                    <CoverPreview design={{ cover: `custom:${template.id}`, customCoverTemplate: template }} compact className="min-h-0" />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <b>{template.name}</b>
                  <p className="mt-1 text-xs text-[#777]">{template.id}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-[#f1f1ef] px-3 py-1 text-xs font-bold">{template.elements.length} layers</span>
                </td>
                <td className="max-w-64 truncate px-4 py-4 text-xs text-[#666]">{template.backgroundImage}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/cover-templates/${encodeURIComponent(template.id)}`} className="inline-flex size-10 items-center justify-center border hover:bg-[#f2f2f2]" aria-label={`Edit ${template.name}`}>
                      <Edit3 className="size-4" />
                    </Link>
                    <button onClick={() => remove(template)} disabled={pending} className="inline-flex size-10 items-center justify-center border text-red-600 hover:bg-red-50 disabled:opacity-40" aria-label={`Delete ${template.name}`}>
                      {pendingId === template.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={5} className="px-4 py-20 text-center">
                  <div className="mx-auto max-w-md">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f2f2f0]"><PlusCircle className="size-5" /></span>
                    <h3 className="mt-4 text-lg font-semibold">No custom cover templates yet</h3>
                    <p className="mt-2 text-sm leading-6 text-[#777]">Create the first template and arrange every title, date, button, line and logo by dragging it directly on the cover.</p>
                    <Link href="/admin/cover-templates/new" className="mt-5 inline-flex h-11 items-center gap-2 bg-[#111] px-5 text-sm font-bold text-white"><PlusCircle className="size-4" />Create cover</Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminResourceShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="border bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#888]">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p></div>;
}

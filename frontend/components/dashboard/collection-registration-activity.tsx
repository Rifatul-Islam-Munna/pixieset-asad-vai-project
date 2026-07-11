"use client";

import { EyeOff, Mail, Megaphone } from "lucide-react";
import type {
  CollectionEmailRegistrationRecord,
  CollectionPrivatePhotoActivityRecord,
} from "@/api-hooks/use-collections";

function activityDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function EmptyState({
  mode,
}: {
  mode: "registration" | "contacts" | "private";
}) {
  const config = {
    registration: {
      icon: Mail,
      title: "No email registrations yet",
      text: "Email addresses will appear here when visitors enter the collection.",
    },
    contacts: {
      icon: Megaphone,
      title: "No marketing contacts yet",
      text: "Contacts will appear here when visitors opt in to receive your marketing communications.",
    },
    private: {
      icon: EyeOff,
      title: "No private photo activity yet",
      text: "Private photo activity details will show here when clients mark photos as private.",
    },
  }[mode];
  const Icon = config.icon;
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-28 items-center justify-center rounded-full bg-[#f5eeee] text-[#4b4b4b]">
        <Icon className="size-12" />
      </span>
      <h2 className="mt-8 text-lg font-bold">{config.title}</h2>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[#555]">{config.text}</p>
    </div>
  );
}

export function CollectionRegistrationActivity({
  mode,
  registrations,
  privatePhotos,
  collectionName,
}: {
  mode: "registration" | "contacts" | "private";
  registrations: CollectionEmailRegistrationRecord[];
  privatePhotos: CollectionPrivatePhotoActivityRecord[];
  collectionName: string;
}) {
  const contacts = registrations.filter((item) => item.marketingOptIn);
  const rows = mode === "contacts" ? contacts : registrations;

  if (mode === "private") {
    if (!privatePhotos.length) return <EmptyState mode="private" />;
    return (
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
<div>
  <h2 className="text-2xl font-medium">Private Photos</h2>
  <p className="mt-2 text-sm text-[#666]">{collectionName}</p>
</div>
<p className="text-sm text-[#666]">{privatePhotos.length} private photo record{privatePhotos.length === 1 ? "" : "s"}</p>
        </div>
        <div className="mt-7 overflow-x-auto">
<table className="w-full min-w-[760px] text-left text-sm">
  <thead className="border-b text-xs font-bold uppercase text-[#777]">
    <tr>
      <th className="px-1 py-3">Photo</th>
      <th className="px-1 py-3">Email</th>
      <th className="px-1 py-3">Updated</th>
    </tr>
  </thead>
  <tbody>
    {privatePhotos.map((item) => (
      <tr key={item._id} className="border-b">
        <td className="px-1 py-4">
<span className="inline-flex items-center gap-3">
  {item.imageUrl ? (
    <img src={item.imageUrl} alt="" className="size-14 object-cover" />
  ) : (
    <span className="flex size-14 items-center justify-center bg-[#f2f2f2]"><EyeOff className="size-5" /></span>
  )}
  <span className="font-semibold">{item.imageName}</span>
</span>
        </td>
        <td className="px-1 py-4">{item.email}</td>
        <td className="px-1 py-4">{activityDate(item.updatedAt || item.createdAt)}</td>
      </tr>
    ))}
  </tbody>
</table>
        </div>
      </section>
    );
  }

  if (!rows.length) return <EmptyState mode={mode} />;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
<h2 className="text-2xl font-medium">
  {mode === "contacts" ? "Marketing Contacts" : "Email Registration"}
</h2>
<p className="mt-2 text-sm text-[#666]">{collectionName}</p>
        </div>
        <p className="text-sm text-[#666]">{rows.length} contact{rows.length === 1 ? "" : "s"}</p>
      </div>
      <div className="mt-7 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
<thead className="border-b text-xs font-bold uppercase text-[#777]">
  <tr>
    <th className="px-1 py-3">Email</th>
    <th className="px-1 py-3">Collection</th>
    <th className="px-1 py-3">Source</th>
    <th className="px-1 py-3">Marketing</th>
    <th className="px-1 py-3">Updated</th>
  </tr>
</thead>
<tbody>
  {rows.map((item) => (
    <tr key={item._id} className="border-b">
      <td className="px-1 py-5 font-semibold">{item.email}</td>
      <td className="px-1 py-5">{item.collectionName || collectionName}</td>
      <td className="px-1 py-5 capitalize">{item.source.replace(/-/g, " ")}</td>
      <td className="px-1 py-5">{item.marketingOptIn ? "Subscribed" : "Not subscribed"}</td>
      <td className="px-1 py-5">{activityDate(item.updatedAt || item.createdAt)}</td>
    </tr>
  ))}
</tbody>
        </table>
      </div>
    </section>
  );
}

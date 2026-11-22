"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/api-base-url";
import { BackendRequestError, fetchBackendJson } from "@/lib/backend-request";

export type StudioKind = "contacts" | "projects" | "invoices" | "payment-links" |
  "transactions" | "documents" | "templates" | "forms" | "messages" | "discounts" | "settings";

export type StudioRecord = {
  _id: string;
  kind: StudioKind;
  title: string;
  status: string;
  type: string;
  email: string;
  phone: string;
  contactId: string;
  projectId: string;
  description: string;
  currency: string;
  amount: number;
  date?: string;
  dueDate?: string;
  archived: boolean;
  token?: string;
  // Studio records contain intentionally heterogeneous MongoDB Mixed details.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type StudioOverview = {
  counts: Record<string, number>;
  revenue: number;
  recentProjects: StudioRecord[];
  recentInvoices: StudioRecord[];
  recentMessages: StudioRecord[];
};

export type StudioList = { items: StudioRecord[]; total: number; page: number; limit: number };
export type StudioProjectPayment = { projectId: string; currency: string; amount: number };
export type StudioFinancialReport = {
  currencies: Array<{
    currency:string; paid:number; unpaid:number; overdue:number; paidCount:number;
    invoiceCount:number; monthly:Array<{month:string;amount:number}>;
  }>;
  recentTransactions: StudioRecord[];
};

export type StudioSessionType = {
  _id: string; name: string; description: string; durationMinutes: number;
  price: number; currency: string; location: string; coworkerIds: string[]; active: boolean;
  status?: "draft" | "published";
  sessionColor?: string;
  timezone?: string;
  createProjectOnBooking?: boolean;
  projectStage?: string;
  projectType?: string;
  sessionStyle?: "full" | "mini";
  coverImageUrl?: string;
  bookingVisibility?: "public" | "private";
  availability?: Array<{ day: number; enabled: boolean; start: string; end: string }>;
  sessionDates?: Array<{ date: string; start: string; end: string }>;
  intakeFields?: Array<{ name: string; label: string; type: string; required: boolean; options?: string }>;
  paymentPolicy?: "none" | "manual";
  bookingRules?: { minNoticeHours?: number; maxAdvanceDays?: number; slotIntervalMinutes?: number; autoConfirm?: boolean };
  confirmationMessage?: string;
};
export type StudioSession = {
  _id: string; title: string; kind: "booking" | "event";
  status: "pending" | "awaiting-client" | "confirmed" | "completed" | "cancelled";
  startAt: string; endAt: string; allDay: boolean; location: string; notes: string;
  clientName: string; clientEmail: string; clientPhone: string;
  serviceId: string; serviceName: string; source: string;
};
export type StudioBookings = {
  services: StudioSessionType[];
  shareLinks?: Array<{
    _id: string; url: string; serviceId: string; serviceName: string; contactId?: string;
    recipientName: string; recipientEmail: string; expiresAt: string; bookingEventId?: string;
  }>;
  events: StudioSession[];
  settings: {
    enabled: boolean; timezone: string; minNoticeHours: number; maxAdvanceDays: number;
    slotIntervalMinutes: number; autoConfirm: boolean; confirmationMessage: string;
    welcomeMessage?: string; showSocialLinks?: boolean; showWebsite?: boolean;
    showContactEmail?: boolean; showPhoneNumber?: boolean; showBusinessAddress?: boolean;
    businessHours: { day: number; enabled: boolean; start: string; end: string }[];
  };
  owner: {
    name: string; username?: string; avatar?: string; website?: string; email?: string;
    phoneNumber?: string; businessAddress?: string;
    socialLinks?: { instagram?: string; facebook?: string; youtube?: string; linkedin?: string };
  };
  publicIdentifier: string;
};

async function request<T>(path: string, method = "GET", body?: Record<string, unknown>): Promise<T> {
  const accessToken = (await cookies()).get("access_token")?.value;
  if (!accessToken) redirect("/login");
  try {
    const data = await fetchBackendJson<{ data: T }>(apiBaseUrl() + path, {
      method, headers: { access_token: accessToken, "content-type": "application/json" },
      cache: "no-store", ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return data.data;
  } catch (error) {
    if (error instanceof BackendRequestError && error.statusCode === 401) redirect("/login");
    throw error;
  }
}

export type StudioGalleryCollection = {
  _id: string; name: string; status: string; imageCount: number;
  coverImage?: string; eventDate?: string;
};
export type StudioProjectNote = { id:string; text:string; createdAt:string };
export type StudioProjectOverview = {
  project: StudioRecord;
  primaryClient: StudioRecord | null;
  additionalClients: Array<Pick<StudioRecord,"_id"|"title"|"email">>;
  documents: StudioRecord[];
  sessions: StudioSession[];
  messages: StudioRecord[];
  galleries: StudioGalleryCollection[];
  availableGalleries: StudioGalleryCollection[];
  payments: Array<{currency:string;paid:number;upcoming:number;overdue:number}>;
  notes: StudioProjectNote[];
};

export async function studioOverview() { return request<StudioOverview>("/studio/overview"); }
export async function studioList(kind: StudioKind, options: { archived?: string; status?: string; page?: number; limit?: number; search?: string; type?: string; sort?: "newest"|"oldest" } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== "") query.set(key, String(value));
  return request<StudioList>("/studio/" + kind + (query.size ? "?" + query.toString() : ""));
}
export async function studioDetail(kind: StudioKind, id: string) {
  return request<StudioRecord>("/studio/" + kind + "/" + encodeURIComponent(id));
}
export async function studioShareUrl(kind:"forms"|"invoices"|"documents",id:string){
  return request<{url:string;preview:boolean;status:string}>(
    "/studio/"+kind+"/"+encodeURIComponent(id)+"/share-url",
  );
}
export async function studioCreate(kind: StudioKind, payload: Record<string, unknown>) {
  return request<StudioRecord>("/studio/" + kind, "POST", payload);
}
export async function studioUpdate(kind: StudioKind, id: string, payload: Record<string, unknown>) {
  return request<StudioRecord>("/studio/" + kind + "/" + encodeURIComponent(id), "PATCH", payload);
}
export async function studioDelete(kind: StudioKind, id: string) {
  return request<{ deleted: boolean }>("/studio/" + kind + "/" + encodeURIComponent(id), "DELETE");
}
export async function studioSendInvoice(id: string) {
  return request<{ record: StudioRecord; url: string; emailSent: boolean }>("/studio/invoices/" + encodeURIComponent(id) + "/send", "POST");
}
export async function studioUseTemplate(id: string, payload: Record<string, unknown> = {}) {
  return request<StudioRecord>("/studio/templates/" + encodeURIComponent(id) + "/use", "POST", payload);
}
export async function studioProjectPayments() {
  return request<StudioProjectPayment[]>("/studio/projects/payments");
}
export async function studioProjectOverview(id:string) {
  return request<StudioProjectOverview>("/studio/projects/"+encodeURIComponent(id)+"/overview");
}
export async function studioAddProjectNote(id:string,text:string) {
  return request<StudioProjectNote>("/studio/projects/"+encodeURIComponent(id)+"/notes","POST",{text});
}
export async function studioDeleteProjectNote(id:string,noteId:string) {
  return request<{deleted:boolean}>("/studio/projects/"+encodeURIComponent(id)+"/notes/"+encodeURIComponent(noteId),"DELETE");
}
export async function studioLinkProjectGallery(id:string,collectionId:string) {
  return request<StudioGalleryCollection>("/studio/projects/"+encodeURIComponent(id)+"/collections","POST",{collectionId});
}
export async function studioUnlinkProjectGallery(id:string,collectionId:string) {
  return request<{unlinked:boolean}>("/studio/projects/"+encodeURIComponent(id)+"/collections/"+encodeURIComponent(collectionId),"DELETE");
}
export async function studioFinancialReport() {
  return request<StudioFinancialReport>("/studio/reports/summary");
}
export async function studioSendEmail(payload: { contactId?: string; projectId?: string; email?: string; subject: string; content: string }) {
  return request<StudioRecord>("/studio/messages/send", "POST", payload);
}
export async function studioSendContract(id: string) {
  return request<{ record: StudioRecord; url: string; emailSent: boolean }>("/studio/documents/" + encodeURIComponent(id) + "/send", "POST");
}
export async function studioRecordPayment(id: string, method: string, note = "") {
  return request<{ invoice: StudioRecord }>("/studio/invoices/" + encodeURIComponent(id) + "/record-payment", "POST", { method, note });
}

export async function studioBookingOverview() { return request<StudioBookings>("/bookings/overview"); }
export async function studioCalendarSync() {
  return request<{ url: string; enabled: boolean; kind: string }>("/studio/calendar-sync");
}
export async function studioRotateCalendarSync() {
  return request<{ url: string; enabled: boolean; kind: string }>("/studio/calendar-sync/rotate", "POST");
}
export async function studioEnableCalendarSync() {
  return request<{ url: string; enabled: boolean; kind: string }>("/studio/calendar-sync/enable", "POST");
}
export async function studioRevokeCalendarSync() {
  return request<{ enabled: boolean }>("/studio/calendar-sync", "DELETE");
}
export async function studioCreateBookingInvite(payload: Record<string, unknown>) {
  return request<{ url: string; emailSent: boolean; emailError?: string; _id: string }>("/bookings/share-links", "POST", payload);
}
export async function studioSendBookingInviteEmail(id: string, frontendOrigin: string) {
  return request<{ emailSent: boolean; emailError?: string; url: string }>(
    "/bookings/share-links/" + encodeURIComponent(id) + "/send", "POST", { frontendOrigin },
  );
}
export async function studioDeleteBookingInvite(id: string) {
  return request<{ deleted: boolean }>("/bookings/share-links/" + encodeURIComponent(id), "DELETE");
}
export async function studioCreateBookingService(payload: Record<string, unknown>) {
  return request<StudioSessionType>("/bookings/services", "POST", payload);
}
export async function studioUpdateBookingService(id: string, payload: Record<string, unknown>) {
  return request<StudioSessionType>("/bookings/services/" + encodeURIComponent(id), "PATCH", payload);
}
export async function studioDeleteBookingService(id: string) {
  return request<unknown>("/bookings/services/" + encodeURIComponent(id), "DELETE");
}
export async function studioCreateBookingEvent(payload: Record<string, unknown>) {
  return request<StudioSession>("/bookings/events", "POST", payload);
}
export async function studioUpdateBookingEvent(id: string, payload: Record<string, unknown>) {
  return request<StudioSession>("/bookings/events/" + encodeURIComponent(id), "PATCH", payload);
}
export async function studioDeleteBookingEvent(id: string) {
  return request<unknown>("/bookings/events/" + encodeURIComponent(id), "DELETE");
}
export async function studioUpdateBookingSettings(payload: Record<string, unknown>) {
  return request<StudioBookings["settings"]>("/bookings/settings", "PATCH", payload);
}

export async function studioUploadSessionCover(formData: FormData) {
  const response = await fetch(apiBaseUrl() + "/image-upload/upload-image", { method: "POST", body: formData, cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || typeof payload?.data !== "string") throw new Error(payload?.message || "Could not upload the cover image");
  return payload.data as string;
}

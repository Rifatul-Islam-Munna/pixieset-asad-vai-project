"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";

export type BookingBusinessHour = { day: number; enabled: boolean; start: string; end: string };
export type BookingSettings = {
  _id?: string;
  enabled: boolean;
  timezone: string;
  minNoticeHours: number;
  maxAdvanceDays: number;
  slotIntervalMinutes: number;
  autoConfirm: boolean;
  confirmationMessage: string;
  businessHours: BookingBusinessHour[];
};
export type BookingTypeRecord = {
  _id: string; name: string; description: string; durationMinutes: number; price: number;
  currency: string; location: string; coworkerIds: string[]; active: boolean;
};
export type BookingCoworkerRecord = {
  _id: string; name: string; email: string; phone: string; role: string; notes: string; active: boolean;
};
export type BookingEventRecord = {
  _id: string; title: string; kind: "booking" | "event";
  status: "pending" | "confirmed" | "completed" | "cancelled";
  startAt: string; endAt: string; allDay: boolean; location: string; notes: string;
  clientName: string; clientEmail: string; clientPhone: string;
  serviceId: string; serviceName: string; coworkerIds: string[]; source: "dashboard" | "public";
};
export type BookingShareLinkRecord = {
  _id: string; token: string; recipientName: string; recipientEmail: string;
  serviceId: string; serviceName: string; expiresAt: string; usedAt?: string;
  bookingEventId: string; url: string; createdAt?: string; emailSent?: boolean;
};
export type BookingOverview = {
  settings: BookingSettings; services: BookingTypeRecord[]; coworkers: BookingCoworkerRecord[];
  events: BookingEventRecord[]; shareLinks: BookingShareLinkRecord[]; publicIdentifier: string;
  owner: { name: string; username?: string; avatar?: string };
};
type ApiResponse<T> = { data: T; message?: string };

async function post<T>(url: string, payload: unknown) {
  const [data, error] = await PostRequestAxios<ApiResponse<T>>(url, payload);
  if (error || !data) throw new Error(error?.message || "Request failed");
  return data.data;
}
async function patch<T>(url: string, payload: unknown) {
  const [data, error] = await PatchRequestAxios<any>(url, payload as any);
  if (error || !data) throw new Error(error?.message || "Request failed");
  return (data as ApiResponse<T>).data;
}
async function remove(url: string) {
  const [data, error] = await DeleteRequestAxios<ApiResponse<{ deleted: boolean; id: string }>>(url);
  if (error || !data) throw new Error(error?.message || "Request failed");
  return data.data;
}

export function useBookingManager() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: ["booking-overview"] });
  const query = useQuery({
    queryKey: ["booking-overview"],
    queryFn: () => GetRequestNormal<ApiResponse<BookingOverview>>("/bookings/overview"),
  });
  const updateSettings = useMutation({ mutationFn: (payload: Partial<BookingSettings>) => patch<BookingSettings>("/bookings/settings", payload), onSuccess: invalidate });
  const createShareLink = useMutation({ mutationFn: (payload: { recipientName?: string; recipientEmail?: string; serviceId?: string; expiresAt?: string; sendEmail?: boolean; frontendOrigin?: string }) => post<BookingShareLinkRecord>("/bookings/share-links", payload), onSuccess: invalidate });
  const deleteShareLink = useMutation({ mutationFn: (id: string) => remove(`/bookings/share-links/${encodeURIComponent(id)}`), onSuccess: invalidate });
  const createService = useMutation({ mutationFn: (payload: Partial<BookingTypeRecord>) => post<BookingTypeRecord>("/bookings/services", payload), onSuccess: invalidate });
  const updateService = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<BookingTypeRecord> }) => patch<BookingTypeRecord>(`/bookings/services/${encodeURIComponent(id)}`, payload), onSuccess: invalidate });
  const deleteService = useMutation({ mutationFn: (id: string) => remove(`/bookings/services/${encodeURIComponent(id)}`), onSuccess: invalidate });
  const createCoworker = useMutation({ mutationFn: (payload: Partial<BookingCoworkerRecord>) => post<BookingCoworkerRecord>("/bookings/coworkers", payload), onSuccess: invalidate });
  const updateCoworker = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<BookingCoworkerRecord> }) => patch<BookingCoworkerRecord>(`/bookings/coworkers/${encodeURIComponent(id)}`, payload), onSuccess: invalidate });
  const deleteCoworker = useMutation({ mutationFn: (id: string) => remove(`/bookings/coworkers/${encodeURIComponent(id)}`), onSuccess: invalidate });
  const createEvent = useMutation({ mutationFn: (payload: Partial<BookingEventRecord>) => post<BookingEventRecord>("/bookings/events", payload), onSuccess: invalidate });
  const updateEvent = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<BookingEventRecord> }) => patch<BookingEventRecord>(`/bookings/events/${encodeURIComponent(id)}`, payload), onSuccess: invalidate });
  const deleteEvent = useMutation({ mutationFn: (id: string) => remove(`/bookings/events/${encodeURIComponent(id)}`), onSuccess: invalidate });
  return { query, updateSettings, createShareLink, deleteShareLink, createService, updateService, deleteService, createCoworker, updateCoworker, deleteCoworker, createEvent, updateEvent, deleteEvent };
}

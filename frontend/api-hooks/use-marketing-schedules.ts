"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";

export type MarketingScheduleRecord = {
  _id: string;
  name: string;
  status: "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  recipientMode: "contacts" | "category";
  recipientEmails: string[];
  recipientCategory?: string;
  templateId: string;
  templateName: string;
  subject: string;
  collectionId?: string;
  collectionName?: string;
  buttonLink?: string;
  scheduledAt: string;
  scheduledLocal: string;
  timeZone: string;
  recipientsCount: number;
  sentAt?: string;
  lastError?: string;
  createdAt?: string;
};

export type CreateMarketingSchedulePayload = {
  name?: string;
  recipientMode: "contacts" | "category";
  recipientEmails?: string[];
  recipientCategory?: string;
  templateId: string;
  templateName: string;
  subject: string;
  previewText?: string;
  message: string;
  footerText?: string;
  eyebrowText?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;
  image?: string;
  showImage?: boolean;
  collectionId?: string;
  collectionName?: string;
  scheduledLocal: string;
  timeZone: string;
};

type Response<T> = { data: T; message?: string };

export function useMarketingSchedules() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["marketing-schedules"],
    queryFn: () => GetRequestNormal<Response<MarketingScheduleRecord[]>>("/marketing-schedules"),
    refetchInterval: 15_000,
  });
  const create = useMutation({
    mutationFn: async (payload: CreateMarketingSchedulePayload) => {
      const [data, error] = await PostRequestAxios<Response<MarketingScheduleRecord>>("/marketing-schedules", payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["marketing-schedules"] }),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const [data, error] = await PatchRequestAxios<Record<string, never>>(`/marketing-schedules/${encodeURIComponent(id)}/cancel`, {});
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["marketing-schedules"] }),
  });
  return { query, create, cancel };
}

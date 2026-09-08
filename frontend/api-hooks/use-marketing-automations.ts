import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";

export type MarketingAutomationStats = Partial<Record<"scheduled" | "sending" | "sent" | "failed" | "cancelled", number>>;
export type MarketingAutomationTrigger = "new-subscriber" | "gallery-published" | "client-download" | "client-favorite";

export type MarketingAutomationRecord = {
  _id: string;
  name: string;
  enabled: boolean;
  trigger: MarketingAutomationTrigger;
  recipientCategory?: string;
  delayMinutes: number;
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
  stats?: MarketingAutomationStats;
  createdAt?: string;
  updatedAt?: string;
};
export type CreateMarketingAutomationPayload = {
  name: string;
  trigger: MarketingAutomationTrigger;
  enabled?: boolean;
  recipientCategory?: string;
  delayMinutes: number;
  includeExistingContacts?: boolean;
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
};

type Response<T> = { data: T; message?: string };

export function useMarketingAutomations() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["marketing-automations"],
    queryFn: () => GetRequestNormal<Response<MarketingAutomationRecord[]>>("/marketing-schedules/automations"),
    refetchInterval: 15_000,
  });
  const create = useMutation({
    mutationFn: async (payload: CreateMarketingAutomationPayload) => {
      const [data, error] = await PostRequestAxios<Response<MarketingAutomationRecord>>("/marketing-schedules/automations", payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["marketing-automations"] }),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CreateMarketingAutomationPayload> }) => {
      const [data, error] = await PatchRequestAxios<Response<MarketingAutomationRecord>>(`/marketing-schedules/automations/${encodeURIComponent(id)}`, patch);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["marketing-automations"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const [data, error] = await DeleteRequestAxios<Response<{ deleted: boolean }>>(`/marketing-schedules/automations/${encodeURIComponent(id)}`);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["marketing-automations"] }),
  });
  return { query, create, update, remove };
}

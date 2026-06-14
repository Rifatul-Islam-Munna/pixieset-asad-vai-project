"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DeleteRequestAxios,
  GetRequestNormal,
  PostRequestAxios,
} from "./api-hooks";

export type DashboardSettingType = "watermark" | "preset" | "email-template";

export type DashboardSettingRecord<T = unknown> = {
  _id: string;
  userId: string;
  type: DashboardSettingType;
  localId: string;
  name: string;
  data: T;
  createdAt?: string;
  updatedAt?: string;
};

type DashboardSettingsResponse<T = unknown> = {
  data: DashboardSettingRecord<T>[];
};

type SaveSettingPayload<T = unknown> = {
  localId: string;
  name: string;
  collectionId?: string;
  data: T;
};

export function useDashboardSettings<T = unknown>(
  type: DashboardSettingType,
  collectionId?: string,
) {
  const queryClient = useQueryClient();
  const queryKey = ["dashboard-settings", type, collectionId ?? "all"] as const;
  const queryString = collectionId ? `?collectionId=${encodeURIComponent(collectionId)}` : "";

  const query = useQuery({
    queryKey,
    queryFn: () =>
      GetRequestNormal<DashboardSettingsResponse<T>>(`/settings/${type}${queryString}`),
  });

  const saveSetting = useMutation({
    mutationFn: async (payload: SaveSettingPayload<T>) => {
      const [data, error] = await PostRequestAxios<{
        message: string;
        data: DashboardSettingRecord<T>;
      }>(`/settings/${type}`, payload);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteSetting = useMutation({
    mutationFn: async (localId: string) => {
      const [data, error] = await DeleteRequestAxios<{
        message: string;
        data: DashboardSettingRecord<T>;
      }>(`/settings/${type}/${encodeURIComponent(localId)}`);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { query, saveSetting, deleteSetting };
}

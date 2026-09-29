"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DeleteRequestAxios,
  GetRequestNormal,
  PostRequestAxios,
} from "./api-hooks";

export type DashboardSettingType = "watermark" | "preset" | "email-template" | "branding" | "preference" | "integration" | "marketing" | "album-design" | "blog-post";

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      if (type === "watermark") {
        // Collection image responses carry Imagor URLs derived from the saved
        // watermark. Refetch them immediately so position/style changes never
        // keep using an older transformed URL from React Query.
        void queryClient.invalidateQueries({
          queryKey: ["collections"],
          refetchType: "all",
        });
      }
    },
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      if (type === "watermark") {
        void queryClient.invalidateQueries({
          queryKey: ["collections"],
          refetchType: "all",
        });
      }
    },
  });

  return { query, saveSetting, deleteSetting };
}

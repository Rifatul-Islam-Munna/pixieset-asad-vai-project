"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GetRequestNormal, PatchRequestAxios } from "./api-hooks";

export type HomepageVisibility = {
  biography: boolean;
  social: boolean;
  website: boolean;
  email: boolean;
  phone: boolean;
  address: boolean;
};

export type HomepageSocialLinks = {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
};

export type HomepageRecord = {
  _id: string;
  userId: string;
  slug: string;
  publicPath: string;
  enabled: boolean;
  hasPassword: boolean;
  brandName: string;
  logoUrl: string;
  biography: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  socialLinks: HomepageSocialLinks;
  show: HomepageVisibility;
  sortOrder: "newest" | "oldest" | "name";
};

export type HomepageUpdatePayload = Partial<Omit<HomepageRecord, "_id" | "userId" | "slug" | "publicPath" | "hasPassword">> & {
  password?: string;
};

type HomepageResponse = { data: HomepageRecord; message?: string };

export function useHomepageSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["homepage-settings"],
    queryFn: () => GetRequestNormal<HomepageResponse>("/homepages/me"),
  });

  const update = useMutation({
    mutationFn: async (payload: HomepageUpdatePayload) => {
      const [data, error] = await PatchRequestAxios<HomepageResponse>("/homepages/me", payload as any);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["homepage-settings"] }),
  });

  return { query, update };
}

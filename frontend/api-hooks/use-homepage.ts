"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";

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

export type HomepageSite = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  isMain: boolean;
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
  showCategories: boolean;
  featuredCollectionIds: string[];
  sites: HomepageSite[];
  subdomainLimit: number;
  subdomainsUsed: number;
};

export type HomepageUpdatePayload = Partial<Omit<HomepageRecord, "_id" | "userId" | "slug" | "publicPath" | "hasPassword" | "sites" | "subdomainLimit" | "subdomainsUsed">> & {
  password?: string;
};

type HomepageResponse = { data: HomepageRecord; message?: string };

export function useHomepageSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["homepage-settings"],
    queryFn: () => GetRequestNormal<HomepageResponse>("/homepages/me"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["homepage-settings"] });

  const update = useMutation({
    mutationFn: async (payload: HomepageUpdatePayload) => {
      const [data, error] = await PatchRequestAxios<HomepageResponse>("/homepages/me", payload as any);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });

  const createSubdomain = useMutation({
    mutationFn: async (payload: { name: string; slug: string }) => {
      const [data, error] = await PostRequestAxios<HomepageResponse>("/homepages/me/subdomains", payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });

  const updateSubdomain = useMutation({
    mutationFn: async ({ siteId, ...payload }: { siteId: string; name?: string; slug?: string; enabled?: boolean }) => {
      const [data, error] = await PatchRequestAxios<HomepageResponse>(`/homepages/me/subdomains/${encodeURIComponent(siteId)}`, payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteSubdomain = useMutation({
    mutationFn: async (siteId: string) => {
      const [data, error] = await DeleteRequestAxios<HomepageResponse>(`/homepages/me/subdomains/${encodeURIComponent(siteId)}`);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });

  return { query, update, createSubdomain, updateSubdomain, deleteSubdomain };
}

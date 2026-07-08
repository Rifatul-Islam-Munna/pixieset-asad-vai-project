"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";

export type MobileGalleryImage = {
  _id: string;
  appId: string;
  url: string;
  thumbnailUrl?: string;
  originalName?: string;
  order?: number;
};

export type MobileGalleryDesign = {
  coverStyle?: "full" | "third" | "none";
  focal?: { x: number; y: number };
  theme?: "echo" | "spring" | "lark" | "sage";
  layout?: "vertical" | "horizontal";
  gridStyle?: "masonry" | "grid";
  backgroundColor?: string;
  textColor?: string;
};

export type MobileGalleryApp = {
  _id: string;
  name: string;
  slug: string;
  eventDate?: string;
  coverImage?: string;
  iconUrl?: string;
  imageCount?: number;
  status?: "published" | "draft";
  design?: MobileGalleryDesign;
  settings?: {
    callToAction?: { enabled?: boolean; label?: string; url?: string };
  };
  images?: MobileGalleryImage[];
};

export type MobileGalleryProfile = {
  logoUrl?: string;
  biography?: string;
  socialLinks?: Record<string, string>;
  contactEmail?: string;
  phoneNumber?: string;
  businessAddress?: string;
  website?: string;
};

export type MobileGalleryInvitePayload = {
  to: string;
  subject: string;
  message: string;
  templateTitle: string;
  link: string;
  sendCopy?: boolean;
};

export type MobileGalleryInviteResult = {
  delivered: boolean;
  provider: "resend" | "mailto" | string;
  id?: string | null;
  reason?: string;
};

type Data<T> = { data: T; message?: string };

export function useMobileGalleryApps() {
  const client = useQueryClient();
  const appsQuery = useQuery({
    queryKey: ["mobile-gallery-apps"],
    queryFn: () => GetRequestNormal<Data<MobileGalleryApp[]>>("/mobile-gallery/apps"),
  });
  const createApp = useMutation({
    mutationFn: async (payload: { name: string; eventDate?: string }) => {
      const [data, error] = await PostRequestAxios<Data<MobileGalleryApp>>("/mobile-gallery/apps", payload);
      if (error || !data) throw new Error(error?.message || "Could not create app");
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["mobile-gallery-apps"] }),
  });
  const deleteApp = useMutation({
    mutationFn: async (id: string) => {
      const [data, error] = await DeleteRequestAxios<Data<{ deleted: boolean }>>(`/mobile-gallery/apps/${id}`);
      if (error || !data) throw new Error(error?.message || "Could not delete app");
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["mobile-gallery-apps"] }),
  });
  return { appsQuery, createApp, deleteApp };
}

export function useMobileGalleryApp(appId?: string) {
  const client = useQueryClient();
  const appQuery = useQuery({
    enabled: Boolean(appId),
    queryKey: ["mobile-gallery-app", appId],
    queryFn: () => GetRequestNormal<Data<MobileGalleryApp>>(`/mobile-gallery/apps/${appId}`),
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ["mobile-gallery-app", appId] });
    client.invalidateQueries({ queryKey: ["mobile-gallery-apps"] });
  };
  const updateApp = useMutation({
    mutationFn: async (payload: Partial<MobileGalleryApp>) => {
      const [data, error] = await PatchRequestAxios<Data<MobileGalleryApp>>(`/mobile-gallery/apps/${appId}`, payload as any);
      if (error || !data) throw new Error(error?.message || "Could not update app");
      return data;
    },
    onSuccess: refresh,
  });
  const uploadImages = useMutation({
    mutationFn: async (files: FileList | File[]) => {
      if (!appId) throw new Error("App is required");
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      const response = await fetch(`/api/mobile-gallery/apps/${appId}/images`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Upload failed");
      return data as Data<MobileGalleryImage[]>;
    },
    onSuccess: refresh,
  });
  const reorderImages = useMutation({
    mutationFn: async (imageIds: string[]) => {
      const [data, error] = await PatchRequestAxios<Data<{ updated: number }>>(
        `/mobile-gallery/apps/${appId}/images/reorder`,
        { imageIds } as any,
      );
      if (error || !data) throw new Error(error?.message || "Could not reorder photos");
      return data;
    },
    onSuccess: refresh,
  });
  const deleteImage = useMutation({
    mutationFn: async (imageId: string) => {
      const [data, error] = await DeleteRequestAxios<Data<MobileGalleryImage>>(
        `/mobile-gallery/apps/${appId}/images/${imageId}`,
      );
      if (error || !data) throw new Error(error?.message || "Could not delete photo");
      return data;
    },
    onSuccess: refresh,
  });
  const sendInvite = useMutation({
    mutationFn: async (payload: MobileGalleryInvitePayload) => {
      if (!appId) throw new Error("App is required");
      const [data, error] = await PostRequestAxios<Data<MobileGalleryInviteResult>>(
        `/mobile-gallery/apps/${appId}/share-email`,
        payload as any,
      );
      if (error || !data) throw new Error(error?.message || "Could not send invitation");
      return data;
    },
  });
  return { appQuery, updateApp, uploadImages, reorderImages, deleteImage, sendInvite };
}

export function useMobileGalleryProfile() {
  const client = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["mobile-gallery-profile"],
    queryFn: () => GetRequestNormal<Data<MobileGalleryProfile>>("/mobile-gallery/settings/profile"),
  });
  const updateProfile = useMutation({
    mutationFn: async (payload: MobileGalleryProfile) => {
      const [data, error] = await PatchRequestAxios<Data<MobileGalleryProfile>>(
        "/mobile-gallery/settings/profile",
        payload as any,
      );
      if (error || !data) throw new Error(error?.message || "Could not update settings");
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["mobile-gallery-profile"] }),
  });
  return { profileQuery, updateProfile };
}

export async function uploadMobileGalleryAsset(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/mobile-gallery/assets", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "Upload failed");
  return String(data?.data?.url || "");
}

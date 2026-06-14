"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";

export type CollectionRecord = {
  _id: string;
  name: string;
  slug?: string;
  eventDate?: string;
  presetId?: string;
  coverImage?: string;
  imageCount?: number;
  sets?: CollectionSetRecord[];
  tags?: string[];
  watermarkId?: string;
  expiresAt?: string;
  design?: Record<string, any>;
  settings?: Record<string, any>;
  status?: string;
  createdAt?: string;
};

export type CollectionSetRecord = {
  id: string;
  name: string;
  watermarkId?: string;
  createdAt?: string;
};

export type CollectionImageRecord = {
  _id: string;
  collectionId: string;
  setId?: string;
  url: string;
  originalName?: string;
  watermarked?: boolean;
  metadata?: Record<string, any>;
  createdAt?: string;
  collectionName?: string;
  setName?: string;
};

type ListResponse<T> = { data: T };

export function useCollections() {
  const queryClient = useQueryClient();
  const collectionsQuery = useQuery({
    queryKey: ["collections"],
    queryFn: () => GetRequestNormal<ListResponse<CollectionRecord[]>>("/collections"),
  });

  const createCollection = useMutation({
    mutationFn: async (payload: {
      name: string;
      eventDate?: string;
      presetId?: string;
    }) => {
      const [data, error] = await PostRequestAxios<
        ListResponse<CollectionRecord> & { message: string }
      >("/collections", payload);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections"] }),
  });

  return { collectionsQuery, createCollection };
}

export function useCollectionDetail(collectionId?: string) {
  const queryClient = useQueryClient();
  const collectionQuery = useQuery({
    enabled: Boolean(collectionId),
    queryKey: ["collections", collectionId],
    queryFn: () =>
      GetRequestNormal<
        ListResponse<CollectionRecord & { images: CollectionImageRecord[] }>
      >(`/collections/${collectionId}`),
  });

  const updateCollection = useMutation({
    mutationFn: async (payload: Partial<CollectionRecord>) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PatchRequestAxios<
        ListResponse<CollectionRecord> & { message: string }
      >(`/collections/${collectionId}`, payload as any);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  const addSet = useMutation({
    mutationFn: async (name: string) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PostRequestAxios<
        ListResponse<CollectionSetRecord> & { message: string }
      >(`/collections/${collectionId}/sets`, { name });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  const uploadImages = useMutation({
    mutationFn: async ({
      files,
      setId,
      watermarkId,
    }: {
      files: FileList | File[];
      setId?: string;
      watermarkId?: string;
    }) => {
      if (!collectionId) throw new Error("Collection is required");
      const formData = new FormData();
      if (setId) formData.append("setId", setId);
      if (watermarkId) formData.append("watermarkId", watermarkId);
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await fetch(`/api/collections/${collectionId}/images`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as
        | (ListResponse<CollectionImageRecord[]> & { message: string })
        | { message?: string };

      if (!response.ok) throw new Error(data.message ?? "Upload failed");
      return data as ListResponse<CollectionImageRecord[]> & { message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  const deleteImage = useMutation({
    mutationFn: async (imageId: string) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await DeleteRequestAxios<
        ListResponse<CollectionImageRecord> & { message: string }
      >(`/collections/${collectionId}/images/${imageId}`);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  return { collectionQuery, updateCollection, addSet, uploadImages, deleteImage };
}

export function useCollectionImages() {
  return useQuery({
    queryKey: ["collection-images"],
    queryFn: () =>
      GetRequestNormal<ListResponse<CollectionImageRecord[]>>("/collections/images"),
  });
}

export function useImageActions() {
  const queryClient = useQueryClient();

  const starImage = useMutation({
    mutationFn: async ({
      collectionId,
      imageId,
      starred,
    }: {
      collectionId: string;
      imageId: string;
      starred: boolean;
    }) => {
      const [data, error] = await PatchRequestAxios<
        ListResponse<CollectionImageRecord> & { message: string }
      >(`/collections/${collectionId}/images/${imageId}/star`, { starred } as any);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collection-images"] });
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId] });
    },
  });

  return { starImage };
}

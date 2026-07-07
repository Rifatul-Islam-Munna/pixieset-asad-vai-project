"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
  thumbnailUrl?: string;
  blurDataUrl?: string;
  originalName?: string;
  watermarked?: boolean;
  metadata?: Record<string, any>;
  order?: number;
  createdAt?: string;
  collectionName?: string;
  setName?: string;
};

export type CollectionFavoriteActivityRecord = {
  id: string;
  email: string;
  name: string;
  photos: number;
  filenames: string[];
  images?: Array<{ imageId: string; name: string; url: string }>;
  createdAt?: string;
  updatedAt?: string;
};

export type CollectionDownloadActivityRecord = {
  _id: string;
  email: string;
  imageId?: string;
  imageName: string;
  imageUrl?: string;
  downloadType: "single" | "all";
  count: number;
  createdAt?: string;
  updatedAt?: string;
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
      design?: Record<string, any>;
      settings?: Record<string, any>;
    }) => {
      const [data, error] = await PostRequestAxios<
        ListResponse<CollectionRecord> & { message: string }
      >("/collections", payload);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections"] }),
  });

  const updateCollection = useMutation({
    mutationFn: async ({
      collectionId,
      payload,
    }: {
      collectionId: string;
      payload: Partial<CollectionRecord>;
    }) => {
      const [data, error] = await PatchRequestAxios<
        ListResponse<CollectionRecord> & { message: string }
      >(`/collections/${collectionId}`, payload as any);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId] });
    },
  });

  const deleteCollection = useMutation({
    mutationFn: async (collectionId: string) => {
      const [data, error] = await DeleteRequestAxios<
        { data: { deleted: boolean; collectionId: string }; message: string }
      >(`/collections/${collectionId}`);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collection-images"] });
    },
  });

  const duplicateCollection = useMutation({
    mutationFn: async (collectionId: string) => {
      const [data, error] = await PostRequestAxios<
        { data: { collection: CollectionRecord; copied: number }; message: string }
      >(`/collections/${collectionId}/duplicate`, {});

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections"] }),
  });

  return { collectionsQuery, createCollection, updateCollection, deleteCollection, duplicateCollection };
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

  const reorderImages = useMutation({
    mutationFn: async (imageIds: string[]) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PatchRequestAxios<
        { data: { updated: number }; message: string }
      >(`/collections/${collectionId}/images/reorder`, { imageIds } as any);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  return { collectionQuery, updateCollection, addSet, uploadImages, deleteImage, reorderImages };
}

export function useCollectionActivity(collectionId?: string) {
  return useQuery({
    enabled: Boolean(collectionId),
    queryKey: ["collections", collectionId, "activity"],
    queryFn: () =>
      GetRequestNormal<
        ListResponse<{
          favoriteLists: CollectionFavoriteActivityRecord[];
          downloads: CollectionDownloadActivityRecord[];
        }>
      >(`/collections/${collectionId}/activity`),
  });
}

export function useCollectionActivities(collectionIds: string[]) {
  return useQueries({
    queries: collectionIds.map((collectionId) => ({
      enabled: Boolean(collectionId),
      queryKey: ["collections", collectionId, "activity"],
      queryFn: () =>
        GetRequestNormal<
          ListResponse<{
            favoriteLists: CollectionFavoriteActivityRecord[];
            downloads: CollectionDownloadActivityRecord[];
          }>
        >(`/collections/${collectionId}/activity`),
    })),
  });
}

export function useCollectionActivityActions(collectionId?: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["collections", collectionId, "activity"] });
  };
  const deleteFavoriteInfo = useMutation({
    mutationFn: async (favoriteUserId: string) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await DeleteRequestAxios<{ data: { deleted: number }; message: string }>(
        `/collections/${collectionId}/activity/favorites/${favoriteUserId}`,
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: refresh,
  });
  const deleteFavoriteImageInfo = useMutation({
    mutationFn: async ({ favoriteUserId, imageId }: { favoriteUserId: string; imageId: string }) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await DeleteRequestAxios<{ data: { deleted: number }; message: string }>(
        `/collections/${collectionId}/activity/favorites/${favoriteUserId}/images/${imageId}`,
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: refresh,
  });

  const copyFavoriteListToSet = useMutation({
    mutationFn: async ({ favoriteUserId, name }: { favoriteUserId: string; name?: string }) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PostRequestAxios<{ data: { set: CollectionSetRecord; copied: number }; message: string }>(
        `/collections/${collectionId}/activity/favorites/${favoriteUserId}/copy-to-set`,
        { name },
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  const copyFavoriteListToCollection = useMutation({
    mutationFn: async ({ favoriteUserId, name }: { favoriteUserId: string; name?: string }) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PostRequestAxios<{ data: { collection: CollectionRecord; copied: number }; message: string }>(
        `/collections/${collectionId}/activity/favorites/${favoriteUserId}/copy-to-collection`,
        { name },
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  return { deleteFavoriteInfo, deleteFavoriteImageInfo, copyFavoriteListToSet, copyFavoriteListToCollection };
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

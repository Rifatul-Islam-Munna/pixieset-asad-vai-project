"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";

function notifyStorageChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("storage-usage-changed"));
}

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
export type ImagesPage<T> = { items: T[]; total: number; limit: number; offset: number; hasMore: boolean };

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
      status?: "draft" | "published";
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
    onMutate: async (collectionId) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previous = queryClient.getQueryData<ListResponse<CollectionRecord>>(["collections"]);
      queryClient.setQueryData<ListResponse<CollectionRecord>>(["collections"], (current) => current ? { ...current, data: current.data.filter((item) => item._id !== collectionId) } : current);
      return { previous };
    },
    onError: (_error, _collectionId, context) => {
      if (context?.previous) queryClient.setQueryData(["collections"], context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collection-images"] });
      notifyStorageChanged();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      notifyStorageChanged();
    },
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
        ListResponse<CollectionRecord & { images: CollectionImageRecord[]; imagesPage?: ImagesPage<CollectionImageRecord> }>
      >(`/collections/${collectionId}?limit=60&offset=0`),
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
      onProgress,
    }: {
      files: FileList | File[];
      setId?: string;
      watermarkId?: string;
      onProgress?: (percent: number) => void;
    }) => {
      if (!collectionId) throw new Error("Collection is required");
      const formData = new FormData();
      if (setId) formData.append("setId", setId);
      if (watermarkId) formData.append("watermarkId", watermarkId);
      Array.from(files).forEach((file) => formData.append("files", file));
      const data = await uploadFormDataWithProgress<
        (ListResponse<CollectionImageRecord[]> & { message: string }) | { message?: string }
      >(`/api/collections/${collectionId}/images`, formData, onProgress);
      return data as ListResponse<CollectionImageRecord[]> & { message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
      notifyStorageChanged();
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
      notifyStorageChanged();
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

function uploadFormDataWithProgress<T>(
  url: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
) {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      const data = request.response ?? {};
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(data?.message ?? "Upload failed"));
        return;
      }
      onProgress?.(100);
      resolve(data as T);
    };
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(formData);
  });
}

export function fetchCollectionImagesPage(collectionId: string, offset: number, limit = 60) {
  return GetRequestNormal<ListResponse<ImagesPage<CollectionImageRecord>>>(
    `/collections/${collectionId}/images?limit=${limit}&offset=${offset}`,
  );
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
      notifyStorageChanged();
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
      notifyStorageChanged();
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

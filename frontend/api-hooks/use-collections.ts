"use client";

import { useEffect } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteRequestAxios, GetRequestNormal, PatchRequestAxios, PostRequestAxios } from "./api-hooks";
import {
  batches,
  directUploadMetadata,
  uploadFilesDirectlyToS3,
  type CompletedDirectUpload,
  type DirectUploadEvent,
  type DirectUploadStats,
  type DirectUploadTicket,
} from "@/lib/direct-s3-upload";

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
  setImageCounts?: Record<string, number>;
  sets?: CollectionSetRecord[];
  tags?: string[];
  clientEmails?: string[];
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
  mimetype?: string;
  mediaType?: "image" | "video";
  durationSeconds?: number;
  width?: number;
  height?: number;
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

export type CollectionEmailRegistrationRecord = {
  _id: string;
  email: string;
  collectionId: string;
  collectionName: string;
  source: string;
  sources?: string[];
  marketingOptIn: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CollectionPrivatePhotoActivityRecord = {
  _id: string;
  email: string;
  imageId: string;
  imageName: string;
  imageUrl?: string;
  status?: "pending" | "approved" | "declined";
  createdAt?: string;
  updatedAt?: string;
};

type ListResponse<T> = { data: T };
export type DirectUploadProcessingStatus = {
  queued: number;
  processing: number;
  failed: number;
  pending: number;
  optimized: number;
  rawFallback: number;
  current: {
    name: string;
    status: "queued" | "processing";
    attempts: number;
    message: string;
  } | null;
  imageCount?: number;
  setImageCounts?: Record<string, number>;
  completedImages?: CollectionImageRecord[];
};

export type CollectionUploadActivity = {
  stage:
    | "preparing"
    | "authorizing"
    | "uploading"
    | "retrying"
    | "finalizing"
    | "queued";
  message: string;
  fileName?: string;
};
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
      tags?: string[];
      clientEmails?: string[];
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
      const previous = queryClient.getQueryData<ListResponse<CollectionRecord[]>>(["collections"]);
      queryClient.setQueryData<ListResponse<CollectionRecord[]>>(["collections"], (current) => current ? { ...current, data: current.data.filter((item) => item._id !== collectionId) } : current);
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
  type CollectionDetailRecord = CollectionRecord & {
    images: CollectionImageRecord[];
    imagesPage?: ImagesPage<CollectionImageRecord>;
  };
  const upsertCollectionInCaches = (collection: CollectionRecord) => {
    queryClient.setQueryData<ListResponse<CollectionDetailRecord>>(
      ["collections", collectionId],
      (current) =>
        current
          ? { ...current, data: { ...current.data, ...collection } }
          : current,
    );
    queryClient.setQueryData<ListResponse<CollectionRecord[]>>(
      ["collections"],
      (current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) =>
                item._id === collection._id ? { ...item, ...collection } : item,
              ),
            }
          : current,
    );
  };
  const appendSetInCaches = (set: CollectionSetRecord) => {
    const addSetOnce = (sets: CollectionSetRecord[] = []) =>
      sets.some((item) => item.id === set.id) ? sets : [...sets, set];
    queryClient.setQueryData<ListResponse<CollectionDetailRecord>>(
      ["collections", collectionId],
      (current) =>
        current
          ? {
              ...current,
              data: {
                ...current.data,
                sets: addSetOnce(current.data.sets ?? []),
              },
            }
          : current,
    );
    queryClient.setQueryData<ListResponse<CollectionRecord[]>>(
      ["collections"],
      (current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) =>
                item._id === collectionId
                  ? { ...item, sets: addSetOnce(item.sets ?? []) }
                  : item,
              ),
            }
          : current,
    );
  };
  const collectionQuery = useQuery({
    enabled: Boolean(collectionId),
    queryKey: ["collections", collectionId],
    queryFn: () =>
      GetRequestNormal<
        ListResponse<CollectionDetailRecord>
      >(`/collections/${collectionId}?limit=60&offset=0`),
  });

  const processingStatusQuery = useQuery({
    enabled: Boolean(collectionId),
    queryKey: ["collections", collectionId, "upload-processing"],
    queryFn: () =>
      GetRequestNormal<ListResponse<DirectUploadProcessingStatus>>(
        `/collections/${collectionId}/images/direct-upload/status`,
      ),
    refetchInterval: (query) => {
      const status = (
        query.state.data as ListResponse<DirectUploadProcessingStatus> | undefined
      )?.data;
      return status?.pending ? 3000 : false;
    },
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const status = processingStatusQuery.data?.data;
    if (!status) return;
    if (status.pending === 0) {
      void queryClient.invalidateQueries({
        queryKey: ["collections", collectionId],
      });
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      notifyStorageChanged();
    }
  }, [
    collectionId,
    processingStatusQuery.dataUpdatedAt,
    processingStatusQuery.data?.data,
    queryClient,
  ]);

  const updateCollection = useMutation({
    mutationFn: async (payload: Partial<CollectionRecord>) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PatchRequestAxios<
        ListResponse<CollectionRecord> & { message: string }
      >(`/collections/${collectionId}`, payload as any);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (response) => {
      if (response?.data) upsertCollectionInCaches(response.data);
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
    onSuccess: (response) => {
      if (response?.data) appendSetInCaches(response.data);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  const uploadImages = useMutation({
    mutationFn: async ({
      files,
      setId,
      watermarkId,
      replaceImageId,
      targetCollectionId,
      onProgress,
      onNetworkActivity,
      onActivity,
      onStats,
      onRawUploaded,
    }: {
      files: FileList | File[];
      setId?: string;
      watermarkId?: string;
      replaceImageId?: string;
      targetCollectionId?: string;
      onProgress?: (percent: number) => void;
      onNetworkActivity?: () => void;
      onActivity?: (activity: CollectionUploadActivity) => void;
      onStats?: (stats: DirectUploadStats) => void;
      onRawUploaded?: (uploads: CompletedDirectUpload[]) => void;
    }) => {
      const uploadCollectionId = targetCollectionId || collectionId;
      if (!uploadCollectionId) throw new Error("Collection is required");
      const selected = Array.from(files);
      const totalBytes = selected.reduce((sum, file) => sum + file.size, 0);
      const uploaded: CollectionImageRecord[] = [];
      let transferredBytes = 0;
      let queued = 0;
      // Authorize and saturate the connection with the whole selection instead of
      // pausing after tiny groups. Request concurrency is bounded in direct-s3-upload.ts.
      const uploadBatchSize = Math.max(1, selected.length);

      for (const uploadBatch of batches(selected, uploadBatchSize)) {
        onActivity?.({
          stage: "preparing",
          message: `Preparing ${uploadBatch.length} file${uploadBatch.length === 1 ? "" : "s"} without changing the originals`,
        });
        const metadata = await directUploadMetadata(uploadBatch);
        onActivity?.({
          stage: "authorizing",
          message: "Getting fresh secure upload permission from R2",
        });
        const [authorization, authorizationError] = await PostRequestAxios<{
          data: DirectUploadTicket[];
        }>(
          `/collections/${uploadCollectionId}/images/direct-upload`,
          { files: metadata },
          { timeoutMs: 20_000 },
        );
        if (authorizationError || !authorization) {
          throw new Error(
            authorizationError?.message || "Could not authorize upload",
          );
        }

        onActivity?.({
          stage: "uploading",
          message: `Uploading ${uploadBatch.length} file${uploadBatch.length === 1 ? "" : "s"} directly from browser to Cloudflare R2`,
        });
        const batchBytes = uploadBatch.reduce(
          (sum, file) => sum + file.size,
          0,
        );
        const batchStartBytes = transferredBytes;
        const completed = await uploadFilesDirectlyToS3(
          uploadBatch,
          authorization.data,
          (percent) => {
            const batchTransferred = (batchBytes * percent) / 100;
            const overall = totalBytes
              ? Math.round(
                  ((batchStartBytes + batchTransferred) / totalBytes) * 100,
                )
              : 100;
            onProgress?.(Math.min(99, overall));
          },
          undefined,
          onNetworkActivity,
          (event: DirectUploadEvent) => {
            onActivity?.({
              stage: event.type === "retrying" ? "retrying" : "uploading",
              message: event.message,
              fileName: event.fileName,
            });
          },
          onStats,
        );
        transferredBytes += batchBytes;
        onRawUploaded?.(completed);

        for (const completionBatch of batches(completed, 10)) {
          onActivity?.({
            stage: "finalizing",
            message:
              "Raw upload reached R2. Confirming storage and queueing background optimization.",
          });
          let result:
            | (ListResponse<CollectionImageRecord[]> & {
                message: string;
                queued?: number;
              })
            | null = null;
          let completionError:
            | { message: string; statusCode: number }
            | null = null;

          for (let attempt = 1; attempt <= 3; attempt += 1) {
            [result, completionError] = await PostRequestAxios<
              ListResponse<CollectionImageRecord[]> & {
                message: string;
                queued?: number;
              }
            >(
              `/collections/${uploadCollectionId}/images/direct-upload/complete`,
              {
                files: completionBatch,
                setId,
                watermarkId,
                replaceImageId,
              },
              { timeoutMs: 30_000 },
            );
            if (result) break;
            if (
              completionError &&
              completionError.statusCode >= 400 &&
              completionError.statusCode < 500
            ) {
              break;
            }
            if (attempt < 3) {
              onActivity?.({
                stage: "retrying",
                message: `Storage confirmation did not return cleanly. Retrying automatically (${attempt + 1}/3).`,
              });
              await new Promise((resolve) =>
                setTimeout(resolve, 500 * 2 ** (attempt - 1)),
              );
            }
          }

          if (completionError || !result) {
            throw new Error(
              completionError?.message || "Could not finalize direct upload",
            );
          }
          uploaded.push(...(result.data ?? []));
          const newlyQueued = Math.max(0, Number(result.queued ?? 0));
          queued += newlyQueued;
          onActivity?.({
            stage: "queued",
            message:
              newlyQueued > 0
                ? `Raw upload is safe in R2. ${newlyQueued} photo${newlyQueued === 1 ? "" : "s"} moved to non-blocking background optimization.`
                : "Upload confirmed and ready.",
          });
        }
      }

      onProgress?.(100);
      return {
        data: uploaded,
        message:
          queued > 0
            ? "Upload complete. Image processing continues in background."
            : "Upload complete.",
        queued,
      } as ListResponse<CollectionImageRecord[]> & {
        message: string;
        queued: number;
      };
    },
    onSuccess: (_response, variables) => {
      const uploadedCollectionId =
        variables.targetCollectionId || collectionId;
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({
        queryKey: ["collections", uploadedCollectionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["collections", uploadedCollectionId, "upload-processing"],
      });
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

  const deleteImages = useMutation({
    mutationFn: async (imageIds: string[]) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PostRequestAxios<{
        data: { deleted: number; imageIds: string[] };
        message: string;
      }>(`/collections/${collectionId}/images/delete`, { imageIds });
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

  const updateImage = useMutation({
    mutationFn: async ({
      imageId,
      payload,
    }: {
      imageId: string;
      payload: { originalName?: string; setId?: string; watermarkId?: string };
    }) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PatchRequestAxios<
        ListResponse<CollectionImageRecord> & { message: string }
      >(`/collections/${collectionId}/images/${imageId}`, payload as any);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  const copyMoveImage = useMutation({
    mutationFn: async ({
      imageId,
      mode,
      targetCollectionId,
      targetSetId,
    }: {
      imageId: string;
      mode: "copy" | "move";
      targetCollectionId: string;
      targetSetId?: string;
    }) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PostRequestAxios<
        { data: unknown; message: string }
      >(`/collections/${collectionId}/images/${imageId}/copy-move`, {
        mode,
        targetCollectionId,
        targetSetId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
      notifyStorageChanged();
    },
  });

  return {
    collectionQuery,
    processingStatusQuery,
    updateCollection,
    addSet,
    uploadImages,
    deleteImage,
    deleteImages,
    reorderImages,
    updateImage,
    copyMoveImage,
  };
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
          emailRegistrations: CollectionEmailRegistrationRecord[];
          privatePhotos: CollectionPrivatePhotoActivityRecord[];
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

  const updatePrivatePhotoRequest = useMutation({
    mutationFn: async ({ privatePhotoId, status }: { privatePhotoId: string; status: "pending" | "approved" | "declined" }) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await PatchRequestAxios<{ data: CollectionPrivatePhotoActivityRecord; message: string }>(
        `/collections/${collectionId}/activity/private-photos/${privatePhotoId}`,
        { status },
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: refresh,
  });

  const deletePrivatePhotoRequest = useMutation({
    mutationFn: async (privatePhotoId: string) => {
      if (!collectionId) throw new Error("Collection is required");
      const [data, error] = await DeleteRequestAxios<{ data: { deleted: number }; message: string }>(
        `/collections/${collectionId}/activity/private-photos/${privatePhotoId}`,
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: refresh,
  });

  return { deleteFavoriteInfo, deleteFavoriteImageInfo, copyFavoriteListToSet, copyFavoriteListToCollection, updatePrivatePhotoRequest, deletePrivatePhotoRequest };
}

export function useCollectionImages() {
  return useQuery({
    queryKey: ["collection-images"],
    queryFn: () =>
      GetRequestNormal<ListResponse<CollectionImageRecord[]>>("/collections/images"),
  });
}

export function useImageMetadata(collectionId?: string, imageId?: string) {
  return useQuery({
    enabled: Boolean(collectionId && imageId),
    queryKey: ["image-metadata", collectionId, imageId],
    queryFn: () =>
      GetRequestNormal<ListResponse<CollectionImageRecord>>(
        `/collections/${collectionId}/images/${imageId}/metadata`,
      ),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.metadata?.ai?.status;
      return status === "queued" || status === "processing" ? 5_000 : false;
    },
    refetchIntervalInBackground: false,
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

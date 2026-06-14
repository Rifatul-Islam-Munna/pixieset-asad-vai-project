"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GetRequestNormal, PostRequestAxios } from "./api-hooks";

export type CollectionRecord = {
  _id: string;
  name: string;
  slug?: string;
  eventDate?: string;
  presetId?: string;
  coverImage?: string;
  imageCount?: number;
  createdAt?: string;
};

export type CollectionImageRecord = {
  _id: string;
  collectionId: string;
  url: string;
  originalName?: string;
  watermarked?: boolean;
  metadata?: Record<string, any>;
  createdAt?: string;
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

  const uploadImages = useMutation({
    mutationFn: async (files: FileList | File[]) => {
      if (!collectionId) throw new Error("Collection is required");
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const [data, error] = await PostRequestAxios<
        ListResponse<CollectionImageRecord[]> & { message: string }
      >(`/collections/${collectionId}/images`, formData);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", collectionId] });
    },
  });

  return { collectionQuery, uploadImages };
}

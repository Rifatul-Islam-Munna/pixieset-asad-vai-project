"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GetRequestNormal, PatchRequestAxios } from "./api-hooks";

export type FaceIdentityRecord = {
  identityKey: string;
  name: string;
  representativeImageId: string;
  representativeFaceId: string;
  representativeUrl?: string;
  representativeBox?: { x: number; y: number; width: number; height: number };
  faceCount: number;
  imageCount: number;
  collectionCount: number;
  collectionIds: string[];
  collections: Array<{ id: string; name: string }>;
  lastSeenAt?: string;
};

export type FaceIdentityPage = {
  items: FaceIdentityRecord[];
  page: number;
  limit: number;
  total: number;
  allTotal: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type FaceIdentityListResponse = { data: FaceIdentityPage };
type FaceIdentityUpdateResponse = {
  message: string;
  data: { identityKey: string; name: string };
};

export function useFaceIdentities({ page = 1, limit = 20, search = "" }: { page?: number; limit?: number; search?: string } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set("search", search.trim());
  return useQuery({
    queryKey: ["face-identities", page, limit, search.trim()],
    queryFn: () => GetRequestNormal<FaceIdentityListResponse>(`/face-identities?${params.toString()}`),
    staleTime: 15_000,
    placeholderData: (previous) => previous,
  });
}

export function useRenameFaceIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { identityKey: string; name: string }) => {
      const [response, error] = await PatchRequestAxios<FaceIdentityUpdateResponse, { name: string }>(
        `/face-identities/${encodeURIComponent(input.identityKey)}`,
        { name: input.name },
      );
      if (error || !response) throw new Error(error?.message || "Could not update person name.");
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["face-identities"] }),
  });
}

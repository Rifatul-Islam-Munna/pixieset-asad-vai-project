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

type FaceIdentityListResponse = { data: FaceIdentityRecord[] };
type FaceIdentityUpdateResponse = {
  message: string;
  data: { identityKey: string; name: string };
};

export function useFaceIdentities() {
  return useQuery({
    queryKey: ["face-identities"],
    queryFn: () => GetRequestNormal<FaceIdentityListResponse>("/face-identities"),
    staleTime: 15_000,
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
    onSuccess: (updated) => {
      queryClient.setQueryData<FaceIdentityListResponse>(["face-identities"], (current) => {
        if (!current) return current;
        return {
          data: current.data.map((identity) =>
            identity.identityKey === updated.identityKey
              ? { ...identity, name: updated.name }
              : identity,
          ),
        };
      });
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GetRequestNormal, PatchRequestAxios } from "./api-hooks";

export type AccountProfile = {
  _id: string;
  username: string;
  name: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber: string;
  avatar?: string;
  website?: string;
  businessAddress?: string;
  biography?: string;
};

type Response<T> = { data: T; message?: string };

export function useAccount() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["account-profile"], queryFn: () => GetRequestNormal<Response<AccountProfile>>("/user/get-my-profile") });
  const update = useMutation({
    mutationFn: async (payload: Partial<AccountProfile> & { password?: string }) => {
      const [data, error] = await PatchRequestAxios<Response<AccountProfile>>("/user/profile", payload as any);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["account-profile"] }),
  });
  return { query, update };
}

export async function checkUsername(username: string) {
  return GetRequestNormal<Response<{ username: string; available: boolean; reason: string }>>(`/user/username-availability?username=${encodeURIComponent(username)}`);
}

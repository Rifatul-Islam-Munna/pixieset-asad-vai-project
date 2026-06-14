"use client"

import { QueryKey, useMutation, useQuery, UseQueryOptions,MutationKey } from "@tanstack/react-query";
import { GetRequestNormal } from "./api-hooks";
import {  UseMutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";


export function useQueryWrapper<T>(
  key: QueryKey,
  url: string,
  options?: Omit<UseQueryOptions<T, Error, T>, 'queryKey' | 'queryFn'>,
  revalidate?: number,
  tag?:string
) {


  return useQuery<T, Error>({
    queryKey: key,
    queryFn: ()=>GetRequestNormal<T>(url,revalidate,tag),
  
    ...options,
  });
}









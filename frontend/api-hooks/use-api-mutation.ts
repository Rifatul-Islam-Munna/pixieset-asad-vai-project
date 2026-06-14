"use client"

// hooks/use-api-mutation.ts
import { useMutation, UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PostRequestAxios, PatchRequestAxios, DeleteRequestAxios } from './api-hooks'

type HttpMethod = 'POST' | 'PATCH' | 'DELETE'

interface UseApiMutationConfig<TData = any, TVariables = any> {
  url: string
  method: HttpMethod
  mutationKey?: string[]
  successMessage?: string
  onSuccess?: (data: TData) => void
  onError?: (error: Error) => void,
 
}

export function useCommonMutationApi<TData = any, TVariables = any>(
  config: UseApiMutationConfig<TData, TVariables>
) {
  console.log("url",config?.url,"method",config?.method,"mutationKey")
  const { url, method, mutationKey, successMessage, onSuccess, onError } = config

  // Select the right function based on method
  const getMutationFn = () => {
    switch (method) {
      case 'POST':
        return async (data: TVariables) => {
          const [response, error] = await PostRequestAxios<TData>(url, data)
          return { data: response, error }
        }
      case 'PATCH':
        return async (data: TVariables) => {
          const [response, error] = await PatchRequestAxios<TData>(url, data)
          return { data: response, error }
        }
      case 'DELETE':
        return async (variables: TVariables | string) => {
           const id = typeof variables === 'string' ? variables : (variables as any)?.id
          const [response, error] = await DeleteRequestAxios<TData>(`${url}?id=${id}`)
          return { data: response, error }
        }
      default:
        throw new Error(`Unsupported method: ${method}`)
    }
  }

  return useMutation({
    mutationKey: mutationKey,
    mutationFn: async (variables: TVariables) => {
      const mutationFn = getMutationFn()
      const res = await mutationFn(variables as any)
      
      
      
      return res
    },
    onSuccess: (data) => {
        if(data?.data){
            toast.success(successMessage || "Success!")
      onSuccess?.(data?.data  )
      return

        }
        toast.error(data?.error?.message || "Unknown error")
      onError?.( {
        message: data?.error?.message || "Unknown error"
      } as Error)
      
    },
    onError: (error: Error) => {
      toast.error(error.message)
      onError?.(error)
    },
  })
}

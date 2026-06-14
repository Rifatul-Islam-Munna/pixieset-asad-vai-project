"use server"


import axios from "axios"
import { AxiosError } from "axios"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { cookies } from "next/headers"
import { redirect } from 'next/navigation'



export const getToken = async ()=>{
    const access_token = (await cookies()).get("access_token")?.value
  
    return {access_token}
}

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000"

function parseAxiosError(error: AxiosError): { message: string, statusCode: number } {
  const res = error?.response?.data as any ;
  const statusCode = error?.response?.data?.statusCode ?? 500;

  let message = 'Something went wrong';

  if (res?.message) {
    if (Array.isArray(res.message?.message)) {
      message = res.message.message[0];
    } else if (typeof res.message === 'string') {
      message = res.message;
    } else if (typeof res.message?.message === 'string') {
      message = res.message.message;
    }
  }

  return { message, statusCode };
}

export const PostRequestAxios = async <T>(url: string, payload: any) : Promise<[T | null, { message: string; statusCode: number } | null]> => {
    const {access_token} = await getToken()
    try{
        const {data} = await axios.post<T>(`${baseUrl}${url}`, payload,{
            headers:{
                access_token:access_token,
            
            }
            
        })
        return [data,null];

    }catch(error ){
        if (axios.isAxiosError(error)) {
            if (error.status === 401) {
                throw redirect('/login')
                
                }
                console.log("error->",error.response?.data)
               
             const meg = parseAxiosError(error as any);
             

    return [null, meg]; 
        }
          if (isRedirectError(error)) throw error;
       
        return [null, null];
    }
}
export const PatchRequestAxios = async <T>(url: string, payload: T) : Promise<[T | null, { message: string; statusCode: number } | null]> => {
    const {access_token} = await getToken()
    try{
        const {data} = await axios.patch(`${baseUrl}${url}`, payload,{
            headers:{
                access_token:access_token,
            
            }
            
        })
       return [ data,null]

    }catch(error ){
        if (axios.isAxiosError(error)) {
            if (error.status === 401 || error.status === 403) {
                throw redirect('/login')
                
                }
                console.log("error->",error.response?.data)
               
             const meg = parseAxiosError(error as any);
             

        return [null, meg]; 
        }
        if (isRedirectError(error)) throw error;
       
       return [null, null];
    }
}
export const GetRequestAxios = async <T>(url: string, ) : Promise<[T | null, AxiosError | null]> => {
    try{
        const {data} = await axios.get(`${baseUrl}${url}`)
        return [data,null];

    }catch(error ){
        if (axios.isAxiosError(error)) {
            return [null, error]; 
        }
       
        return [null, null];
    }
}
export const GetRequestNormal = async <T>(url: string,revalidate=0 ,revalidateTags="stumaps") : Promise<T> => {
    const {access_token} = await getToken()
    
    try{
        const response = await fetch(`${baseUrl}${url}`,{next:{revalidate:revalidate,tags:[revalidateTags]},headers:{
               
                access_token:access_token ? access_token : '',
                
               

        }})
       if (response.ok) {
      const data = await response.json()
       console.log("data",data)
      return data
    } else {
        console.log("response",response.status)
      if (response.status === 401 || response.status === 403) {
       throw redirect('/login')
      }
   
      const errorPayload = await response.json()
      console.log("error",errorPayload)
     throw new Error(errorPayload.message)
    }

    }catch(error ){
          if (isRedirectError(error)) throw error;
       if (error instanceof Error) {
      throw new Error(error.message)
    }
    throw new Error("Unknown error")
     
           
            
         
         
        
       
      
    }
}


export const DeleteRequestAxios = async <T>(url: string): 
  Promise<[T | null, { message: string; statusCode: number } | null]> => {
    
    const { access_token } = await getToken();

    try {
        const { data } = await axios.delete<T>(`${baseUrl}${url}`, {
            headers: {
                access_token: access_token,
            },
        });

        return [data, null];

    } catch (error: any) {

        if (axios.isAxiosError(error)) {

            if (error.status === 401) {
                throw redirect('/login');
            }

            console.log("error->", error.response?.data);

            const meg = parseAxiosError(error as any);

            return [null, meg];
        }

        if (isRedirectError(error)) throw error;

        return [null, null];
    }
};

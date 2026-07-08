"use server"
import { PostRequestAxios } from "@/api-hooks/api-hooks";
import { cookies } from "next/headers";
import {User, UserInfo} from "@/@types/user"

 type userData ={
    user:User,
    data?:User,
    access_token:string,
    message:string
 }
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 10,
} as const;

export const loginUser = async (phoneNumber: string, password: string) => {
    const [data, error] = await PostRequestAxios<userData>("/user/login-user",{phoneNumber,password});
    if(data){
    const cookie = await cookies();
   cookie.set("access_token", data?.access_token || "", cookieOptions);
   cookie.set("user", JSON.stringify(data?.user) || "", cookieOptions);
    }
   
   return {data,error};

}

export const registerUser = async (payload: {
    name: string;
    phoneNumber: string;
    password: string;
    email?: string;
    gender?: string;
}) => {
    const body = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== "")
    );
    const [data, error] = await PostRequestAxios<userData>("/user", body);
    if(data){
    const cookie = await cookies();
   cookie.set("access_token", data?.access_token || "", cookieOptions);
   cookie.set("user", JSON.stringify(data?.user || data?.data) || "", cookieOptions);
    }
   
   return {data,error};
}
export const loginWithGoogle = async (idToken:string)=>{

    const [data, error] = await PostRequestAxios<userData>("/user/login-user-with-google",{id:idToken});
    if(data){
    const cookie = await cookies();
   cookie.set("access_token", data?.access_token || "", cookieOptions);
   const userSaveData = {
    _id:data?.user?._id,
    name:data?.user?.name,
    email:data?.user?.email,
    phoneNumber:data?.user?.phoneNumber,
    isOtpVerified:data?.user?.isOtpVerified,
    numberOfConnections:data?.user?.numberOfConnections,
    role:data?.user?.role,
    gender:data?.user?.gender
   }
   cookie.set("user", JSON.stringify(userSaveData) || "", cookieOptions);
    }
   
   return {data,error};
}

export const logOutUser = async ()=>{
        const cookie = await cookies();
 cookie.delete("access_token");
 cookie.delete("user");
 return true
}

export const getUser = async ()=>{
    const cookie = await cookies();
    const userString = cookie.get("user")?.value;
    const UserData:UserInfo | null = userString ? JSON.parse(userString) : null;

    return UserData;
}

export const requestNumber = async (payoad:{userId:string, requestUserId:string}) => {
    const [data, error] = await PostRequestAxios("/user/request-for-number",payoad);
    console.log("requestNumberdata",data);
    if(data){
        const cookie = await cookies();

        cookie.set("user", JSON.stringify(data?.userData) || "", cookieOptions);
    }
    return {data,error};
}

export const setUserData = async (data:Record<string,any>) =>{
     const cookie = await cookies();

        cookie.set("user", JSON.stringify(data) || "", cookieOptions);
}

export const setOtpData = async (payoad:Record<string,any>) =>{
    const [data, error] = await PostRequestAxios("/user/verify-otp",payoad);
    if(data){
        const cookie = await cookies();
        cookie.set("user", JSON.stringify(data?.data) || "", cookieOptions);
           cookie.set("access_token", data?.access_token || "", cookieOptions);
    }
    console.log("setOtpdata--------------> dadad ------------>",data);
    return {data,error};
}

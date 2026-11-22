import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
import {apiBaseUrl} from "@/lib/api-base-url";

const allowed=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");
  if(origin&&new URL(origin).host!==request.nextUrl.host)
    return NextResponse.json({message:"Invalid upload origin"},{status:403});
  const token=(await cookies()).get("access_token")?.value;
  if(!token)return NextResponse.json({message:"Log in to upload a cover image"},{status:401});
  try{
    const upload=await request.formData();
    const file=upload.get("file");
    if(!(file instanceof File)||file.size===0||file.size>5*1024*1024||!allowed.has(file.type))
      return NextResponse.json({message:"Choose a JPG, PNG, WebP or AVIF image under 5 MB"},{status:400});
    const body=new FormData();
    body.append("file",file,file.name);
    const response=await fetch(apiBaseUrl()+"/studio/payment-links/cover-image",{
      method:"POST",headers:{access_token:token},body,cache:"no-store",
    });
    const payload=await response.json().catch(()=>({message:"Image upload failed"}));
    if(!response.ok)
      return NextResponse.json({message:payload.message||"Image upload failed"},{status:response.status});
    if(typeof payload?.data?.url!=="string")
      return NextResponse.json({message:"Storage did not provide an image URL"},{status:502});
    return NextResponse.json({url:payload.data.url});
  }catch{
    return NextResponse.json({message:"Unable to upload image"},{status:500});
  }
}

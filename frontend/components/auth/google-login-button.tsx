"use client";

import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from "@react-oauth/google";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { loginWithGoogle } from "@/actions/auth";

export function GoogleLoginButton() {
  const [pending, setPending] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      toast.error("Google login failed");
      return;
    }

    setPending(true);
    const result = await loginWithGoogle(idToken);
    setPending(false);

    if (result.error) {
      toast.error(result.error.message || "Google login failed");
      return;
    }

    window.location.assign(result.data?.user?.role === "admin" ? "/admin" : "/dashboard/client-gallery");
  };

  if (!clientId) {
    return (
      <button type="button" disabled className="flex h-11 w-full items-center justify-center border bg-[#f8f8f8] text-sm font-bold text-[#777]">
        Google login not configured
      </button>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="flex min-h-11 w-full items-center justify-center">
        {pending ? (
          <div className="flex h-11 w-full items-center justify-center gap-2 border text-sm font-bold text-[#555]">
            <Loader2 className="size-4 animate-spin" />
            Signing in
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => toast.error("Google login failed")}
            theme="outline"
            size="large"
            width="390"
            text="continue_with"
          />
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

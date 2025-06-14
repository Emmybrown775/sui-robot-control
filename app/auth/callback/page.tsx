"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export default function AuthCallback() {
  const router = useRouter();
  const { completeLogin } = useAuth();

  useEffect(() => {
    // Extract JWT from URL fragment
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);
    const idToken = params.get("id_token");

    if (idToken) {
      completeLogin(idToken).then(() => {
        router.push("/control"); // Redirect to home page
      });
    } else {
      console.error("No ID token found in callback");
      router.push("/"); // Redirect to home page
    }
  }, [completeLogin, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing login...</p>
      </div>
    </div>
  );
}

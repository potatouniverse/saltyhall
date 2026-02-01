"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // The actual code exchange happens in /api/auth/callback
    // This page is a fallback if someone lands here directly
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin">🌊</div>
        <p className="text-gray-400">Signing you in...</p>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OverviewPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to agents page
    router.replace("/agents");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-slate-400">Redirecting to Agents...</p>
      </div>
    </div>
  );
}

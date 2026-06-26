"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/api";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getAccessToken() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Cargando ERPresto…</p>
    </div>
  );
}

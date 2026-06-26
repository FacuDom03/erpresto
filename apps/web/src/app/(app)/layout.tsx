"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  // null = todavía no chequeamos (evita mismatch de hidratación con localStorage)
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setAuthorized(true);
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-60 shrink-0 border-r bg-card p-4 md:block">
          <Skeleton className="mb-6 h-8 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="mb-6 h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin] duration-200",
          collapsed ? "md:ml-16" : "md:ml-60",
        )}
      >
        <Header onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

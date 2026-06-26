"use client";

import { PanelLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BranchSelector } from "@/components/layout/branch-selector";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export function Header({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        title="Mostrar u ocultar menú"
        className="hidden md:inline-flex"
      >
        <PanelLeft />
        <span className="sr-only">Alternar barra lateral</span>
      </Button>

      {/* Búsqueda global (placeholder visual) */}
      <button
        type="button"
        className="inline-flex h-9 w-full max-w-xs cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Búsqueda global (próximamente)"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="pointer-events-none hidden items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <BranchSelector />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

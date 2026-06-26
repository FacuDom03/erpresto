"use client";

import { LogOut, UserRound } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name?: string, email?: string): string {
  const source = name?.trim() || email || "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { user, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground ring-offset-background transition-shadow hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Cuenta"
        >
          {initials(user?.name, user?.email)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="flex items-center gap-2">
            <UserRound className="size-4 text-muted-foreground" />
            {user?.name ?? "Mi cuenta"}
          </span>
          {user?.email && (
            <span className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

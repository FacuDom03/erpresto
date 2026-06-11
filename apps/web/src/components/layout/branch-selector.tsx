"use client";

import { useState } from "react";
import { Check, Store } from "lucide-react";

import { useBranch } from "@/lib/branch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

/**
 * Selector de sucursal activa para el header.
 * - Con sucursales del usuario: dropdown para elegir.
 * - Sin sucursales informadas: permite cargar un branchId manual
 *   (persistido en localStorage vía useBranch).
 */
export function BranchSelector() {
  const { branchId, branches, setBranchId, isManual } = useBranch();
  const [manualValue, setManualValue] = useState("");

  const current = branches.find((b) => b.id === branchId);
  const label = current?.name ?? (branchId ? `Sucursal ${branchId.slice(0, 6)}…` : "Elegir sucursal");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm" className="max-w-44 gap-1.5">
          <Store className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Sucursal activa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.length > 0 ? (
          branches.map((branch) => (
            <DropdownMenuItem
              key={branch.id}
              onClick={() => setBranchId(branch.id)}
            >
              <Check
                className={branch.id === branchId ? "opacity-100" : "opacity-0"}
              />
              <span className="truncate">{branch.name}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="space-y-2 p-2">
            <p className="text-xs text-muted-foreground">
              Tu usuario no tiene sucursales asignadas. Ingresá el ID de la
              sucursal para operar.
            </p>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (manualValue.trim()) {
                  setBranchId(manualValue);
                  setManualValue("");
                }
              }}
            >
              <Input
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="ID de sucursal"
                className="h-8 text-xs"
              />
              <Button type="submit" size="sm" disabled={!manualValue.trim()}>
                Usar
              </Button>
            </form>
            {isManual && branchId && (
              <p className="break-all text-[11px] text-muted-foreground">
                Actual: <code>{branchId}</code>
              </p>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

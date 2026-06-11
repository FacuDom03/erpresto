"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/lib/auth";
import type { Branch } from "@/lib/types";

const BRANCH_KEY = "erpresto.branchId";

interface BranchContextValue {
  /** Sucursal activa (null mientras se resuelve o si no hay ninguna). */
  branchId: string | null;
  /** Sucursales del usuario ([] si /auth/me no las informa). */
  branches: Branch[];
  setBranchId: (id: string) => void;
  /** true si el id no proviene del usuario (carga manual en el header). */
  isManual: boolean;
}

const BranchContext = createContext<BranchContextValue | null>(null);

function readStoredBranchId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRANCH_KEY);
}

/**
 * Resuelve la sucursal activa: primer branch del usuario (de `branches` o
 * `branchIds` de /auth/me) o, si el backend no informa ninguna, un branchId
 * manual persistido en localStorage (seleccionable desde el header).
 */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  // Hidratación desde localStorage (solo cliente).
  useEffect(() => {
    setSelected(readStoredBranchId());
  }, []);

  const branches = useMemo<Branch[]>(() => {
    if (user?.branches && user.branches.length > 0) {
      return user.branches.map((b) => ({
        id: b.id,
        name: b.name || b.id,
      }));
    }
    if (user?.branchIds && user.branchIds.length > 0) {
      return user.branchIds.map((id, index) => ({
        id,
        name: `Sucursal ${index + 1}`,
      }));
    }
    return [];
  }, [user]);

  // Si el usuario tiene sucursales y la seleccionada no es válida, usamos la primera.
  useEffect(() => {
    if (branches.length === 0) return;
    if (selected && branches.some((b) => b.id === selected)) return;
    const first = branches[0].id;
    setSelected(first);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BRANCH_KEY, first);
    }
  }, [branches, selected]);

  const setBranchId = useCallback((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setSelected(trimmed);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BRANCH_KEY, trimmed);
    }
  }, []);

  const isManual = branches.length === 0;

  return (
    <BranchContext.Provider
      value={{ branchId: selected, branches, setBranchId, isManual }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    throw new Error("useBranch debe usarse dentro de <BranchProvider>");
  }
  return ctx;
}

import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { Category } from "@/lib/types";

/**
 * CRUD de categorías de productos.
 * GET devuelve árbol plano con `parentId` (la Fase 1b solo usa un nivel).
 */

function normalizeCategory(raw: unknown): Category {
  const c = raw as Record<string, unknown>;
  return {
    id: String(c.id),
    name: typeof c.name === "string" ? c.name : "",
    description: typeof c.description === "string" ? c.description : null,
    color: typeof c.color === "string" && c.color ? c.color : null,
    sortOrder: c.sortOrder == null ? 0 : toNumber(c.sortOrder),
    parentId: typeof c.parentId === "string" ? c.parentId : null,
    defaultStation:
      typeof c.defaultStation === "string" && c.defaultStation
        ? c.defaultStation
        : null,
    defaultRequiresPreparation:
      typeof c.defaultRequiresPreparation === "boolean"
        ? c.defaultRequiresPreparation
        : undefined,
  };
}

export async function getCategories(): Promise<Category[]> {
  const raw = await apiFetch<unknown>("/categories");
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown[] })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
  return list.map(normalizeCategory);
}

export interface CategoryPayload {
  name: string;
  color?: string | null;
  sortOrder?: number;
  /** Estación por defecto para los productos de la categoría. */
  defaultStation?: string | null;
  /** Si los productos de la categoría requieren preparación por defecto. */
  defaultRequiresPreparation?: boolean;
}

function cleanCategoryPayload(payload: CategoryPayload): Record<string, unknown> {
  const body: Record<string, unknown> = { name: payload.name };
  if (payload.color) body.color = payload.color;
  if (payload.sortOrder != null) body.sortOrder = payload.sortOrder;
  body.defaultStation = payload.defaultStation?.trim() || null;
  if (payload.defaultRequiresPreparation != null) {
    body.defaultRequiresPreparation = payload.defaultRequiresPreparation;
  }
  return body;
}

export async function createCategory(
  payload: CategoryPayload,
): Promise<Category> {
  const raw = await apiFetch<unknown>("/categories", {
    method: "POST",
    body: cleanCategoryPayload(payload),
  });
  return normalizeCategory(raw);
}

export async function updateCategory(
  id: string,
  payload: CategoryPayload,
): Promise<Category> {
  const raw = await apiFetch<unknown>(`/categories/${id}`, {
    method: "PATCH",
    body: cleanCategoryPayload(payload),
  });
  return normalizeCategory(raw);
}

export function deleteCategory(id: string): Promise<void> {
  return apiFetch<void>(`/categories/${id}`, { method: "DELETE" });
}

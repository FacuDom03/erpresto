import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { ProductAdjustType, ProductStockEntry } from "@/lib/types";

/**
 * Stock de producción (platos), independiente de la materia prima.
 * Contrato: docs/06-contratos-fase1b.md (sección Stock).
 */

export const PRODUCT_ADJUST_TYPE_LABELS: Record<ProductAdjustType, string> = {
  MANUAL: "Manual",
  ADJUSTMENT: "Ajuste",
  WASTE: "Merma",
};

function normalizeEntry(raw: unknown): ProductStockEntry {
  const e = raw as Record<string, unknown>;
  const product = (e.product ?? {}) as Record<string, unknown>;
  return {
    productId: String(e.productId ?? product.id ?? ""),
    branchId: String(e.branchId ?? ""),
    quantity: toNumber(e.quantity),
    product: {
      id: String(product.id ?? e.productId ?? ""),
      name: typeof product.name === "string" ? product.name : "Producto",
      sku: typeof product.sku === "string" && product.sku ? product.sku : null,
      minStock: product.minStock == null ? null : toNumber(product.minStock),
    },
  };
}

export async function getProductStock(
  branchId: string,
): Promise<ProductStockEntry[]> {
  const raw = await apiFetch<unknown>(
    `/product-stock?branchId=${encodeURIComponent(branchId)}`,
  );
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown[] })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
  return list.map(normalizeEntry);
}

export interface ProductionPayload {
  branchId: string;
  /** Si true descuenta insumos SOLO de los productos con receta activa. */
  consumeRawMaterials: boolean;
  notes?: string;
  items: { productId: string; quantity: number }[];
}

export function createProduction(payload: ProductionPayload): Promise<unknown> {
  return apiFetch<unknown>("/product-stock/production", {
    method: "POST",
    body: payload,
  });
}

export interface AdjustProductStockPayload {
  branchId: string;
  productId: string;
  /** Positivo suma, negativo descuenta. */
  quantity: number;
  type: ProductAdjustType;
  notes?: string;
}

export function adjustProductStock(
  payload: AdjustProductStockPayload,
): Promise<unknown> {
  return apiFetch<unknown>("/product-stock/adjust", {
    method: "POST",
    body: payload,
  });
}

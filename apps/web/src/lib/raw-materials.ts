import { ApiError, apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type {
  MeasureUnit,
  RawAdjustType,
  RawMaterial,
  Warehouse,
  WarehouseStock,
} from "@/lib/types";

/**
 * Materia prima y depósitos.
 * Contrato: docs/06-contratos-fase1b.md (sección Stock).
 * Los Decimal de Prisma pueden llegar serializados como string → toNumber.
 */

export const UNIT_LABELS: Record<MeasureUnit, string> = {
  UNIT: "Unidad",
  KG: "Kilogramo (kg)",
  G: "Gramo (g)",
  L: "Litro (l)",
  ML: "Mililitro (ml)",
  PACK: "Pack",
};

/** Abreviatura para mostrar junto a cantidades ("3 kg"). */
export const UNIT_SHORT: Record<MeasureUnit, string> = {
  UNIT: "u.",
  KG: "kg",
  G: "g",
  L: "l",
  ML: "ml",
  PACK: "pack",
};

export const RAW_ADJUST_TYPE_LABELS: Record<RawAdjustType, string> = {
  ADJUSTMENT: "Ajuste",
  WASTE: "Merma",
  INVENTORY: "Inventario",
};

function normalizeWarehouseStock(raw: unknown): WarehouseStock {
  const w = raw as Record<string, unknown>;
  return {
    warehouseId: String(w.warehouseId ?? ""),
    warehouseName: typeof w.warehouseName === "string" ? w.warehouseName : null,
    branchId: typeof w.branchId === "string" ? w.branchId : null,
    quantity: toNumber(w.quantity),
  };
}

function normalizeRawMaterial(raw: unknown): RawMaterial {
  const m = raw as Record<string, unknown>;
  return {
    id: String(m.id),
    name: typeof m.name === "string" ? m.name : "",
    sku: typeof m.sku === "string" && m.sku ? m.sku : null,
    unit: (m.unit as MeasureUnit) ?? "UNIT",
    category: typeof m.category === "string" && m.category ? m.category : null,
    minStock: m.minStock == null ? null : toNumber(m.minStock),
    avgCost: toNumber(m.avgCost),
    lastCost: toNumber(m.lastCost),
    totalStock: toNumber(m.totalStock),
    stockByWarehouse: Array.isArray(m.stockByWarehouse)
      ? m.stockByWarehouse.map(normalizeWarehouseStock)
      : [],
    active: typeof m.active === "boolean" ? m.active : undefined,
  };
}

export interface RawMaterialListResult {
  data: RawMaterial[];
  total: number;
}

export interface RawMaterialListParams {
  page: number;
  limit: number;
  search?: string;
}

/**
 * GET /raw-materials. El contrato prevé `?search=&page=&limit=` → { data, total },
 * pero el backend actual devuelve la lista completa: en ese caso filtramos y
 * paginamos client-side para que la UI se comporte igual.
 */
export async function getRawMaterials(
  params: RawMaterialListParams,
): Promise<RawMaterialListResult> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) query.set("search", params.search);

  const raw = await apiFetch<unknown>(`/raw-materials?${query.toString()}`);

  // Forma paginada { data, total }
  const res = raw as { data?: unknown[]; total?: unknown };
  if (Array.isArray(res?.data)) {
    return {
      data: res.data.map(normalizeRawMaterial),
      total: typeof res.total === "number" ? res.total : res.data.length,
    };
  }

  // Forma lista completa → filtrado/paginación client-side
  const all = Array.isArray(raw)
    ? (raw as unknown[]).map(normalizeRawMaterial)
    : [];
  const term = params.search?.trim().toLowerCase() ?? "";
  const filtered = term
    ? all.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          (m.sku ?? "").toLowerCase().includes(term) ||
          (m.category ?? "").toLowerCase().includes(term),
      )
    : all;
  const start = (params.page - 1) * params.limit;
  return {
    data: filtered.slice(start, start + params.limit),
    total: filtered.length,
  };
}

/** Lista completa (para combobox de insumos en el editor de recetas). */
export async function getAllRawMaterials(): Promise<RawMaterial[]> {
  const result = await getRawMaterials({ page: 1, limit: 1000 });
  return result.data;
}

export interface RawMaterialPayload {
  name: string;
  sku?: string | null;
  unit: MeasureUnit;
  category?: string | null;
  minStock?: number | null;
  avgCost?: number | null;
  lastCost?: number | null;
}

/** Omite los null para no pisar campos opcionales que el backend no acepta como null. */
function cleanRawMaterialPayload(
  payload: RawMaterialPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = { name: payload.name, unit: payload.unit };
  if (payload.sku) body.sku = payload.sku;
  if (payload.category) body.category = payload.category;
  if (payload.minStock != null) body.minStock = payload.minStock;
  if (payload.avgCost != null) body.avgCost = payload.avgCost;
  if (payload.lastCost != null) body.lastCost = payload.lastCost;
  return body;
}

export async function createRawMaterial(
  payload: RawMaterialPayload,
): Promise<RawMaterial> {
  const raw = await apiFetch<unknown>("/raw-materials", {
    method: "POST",
    body: cleanRawMaterialPayload(payload),
  });
  return normalizeRawMaterial(raw);
}

export async function updateRawMaterial(
  id: string,
  payload: RawMaterialPayload,
): Promise<RawMaterial> {
  const raw = await apiFetch<unknown>(`/raw-materials/${id}`, {
    method: "PATCH",
    body: cleanRawMaterialPayload(payload),
  });
  return normalizeRawMaterial(raw);
}

export function deleteRawMaterial(id: string): Promise<void> {
  return apiFetch<void>(`/raw-materials/${id}`, { method: "DELETE" });
}

export interface AdjustRawStockPayload {
  warehouseId: string;
  /** Positivo suma, negativo descuenta. */
  quantity: number;
  type: RawAdjustType;
  notes?: string;
}

export function adjustRawMaterialStock(
  id: string,
  payload: AdjustRawStockPayload,
): Promise<unknown> {
  return apiFetch<unknown>(`/raw-materials/${id}/adjust`, {
    method: "POST",
    body: payload,
  });
}

// ---------------------------------------------------------------------------
// Depósitos
// ---------------------------------------------------------------------------

function normalizeWarehouse(raw: unknown): Warehouse {
  const w = raw as Record<string, unknown>;
  return {
    id: String(w.id),
    name: typeof w.name === "string" ? w.name : "Depósito",
    isDefault: typeof w.isDefault === "boolean" ? w.isDefault : undefined,
    active: typeof w.active === "boolean" ? w.active : undefined,
  };
}

/**
 * GET /warehouses?branchId=. Si la ruta todavía no existe (404), cae al
 * detalle de la sucursal (GET /branches/:id incluye `warehouses`).
 */
export async function getWarehouses(branchId: string): Promise<Warehouse[]> {
  let list: unknown[];
  try {
    const raw = await apiFetch<unknown>(
      `/warehouses?branchId=${encodeURIComponent(branchId)}`,
    );
    list = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { data?: unknown[] })?.data)
        ? (raw as { data: unknown[] }).data
        : [];
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    const branch = await apiFetch<{ warehouses?: unknown[] }>(
      `/branches/${encodeURIComponent(branchId)}`,
    );
    list = Array.isArray(branch?.warehouses) ? branch.warehouses : [];
  }
  return list.map(normalizeWarehouse).filter((w) => w.active !== false);
}

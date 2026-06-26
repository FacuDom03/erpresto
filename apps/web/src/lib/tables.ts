import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { Area, DiningTable, TableShape, TableStatus } from "@/lib/types";

/**
 * Encapsula los shapes de la API de salón (áreas y mesas).
 * Contrato: docs/05-contratos-fase1.md.
 */

const DEFAULT_SIZE: Record<TableShape, { width: number; height: number }> = {
  ROUND: { width: 80, height: 80 },
  SQUARE: { width: 80, height: 80 },
  RECTANGLE: { width: 120, height: 80 },
  BOX: { width: 70, height: 70 },
  BAR: { width: 200, height: 50 },
  DECOR: { width: 100, height: 60 },
};

export function defaultTableSize(shape: TableShape): {
  width: number;
  height: number;
} {
  return DEFAULT_SIZE[shape];
}

function normalizeTable(raw: unknown): DiningTable {
  const t = raw as Record<string, unknown>;
  const shape = (t.shape as TableShape) ?? "SQUARE";
  const size = DEFAULT_SIZE[shape] ?? DEFAULT_SIZE.SQUARE;
  return {
    id: String(t.id),
    areaId: String(t.areaId ?? ""),
    name: typeof t.name === "string" ? t.name : "Mesa",
    shape,
    status: (t.status as TableStatus) ?? "FREE",
    capacity: t.capacity == null ? 0 : toNumber(t.capacity),
    x: toNumber(t.x),
    y: toNumber(t.y),
    width: t.width == null ? size.width : toNumber(t.width),
    height: t.height == null ? size.height : toNumber(t.height),
    rotation: toNumber(t.rotation),
    color: typeof t.color === "string" && t.color ? t.color : null,
    mergedIntoId:
      typeof t.mergedIntoId === "string" && t.mergedIntoId
        ? t.mergedIntoId
        : null,
  };
}

function normalizeArea(raw: unknown): Area {
  const a = raw as Record<string, unknown>;
  return {
    id: String(a.id),
    branchId: String(a.branchId ?? ""),
    name: typeof a.name === "string" ? a.name : "Área",
    sortOrder: a.sortOrder == null ? undefined : toNumber(a.sortOrder),
    tables: Array.isArray(a.tables) ? a.tables.map(normalizeTable) : [],
  };
}

export async function getAreas(branchId: string): Promise<Area[]> {
  const raw = await apiFetch<unknown>(
    `/areas?branchId=${encodeURIComponent(branchId)}`,
  );
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown[] })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
  return list.map(normalizeArea);
}

export function createArea(branchId: string, name: string): Promise<Area> {
  return apiFetch<Area>("/areas", { method: "POST", body: { branchId, name } });
}

export function updateArea(
  id: string,
  payload: { name?: string; sortOrder?: number },
): Promise<Area> {
  return apiFetch<Area>(`/areas/${id}`, { method: "PATCH", body: payload });
}

export function deleteArea(id: string): Promise<void> {
  return apiFetch<void>(`/areas/${id}`, { method: "DELETE" });
}

export interface CreateTablePayload {
  areaId: string;
  name: string;
  shape: TableShape;
  capacity?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  color?: string | null;
}

export async function createTable(
  payload: CreateTablePayload,
): Promise<DiningTable> {
  const raw = await apiFetch<unknown>("/tables", {
    method: "POST",
    body: payload,
  });
  return normalizeTable(raw);
}

export interface UpdateTablePayload {
  name?: string;
  capacity?: number;
  shape?: TableShape;
  status?: TableStatus;
  areaId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  color?: string | null;
}

export async function updateTable(
  id: string,
  payload: UpdateTablePayload,
): Promise<DiningTable> {
  const raw = await apiFetch<unknown>(`/tables/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeTable(raw);
}

export function deleteTable(id: string): Promise<void> {
  return apiFetch<void>(`/tables/${id}`, { method: "DELETE" });
}

export interface LayoutEntry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export function saveLayout(tables: LayoutEntry[]): Promise<void> {
  return apiFetch<void>("/tables/layout", {
    method: "PUT",
    body: { tables },
  });
}

export function mergeTable(id: string, intoTableId: string): Promise<void> {
  return apiFetch<void>(`/tables/${id}/merge`, {
    method: "POST",
    body: { intoTableId },
  });
}

export function splitTable(id: string): Promise<void> {
  return apiFetch<void>(`/tables/${id}/split`, { method: "POST" });
}

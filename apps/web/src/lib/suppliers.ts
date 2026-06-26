import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { Supplier } from "@/lib/types";

/**
 * Proveedores. Contrato: docs/06-contratos-fase1b.md.
 * DELETE → soft (active=false) si tiene órdenes de compra, hard si no.
 */

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function normalizeSupplier(raw: unknown): Supplier {
  const s = raw as Record<string, unknown>;
  return {
    id: String(s.id),
    name: typeof s.name === "string" ? s.name : "",
    cuit: optionalString(s.cuit),
    contactName: optionalString(s.contactName),
    phone: optionalString(s.phone),
    email: optionalString(s.email),
    address: optionalString(s.address),
    deliveryDays: s.deliveryDays == null ? null : toNumber(s.deliveryDays),
    rating: s.rating == null ? null : toNumber(s.rating),
    notes: optionalString(s.notes),
    active: s.active !== false,
  };
}

export interface SupplierListResult {
  data: Supplier[];
  total: number;
}

export interface SupplierListParams {
  page: number;
  limit: number;
  search?: string;
}

export async function getSuppliers(
  params: SupplierListParams,
): Promise<SupplierListResult> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) query.set("search", params.search);

  const raw = await apiFetch<unknown>(`/suppliers?${query.toString()}`);
  const res = raw as { data?: unknown[]; total?: unknown };
  if (Array.isArray(res?.data)) {
    return {
      data: res.data.map(normalizeSupplier),
      total: typeof res.total === "number" ? res.total : res.data.length,
    };
  }
  const list = Array.isArray(raw) ? (raw as unknown[]) : [];
  return { data: list.map(normalizeSupplier), total: list.length };
}

export interface SupplierPayload {
  name: string;
  cuit?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  deliveryDays?: number | null;
  rating?: number | null;
  notes?: string | null;
}

/** Omite strings vacíos/null para no mandar campos opcionales en blanco. */
function cleanSupplierPayload(
  payload: SupplierPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = { name: payload.name };
  if (payload.cuit) body.cuit = payload.cuit;
  if (payload.contactName) body.contactName = payload.contactName;
  if (payload.phone) body.phone = payload.phone;
  if (payload.email) body.email = payload.email;
  if (payload.address) body.address = payload.address;
  if (payload.deliveryDays != null) body.deliveryDays = payload.deliveryDays;
  if (payload.rating != null) body.rating = payload.rating;
  if (payload.notes) body.notes = payload.notes;
  return body;
}

export async function createSupplier(
  payload: SupplierPayload,
): Promise<Supplier> {
  const raw = await apiFetch<unknown>("/suppliers", {
    method: "POST",
    body: cleanSupplierPayload(payload),
  });
  return normalizeSupplier(raw);
}

export async function updateSupplier(
  id: string,
  payload: SupplierPayload,
): Promise<Supplier> {
  const raw = await apiFetch<unknown>(`/suppliers/${id}`, {
    method: "PATCH",
    body: cleanSupplierPayload(payload),
  });
  return normalizeSupplier(raw);
}

export function deleteSupplier(id: string): Promise<void> {
  return apiFetch<void>(`/suppliers/${id}`, { method: "DELETE" });
}

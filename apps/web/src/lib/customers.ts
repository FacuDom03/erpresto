import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { Customer, CustomerStats } from "@/lib/types";

/**
 * Clientes. Contrato: docs/07-contratos-fase2.md (sección Clientes).
 * DELETE → soft (active=false) si tiene pedidos/reservas, hard si no.
 */

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function normalizeStats(raw: unknown): CustomerStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  return {
    ordersCount: toNumber(s.ordersCount),
    totalSpent: toNumber(s.totalSpent),
    lastOrderAt: typeof s.lastOrderAt === "string" ? s.lastOrderAt : null,
  };
}

export function normalizeCustomer(raw: unknown): Customer {
  const c = raw as Record<string, unknown>;
  return {
    id: String(c.id),
    name: typeof c.name === "string" ? c.name : "",
    email: optionalString(c.email),
    phone: optionalString(c.phone),
    taxId: optionalString(c.taxId),
    birthday: optionalString(c.birthday),
    address: optionalString(c.address),
    notes: optionalString(c.notes),
    loyaltyPoints: toNumber(c.loyaltyPoints ?? c.points),
    active: c.active !== false,
    stats: normalizeStats(c.stats),
  };
}

export interface CustomerListParams {
  page: number;
  limit: number;
  search?: string;
}

export interface CustomerListResult {
  data: Customer[];
  total: number;
}

export async function getCustomers(
  params: CustomerListParams,
): Promise<CustomerListResult> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) query.set("search", params.search);

  const raw = await apiFetch<unknown>(`/customers?${query.toString()}`);
  const res = raw as { data?: unknown[]; total?: unknown };
  if (Array.isArray(res?.data)) {
    return {
      data: res.data.map(normalizeCustomer),
      total: typeof res.total === "number" ? res.total : res.data.length,
    };
  }
  const list = Array.isArray(raw) ? (raw as unknown[]) : [];
  return { data: list.map(normalizeCustomer), total: list.length };
}

/** GET /customers/:id — incluye `stats` (pedidos, total gastado, última visita). */
export async function getCustomer(id: string): Promise<Customer> {
  const raw = await apiFetch<unknown>(`/customers/${id}`);
  return normalizeCustomer(raw);
}

export interface CustomerPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  /** ISO date (aaaa-mm-dd). */
  birthday?: string | null;
  address?: string | null;
  notes?: string | null;
}

/** Omite strings vacíos/null para no mandar campos opcionales en blanco. */
function cleanCustomerPayload(payload: CustomerPayload): Record<string, unknown> {
  const body: Record<string, unknown> = { name: payload.name };
  if (payload.email) body.email = payload.email;
  if (payload.phone) body.phone = payload.phone;
  if (payload.taxId) body.taxId = payload.taxId;
  if (payload.birthday) body.birthday = payload.birthday;
  if (payload.address) body.address = payload.address;
  if (payload.notes) body.notes = payload.notes;
  return body;
}

export async function createCustomer(
  payload: CustomerPayload,
): Promise<Customer> {
  const raw = await apiFetch<unknown>("/customers", {
    method: "POST",
    body: cleanCustomerPayload(payload),
  });
  return normalizeCustomer(raw);
}

export async function updateCustomer(
  id: string,
  payload: CustomerPayload,
): Promise<Customer> {
  const raw = await apiFetch<unknown>(`/customers/${id}`, {
    method: "PATCH",
    body: cleanCustomerPayload(payload),
  });
  return normalizeCustomer(raw);
}

export function deleteCustomer(id: string): Promise<void> {
  return apiFetch<void>(`/customers/${id}`, { method: "DELETE" });
}

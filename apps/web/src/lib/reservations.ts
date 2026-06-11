import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { Reservation, ReservationStatus } from "@/lib/types";

/**
 * Reservas. Contrato: docs/07-contratos-fase2.md (sección Reservas).
 * Asignar mesa con `scheduledAt` dentro de las próximas 2 h la bloquea
 * (FREE → RESERVED) del lado del backend.
 */

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  SEATED: "Sentada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No-show",
};

export function normalizeReservation(raw: unknown): Reservation {
  const r = raw as Record<string, unknown>;
  const table = r.table as { id?: unknown; name?: unknown } | null;
  const customer = r.customer as { id?: unknown; name?: unknown } | null;
  return {
    id: String(r.id),
    branchId: typeof r.branchId === "string" ? r.branchId : null,
    name: typeof r.name === "string" ? r.name : "",
    phone: typeof r.phone === "string" && r.phone ? r.phone : null,
    partySize: toNumber(r.partySize),
    scheduledAt: typeof r.scheduledAt === "string" ? r.scheduledAt : "",
    status: (r.status as ReservationStatus) ?? "PENDING",
    tableId: typeof r.tableId === "string" ? r.tableId : null,
    table: table
      ? { id: String(table.id ?? ""), name: String(table.name ?? "") }
      : null,
    customerId: typeof r.customerId === "string" ? r.customerId : null,
    customer: customer
      ? { id: String(customer.id ?? ""), name: String(customer.name ?? "") }
      : null,
    notes: typeof r.notes === "string" && r.notes ? r.notes : null,
  };
}

export interface ReservationListParams {
  branchId: string;
  /** ISO sobre scheduledAt. */
  from?: string;
  to?: string;
  status?: ReservationStatus;
  page?: number;
  limit?: number;
}

export interface ReservationListResult {
  data: Reservation[];
  total: number;
}

export async function getReservations(
  params: ReservationListParams,
): Promise<ReservationListResult> {
  const query = new URLSearchParams({ branchId: params.branchId });
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const raw = await apiFetch<unknown>(`/reservations?${query.toString()}`);
  const res = raw as { data?: unknown[]; total?: unknown };
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  return {
    data: list.map(normalizeReservation),
    total: typeof res?.total === "number" ? res.total : list.length,
  };
}

export interface CreateReservationPayload {
  branchId: string;
  name: string;
  phone?: string;
  partySize: number;
  scheduledAt: string;
  tableId?: string;
  customerId?: string;
  notes?: string;
  status?: ReservationStatus;
}

export async function createReservation(
  payload: CreateReservationPayload,
): Promise<Reservation> {
  const raw = await apiFetch<unknown>("/reservations", {
    method: "POST",
    body: payload,
  });
  return normalizeReservation(raw);
}

export interface UpdateReservationPayload {
  name?: string;
  phone?: string | null;
  partySize?: number;
  scheduledAt?: string;
  tableId?: string | null;
  customerId?: string | null;
  notes?: string | null;
  status?: ReservationStatus;
}

export async function updateReservation(
  id: string,
  payload: UpdateReservationPayload,
): Promise<Reservation> {
  const raw = await apiFetch<unknown>(`/reservations/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeReservation(raw);
}

/** Sienta a la reserva: status → SEATED y la mesa pasa a OCCUPIED. */
export async function seatReservation(
  id: string,
  tableId?: string,
): Promise<Reservation> {
  const raw = await apiFetch<unknown>(`/reservations/${id}/seat`, {
    method: "POST",
    body: tableId ? { tableId } : {},
  });
  return normalizeReservation(raw);
}

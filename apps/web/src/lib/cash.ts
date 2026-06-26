import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type {
  CashMovement,
  CashMovementType,
  CashRegister,
  CashSession,
  PaymentMethod,
} from "@/lib/types";

/**
 * Encapsula los shapes de la API de caja.
 * Contrato: docs/05-contratos-fase1.md.
 */

function normalizeMovement(raw: unknown): CashMovement {
  const m = raw as Record<string, unknown>;
  return {
    id: String(m.id),
    type: (m.type as CashMovementType) ?? "DEPOSIT",
    amount: toNumber(m.amount),
    notes: typeof m.notes === "string" && m.notes ? m.notes : null,
    createdAt: typeof m.createdAt === "string" ? m.createdAt : undefined,
  };
}

function normalizeSalesByMethod(
  raw: unknown,
): Partial<Record<PaymentMethod, number>> | undefined {
  if (!raw) return undefined;
  // Forma objeto: { CASH: 1000, QR: 500, ... }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const out: Partial<Record<PaymentMethod, number>> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      out[key as PaymentMethod] = toNumber(value);
    }
    return out;
  }
  // Forma lista: [{ method, total|amount }]
  if (Array.isArray(raw)) {
    const out: Partial<Record<PaymentMethod, number>> = {};
    for (const entry of raw) {
      const e = entry as { method?: unknown; total?: unknown; amount?: unknown };
      if (typeof e.method === "string") {
        out[e.method as PaymentMethod] = toNumber(e.total ?? e.amount);
      }
    }
    return out;
  }
  return undefined;
}

function normalizeSession(raw: unknown): CashSession {
  const s = raw as Record<string, unknown>;
  return {
    id: String(s.id),
    registerId: String(s.registerId ?? ""),
    status: s.status === "CLOSED" ? "CLOSED" : "OPEN",
    openingAmount: toNumber(s.openingAmount),
    closingAmount: s.closingAmount == null ? null : toNumber(s.closingAmount),
    expectedAmount:
      s.expectedAmount == null ? null : toNumber(s.expectedAmount),
    difference: s.difference == null ? null : toNumber(s.difference),
    openedAt: typeof s.openedAt === "string" ? s.openedAt : undefined,
    closedAt: typeof s.closedAt === "string" ? s.closedAt : null,
    salesByMethod: normalizeSalesByMethod(s.salesByMethod ?? s.sales),
    movements: Array.isArray(s.movements)
      ? s.movements.map(normalizeMovement)
      : undefined,
  };
}

function normalizeRegister(raw: unknown): CashRegister {
  const r = raw as Record<string, unknown>;
  const session = r.currentSession;
  return {
    id: String(r.id),
    branchId: String(r.branchId ?? ""),
    name: typeof r.name === "string" ? r.name : "Caja",
    currentSession: session ? normalizeSession(session) : null,
  };
}

export async function getCashRegisters(
  branchId: string,
): Promise<CashRegister[]> {
  const raw = await apiFetch<unknown>(
    `/cash/registers?branchId=${encodeURIComponent(branchId)}`,
  );
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown[] })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
  return list.map(normalizeRegister);
}

export async function openCashSession(payload: {
  registerId: string;
  openingAmount: number;
}): Promise<CashSession> {
  const raw = await apiFetch<unknown>("/cash/sessions/open", {
    method: "POST",
    body: payload,
  });
  return normalizeSession(raw);
}

export async function getCashSession(id: string): Promise<CashSession> {
  const raw = await apiFetch<unknown>(`/cash/sessions/${id}`);
  return normalizeSession(raw);
}

export function addCashMovement(
  sessionId: string,
  payload: { type: CashMovementType; amount: number; notes?: string },
): Promise<unknown> {
  return apiFetch<unknown>(`/cash/sessions/${sessionId}/movements`, {
    method: "POST",
    body: payload,
  });
}

export async function closeCashSession(
  sessionId: string,
  closingAmount: number,
): Promise<CashSession> {
  const raw = await apiFetch<unknown>(`/cash/sessions/${sessionId}/close`, {
    method: "POST",
    body: { closingAmount },
  });
  return normalizeSession(raw);
}

export interface CashSessionListResult {
  data: CashSession[];
  total: number;
}

export async function getCashSessions(params: {
  registerId: string;
  page?: number;
  limit?: number;
}): Promise<CashSessionListResult> {
  const query = new URLSearchParams({ registerId: params.registerId });
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const raw = await apiFetch<unknown>(`/cash/sessions?${query.toString()}`);
  const res = raw as { data?: unknown[]; total?: unknown };
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  return {
    data: list.map(normalizeSession),
    total: typeof res?.total === "number" ? res.total : list.length,
  };
}

export const MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  WITHDRAWAL: "Retiro",
  DEPOSIT: "Depósito",
  EXPENSE: "Gasto",
  TIP: "Propina",
};

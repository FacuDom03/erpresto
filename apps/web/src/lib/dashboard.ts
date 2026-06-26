import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { DashboardSummary, MeasureUnit, PaymentMethod } from "@/lib/types";

/**
 * Resumen del dashboard. Contrato: docs/07-contratos-fase2.md (sección Dashboard).
 * Sin `branchId` el backend consolida todas las sucursales del tenant.
 */

function normalizeSummary(raw: unknown): DashboardSummary {
  const s = raw as Record<string, unknown>;

  const salesToday = (s.salesToday ?? {}) as Record<string, unknown>;
  const tables = (s.tables ?? {}) as Record<string, unknown>;
  const cash = s.cash as Record<string, unknown> | null | undefined;
  const criticalRaw = (s.criticalRawMaterials ?? {}) as Record<string, unknown>;
  const criticalProd = (s.criticalProducts ?? {}) as Record<string, unknown>;

  return {
    salesToday: {
      total: toNumber(salesToday.total),
      count: toNumber(salesToday.count),
      avgTicket: toNumber(salesToday.avgTicket),
    },
    salesByMethod: Array.isArray(s.salesByMethod)
      ? s.salesByMethod.map((entry) => {
          const e = entry as Record<string, unknown>;
          return {
            method: (e.method as PaymentMethod) ?? "CASH",
            total: toNumber(e.total),
          };
        })
      : [],
    weekSales: Array.isArray(s.weekSales)
      ? s.weekSales.map((entry) => {
          const e = entry as Record<string, unknown>;
          return {
            date: typeof e.date === "string" ? e.date : "",
            total: toNumber(e.total),
          };
        })
      : [],
    topProducts: Array.isArray(s.topProducts)
      ? s.topProducts.map((entry) => {
          const e = entry as Record<string, unknown>;
          return {
            name: typeof e.name === "string" ? e.name : "",
            quantity: toNumber(e.quantity),
            total: toNumber(e.total),
          };
        })
      : [],
    openOrders: toNumber(s.openOrders),
    tables: {
      occupied: toNumber(tables.occupied),
      total: toNumber(tables.total),
    },
    cash:
      cash == null
        ? null
        : {
            open: cash.open === true,
            expectedAmount: toNumber(cash.expectedAmount),
          },
    criticalRawMaterials: {
      count: toNumber(criticalRaw.count),
      items: Array.isArray(criticalRaw.items)
        ? criticalRaw.items.map((entry) => {
            const e = entry as Record<string, unknown>;
            return {
              name: typeof e.name === "string" ? e.name : "",
              totalStock: toNumber(e.totalStock),
              minStock: toNumber(e.minStock),
              unit: (e.unit as MeasureUnit) ?? "UNIT",
            };
          })
        : [],
    },
    criticalProducts: {
      count: toNumber(criticalProd.count),
      items: Array.isArray(criticalProd.items)
        ? criticalProd.items.map((entry) => {
            const e = entry as Record<string, unknown>;
            return {
              name: typeof e.name === "string" ? e.name : "",
              quantity: toNumber(e.quantity),
              minStock: toNumber(e.minStock),
            };
          })
        : [],
    },
    upcomingReservations: toNumber(s.upcomingReservations),
  };
}

/**
 * GET /dashboard/summary. `branchId === null` → consolidado de todas las
 * sucursales (se omite el parámetro).
 */
export async function getDashboardSummary(
  branchId: string | null,
): Promise<DashboardSummary> {
  const query = branchId
    ? `?branchId=${encodeURIComponent(branchId)}`
    : "";
  const raw = await apiFetch<unknown>(`/dashboard/summary${query}`);
  return normalizeSummary(raw);
}

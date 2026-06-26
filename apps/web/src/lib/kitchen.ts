import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { KitchenItem, OrderItemStatus, OrderType } from "@/lib/types";

/**
 * Encapsula los shapes de la API de cocina (KDS).
 * Contrato: docs/05-contratos-fase1.md.
 */

function normalizeKitchenItem(raw: unknown): KitchenItem {
  const i = raw as Record<string, unknown>;
  const product = i.product as { name?: unknown } | null;
  const order = i.order as
    | {
        id?: unknown;
        number?: unknown;
        type?: unknown;
        table?: { name?: unknown } | null;
      }
    | null;
  return {
    id: String(i.id),
    status: (i.status as OrderItemStatus) ?? "SENT",
    quantity: toNumber(i.quantity),
    notes: typeof i.notes === "string" && i.notes ? i.notes : null,
    product: { name: String(product?.name ?? "Producto") },
    station: typeof i.station === "string" && i.station ? i.station : null,
    course: i.course == null ? undefined : toNumber(i.course),
    requiresPrep:
      typeof i.requiresPrep === "boolean" ? i.requiresPrep : undefined,
    sentAt:
      typeof i.firedAt === "string"
        ? i.firedAt
        : typeof i.sentAt === "string"
          ? i.sentAt
          : new Date().toISOString(),
    order: {
      id: String(order?.id ?? ""),
      number: order?.number == null ? undefined : toNumber(order.number),
      type: (order?.type as OrderType) ?? "DINE_IN",
      table: order?.table ? { name: String(order.table.name ?? "") } : null,
    },
  };
}

export async function getKitchenItems(params: {
  branchId: string;
  station?: string;
}): Promise<KitchenItem[]> {
  const query = new URLSearchParams({
    branchId: params.branchId,
    statuses: "SENT,PREPARING,READY",
  });
  if (params.station) query.set("station", params.station);

  const raw = await apiFetch<unknown>(`/kitchen/items?${query.toString()}`);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown[] })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
  return list.map(normalizeKitchenItem);
}

export function updateKitchenItemStatus(
  itemId: string,
  status: OrderItemStatus,
): Promise<unknown> {
  return apiFetch<unknown>(`/kitchen/items/${itemId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

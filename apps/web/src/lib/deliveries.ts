import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type { Delivery, DeliveryStatus } from "@/lib/types";

/**
 * Tablero de delivery. Contrato: docs/08-contratos-fase3.md.
 * `:id` de un delivery = `order.id` (relación 1-1).
 */

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Pendiente",
  ASSIGNED: "Asignado",
  IN_TRANSIT: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

/** Columnas del tablero (sin CANCELLED, que se trata aparte). */
export const DELIVERY_BOARD_STATUSES: DeliveryStatus[] = [
  "PENDING",
  "ASSIGNED",
  "IN_TRANSIT",
  "DELIVERED",
];

/** Próximo estado en el flujo PENDING→ASSIGNED→IN_TRANSIT→DELIVERED. */
export function nextDeliveryStatus(
  status: DeliveryStatus,
): DeliveryStatus | null {
  switch (status) {
    case "ASSIGNED":
      return "IN_TRANSIT";
    case "IN_TRANSIT":
      return "DELIVERED";
    default:
      return null;
  }
}

export function normalizeDelivery(raw: unknown): Delivery {
  const o = raw as Record<string, unknown>;
  const order = o.order as
    | { id?: unknown; number?: unknown; total?: unknown }
    | null
    | undefined;
  const delivery = (o.delivery as Record<string, unknown> | null) ?? o;
  const customer = o.customer as
    | { name?: unknown; phone?: unknown }
    | null
    | undefined;
  const courier = o.courier as { id?: unknown; name?: unknown } | null;

  const orderId =
    order?.id != null
      ? String(order.id)
      : typeof o.orderId === "string"
        ? o.orderId
        : String(o.id);

  return {
    id: String(o.id ?? orderId),
    orderId,
    orderNumber:
      order?.number != null
        ? toNumber(order.number)
        : o.orderNumber == null
          ? null
          : toNumber(o.orderNumber),
    status: (o.status as DeliveryStatus) ?? "PENDING",
    address:
      typeof delivery.address === "string" ? delivery.address : null,
    notes: typeof delivery.notes === "string" ? delivery.notes : null,
    estimatedAt:
      typeof delivery.estimatedAt === "string" ? delivery.estimatedAt : null,
    deliveredAt:
      typeof delivery.deliveredAt === "string" ? delivery.deliveredAt : null,
    total:
      order?.total != null ? toNumber(order.total) : toNumber(o.total),
    customerName:
      customer?.name != null
        ? String(customer.name)
        : typeof o.customerName === "string"
          ? o.customerName
          : null,
    customerPhone:
      customer?.phone != null
        ? String(customer.phone)
        : typeof o.customerPhone === "string"
          ? o.customerPhone
          : null,
    courier: courier
      ? { id: String(courier.id ?? ""), name: String(courier.name ?? "") }
      : null,
  };
}

export interface DeliveryListParams {
  branchId: string;
  status?: DeliveryStatus;
}

export async function getDeliveries(
  params: DeliveryListParams,
): Promise<Delivery[]> {
  const query = new URLSearchParams({ branchId: params.branchId });
  if (params.status) query.set("status", params.status);
  const raw = await apiFetch<unknown>(`/deliveries?${query.toString()}`);
  const res = raw as { data?: unknown[] };
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  return list.map(normalizeDelivery);
}

export interface Courier {
  id: string;
  name: string;
}

export async function getCouriers(branchId: string): Promise<Courier[]> {
  const query = new URLSearchParams({ role: "courier", branchId });
  const raw = await apiFetch<unknown>(`/users?${query.toString()}`);
  const res = raw as { data?: unknown[] };
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  return list.map((u) => {
    const user = u as Record<string, unknown>;
    const fullName = [user.firstName, user.lastName]
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .join(" ")
      .trim();
    return {
      id: String(user.id ?? ""),
      name:
        fullName ||
        (typeof user.name === "string" && user.name
          ? user.name
          : typeof user.email === "string"
            ? user.email
            : "Repartidor"),
    };
  });
}

export function assignCourier(
  deliveryId: string,
  courierId: string,
): Promise<unknown> {
  return apiFetch<unknown>(`/deliveries/${deliveryId}/assign`, {
    method: "POST",
    body: { courierId },
  });
}

export function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
): Promise<unknown> {
  return apiFetch<unknown>(`/deliveries/${deliveryId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

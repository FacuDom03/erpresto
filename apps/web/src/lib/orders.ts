import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type {
  Order,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  Payment,
  PaymentMethod,
} from "@/lib/types";

/**
 * Encapsula los shapes de la API de pedidos (POS).
 * Contrato: docs/05-contratos-fase1.md.
 */

function normalizeItem(raw: unknown): OrderItem {
  const i = raw as Record<string, unknown>;
  const product = i.product as { id?: unknown; name?: unknown } | null;
  return {
    id: String(i.id),
    productId: String(i.productId ?? product?.id ?? ""),
    product: product
      ? { id: String(product.id ?? ""), name: String(product.name ?? "") }
      : null,
    quantity: toNumber(i.quantity),
    unitPrice: toNumber(i.unitPrice),
    notes: typeof i.notes === "string" && i.notes ? i.notes : null,
    status: (i.status as OrderItemStatus) ?? "PENDING",
    station: typeof i.station === "string" ? i.station : null,
    sentAt: typeof i.sentAt === "string" ? i.sentAt : null,
  };
}

function normalizePayment(raw: unknown): Payment {
  const p = raw as Record<string, unknown>;
  return {
    id: String(p.id),
    method: (p.method as PaymentMethod) ?? "CASH",
    amount: toNumber(p.amount),
    reference: typeof p.reference === "string" ? p.reference : null,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : undefined,
  };
}

export function normalizeOrder(raw: unknown): Order {
  const o = raw as Record<string, unknown>;
  const table = o.table as { id?: unknown; name?: unknown } | null;
  const waiter = o.waiter as { id?: unknown; name?: unknown } | null;
  return {
    id: String(o.id),
    number: o.number == null ? undefined : toNumber(o.number),
    type: (o.type as OrderType) ?? "DINE_IN",
    status: (o.status as OrderStatus) ?? "OPEN",
    tableId: typeof o.tableId === "string" ? o.tableId : null,
    table: table
      ? { id: String(table.id ?? ""), name: String(table.name ?? "") }
      : null,
    waiterId: typeof o.waiterId === "string" ? o.waiterId : null,
    waiter: waiter
      ? {
          id: String(waiter.id ?? ""),
          name: typeof waiter.name === "string" ? waiter.name : null,
        }
      : null,
    peopleCount: o.peopleCount == null ? null : toNumber(o.peopleCount),
    subtotal: toNumber(o.subtotal),
    discount: toNumber(o.discount),
    tip: toNumber(o.tip),
    total: toNumber(o.total),
    notes: typeof o.notes === "string" ? o.notes : null,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
    closedAt: typeof o.closedAt === "string" ? o.closedAt : null,
    items: Array.isArray(o.items) ? o.items.map(normalizeItem) : [],
    payments: Array.isArray(o.payments) ? o.payments.map(normalizePayment) : [],
  };
}

export interface OrderListParams {
  branchId: string;
  status?: OrderStatus;
  type?: OrderType;
  tableId?: string;
  page?: number;
  limit?: number;
}

export interface OrderListResult {
  data: Order[];
  total: number;
}

export async function getOrders(
  params: OrderListParams,
): Promise<OrderListResult> {
  const query = new URLSearchParams({ branchId: params.branchId });
  if (params.status) query.set("status", params.status);
  if (params.type) query.set("type", params.type);
  if (params.tableId) query.set("tableId", params.tableId);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const raw = await apiFetch<unknown>(`/orders?${query.toString()}`);
  const res = raw as { data?: unknown[]; total?: unknown };
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  return {
    data: list.map(normalizeOrder),
    total:
      typeof res?.total === "number" ? res.total : list.length,
  };
}

export async function getOrder(id: string): Promise<Order> {
  const raw = await apiFetch<unknown>(`/orders/${id}`);
  return normalizeOrder(raw);
}

export interface CreateOrderPayload {
  branchId: string;
  type: OrderType;
  tableId?: string;
  peopleCount?: number;
  customerId?: string;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const raw = await apiFetch<unknown>("/orders", {
    method: "POST",
    body: payload,
  });
  return normalizeOrder(raw);
}

export interface UpdateOrderPayload {
  discount?: number;
  tip?: number;
  notes?: string;
  peopleCount?: number;
  tableId?: string;
  waiterId?: string;
}

export async function updateOrder(
  id: string,
  payload: UpdateOrderPayload,
): Promise<Order> {
  const raw = await apiFetch<unknown>(`/orders/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeOrder(raw);
}

export function addOrderItems(
  orderId: string,
  items: { productId: string; quantity: number; notes?: string }[],
): Promise<unknown> {
  return apiFetch<unknown>(`/orders/${orderId}/items`, {
    method: "POST",
    body: { items },
  });
}

export function updateOrderItem(
  orderId: string,
  itemId: string,
  payload: { quantity?: number; notes?: string; status?: "CANCELLED" },
): Promise<unknown> {
  return apiFetch<unknown>(`/orders/${orderId}/items/${itemId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteOrderItem(
  orderId: string,
  itemId: string,
): Promise<void> {
  return apiFetch<void>(`/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export function sendOrderToKitchen(orderId: string): Promise<unknown> {
  return apiFetch<unknown>(`/orders/${orderId}/send`, { method: "POST" });
}

export function addOrderPayment(
  orderId: string,
  payload: { method: PaymentMethod; amount: number; reference?: string },
): Promise<unknown> {
  return apiFetch<unknown>(`/orders/${orderId}/payments`, {
    method: "POST",
    body: payload,
  });
}

export function deleteOrderPayment(
  orderId: string,
  paymentId: string,
): Promise<void> {
  return apiFetch<void>(`/orders/${orderId}/payments/${paymentId}`, {
    method: "DELETE",
  });
}

export function closeOrder(orderId: string): Promise<unknown> {
  return apiFetch<unknown>(`/orders/${orderId}/close`, { method: "POST" });
}

export function cancelOrder(orderId: string): Promise<unknown> {
  return apiFetch<unknown>(`/orders/${orderId}/cancel`, { method: "POST" });
}

/**
 * Extrae el orderId existente de un error 409 al crear un pedido sobre una
 * mesa ocupada. El contrato lo devuelve en `error.orderId`; contemplamos
 * también `orderId` en la raíz por robustez.
 */
export function extractConflictOrderId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const body = data as { orderId?: unknown; error?: unknown };
  if (typeof body.orderId === "string") return body.orderId;
  if (body.error && typeof body.error === "object") {
    const inner = body.error as { orderId?: unknown };
    if (typeof inner.orderId === "string") return inner.orderId;
  }
  return null;
}

// Etiquetas en español (compartidas por POS, pedidos y mesas)
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  DINE_IN: "Salón",
  TAKEAWAY: "Take away",
  DELIVERY: "Delivery",
  COUNTER: "Mostrador",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

export const ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  PREPARING: "Preparando",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD_DEBIT: "Tarjeta débito",
  CARD_CREDIT: "Tarjeta crédito",
  QR: "QR",
  MERCADOPAGO: "Mercado Pago",
  TRANSFER: "Transferencia",
};

import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type {
  MeasureUnit,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
} from "@/lib/types";

/**
 * Órdenes de compra y recepción de mercadería.
 * Contrato: docs/07-contratos-fase2.md (sección Compras).
 * Los Decimal de Prisma pueden llegar serializados como string → toNumber.
 */

export const PURCHASE_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  PARTIALLY_RECEIVED: "Recepción parcial",
  RECEIVED: "Recibida",
  CANCELLED: "Anulada",
};

function normalizeItem(raw: unknown): PurchaseOrderItem {
  const i = raw as Record<string, unknown>;
  const rawMaterial = i.rawMaterial as
    | { id?: unknown; name?: unknown; unit?: unknown }
    | null
    | undefined;
  const quantity = toNumber(i.quantity);
  const unitCost = toNumber(i.unitCost);
  return {
    id: String(i.id),
    rawMaterialId: String(i.rawMaterialId ?? rawMaterial?.id ?? ""),
    rawMaterial: rawMaterial
      ? {
          id: String(rawMaterial.id ?? ""),
          name: String(rawMaterial.name ?? ""),
          unit: (rawMaterial.unit as MeasureUnit) ?? "UNIT",
        }
      : null,
    quantity,
    receivedQty: toNumber(i.receivedQty),
    unitCost,
    subtotal: i.subtotal == null ? quantity * unitCost : toNumber(i.subtotal),
  };
}

export function normalizePurchaseOrder(raw: unknown): PurchaseOrder {
  const o = raw as Record<string, unknown>;
  const supplier = o.supplier as { id?: unknown; name?: unknown } | null;
  const branch = o.branch as { id?: unknown; name?: unknown } | null;
  return {
    id: String(o.id),
    number: o.number == null ? undefined : toNumber(o.number),
    status: (o.status as PurchaseOrderStatus) ?? "DRAFT",
    branchId: typeof o.branchId === "string" ? o.branchId : null,
    branch: branch
      ? { id: String(branch.id ?? ""), name: String(branch.name ?? "") }
      : null,
    supplierId: typeof o.supplierId === "string" ? o.supplierId : null,
    supplier: supplier
      ? { id: String(supplier.id ?? ""), name: String(supplier.name ?? "") }
      : null,
    expectedAt: typeof o.expectedAt === "string" ? o.expectedAt : null,
    notes: typeof o.notes === "string" && o.notes ? o.notes : null,
    total: toNumber(o.total),
    itemsCount:
      o.itemsCount == null
        ? Array.isArray(o.items)
          ? o.items.length
          : undefined
        : toNumber(o.itemsCount),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
    items: Array.isArray(o.items) ? o.items.map(normalizeItem) : [],
  };
}

export interface PurchaseOrderListParams {
  branchId: string;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface PurchaseOrderListResult {
  data: PurchaseOrder[];
  total: number;
}

export async function getPurchaseOrders(
  params: PurchaseOrderListParams,
): Promise<PurchaseOrderListResult> {
  const query = new URLSearchParams({
    branchId: params.branchId,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) query.set("status", params.status);
  if (params.supplierId) query.set("supplierId", params.supplierId);
  if (params.search) query.set("search", params.search);

  const raw = await apiFetch<unknown>(`/purchase-orders?${query.toString()}`);
  const res = raw as { data?: unknown[]; total?: unknown };
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  return {
    data: list.map(normalizePurchaseOrder),
    total: typeof res?.total === "number" ? res.total : list.length,
  };
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(`/purchase-orders/${id}`);
  return normalizePurchaseOrder(raw);
}

export interface PurchaseOrderItemPayload {
  rawMaterialId: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchaseOrderPayload {
  branchId: string;
  supplierId: string;
  expectedAt?: string;
  notes?: string;
  items: PurchaseOrderItemPayload[];
}

export async function createPurchaseOrder(
  payload: CreatePurchaseOrderPayload,
): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>("/purchase-orders", {
    method: "POST",
    body: payload,
  });
  return normalizePurchaseOrder(raw);
}

export interface UpdatePurchaseOrderPayload {
  supplierId?: string;
  expectedAt?: string | null;
  notes?: string | null;
  /** Reemplaza TODAS las líneas de la orden (solo en borrador). */
  items?: PurchaseOrderItemPayload[];
}

export async function updatePurchaseOrder(
  id: string,
  payload: UpdatePurchaseOrderPayload,
): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(`/purchase-orders/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizePurchaseOrder(raw);
}

export async function sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(`/purchase-orders/${id}/send`, {
    method: "POST",
  });
  return normalizePurchaseOrder(raw);
}

export interface ReceiveItemPayload {
  itemId: string;
  quantity: number;
  unitCost?: number;
  lotCode?: string;
  expiresAt?: string;
}

export interface ReceivePurchaseOrderPayload {
  warehouseId: string;
  items: ReceiveItemPayload[];
}

export async function receivePurchaseOrder(
  id: string,
  payload: ReceivePurchaseOrderPayload,
): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(`/purchase-orders/${id}/receive`, {
    method: "POST",
    body: payload,
  });
  return normalizePurchaseOrder(raw);
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(`/purchase-orders/${id}/cancel`, {
    method: "POST",
  });
  return normalizePurchaseOrder(raw);
}

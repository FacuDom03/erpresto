import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type {
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  InvoiceType,
} from "@/lib/types";

/**
 * Facturación electrónica (ARCA/AFIP). Contrato: docs/08-contratos-fase3.md.
 * Los Decimal de Prisma pueden llegar serializados como string → toNumber.
 */

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
  NOTA_CREDITO_A: "Nota de crédito A",
  NOTA_CREDITO_B: "Nota de crédito B",
  NOTA_CREDITO_C: "Nota de crédito C",
};

/** Etiqueta corta para badges/celdas (Factura A, NC A, …). */
export const INVOICE_TYPE_SHORT: Record<InvoiceType, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
  NOTA_CREDITO_A: "NC A",
  NOTA_CREDITO_B: "NC B",
  NOTA_CREDITO_C: "NC C",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Borrador",
  PENDING_CAE: "Pendiente CAE",
  ISSUED: "Emitida",
  REJECTED: "Rechazada",
  CANCELLED: "Anulada",
};

export const INVOICE_TYPES = Object.keys(INVOICE_TYPE_LABELS) as InvoiceType[];
export const INVOICE_STATUSES = Object.keys(
  INVOICE_STATUS_LABELS,
) as InvoiceStatus[];

export function isCreditNote(type: InvoiceType): boolean {
  return type.startsWith("NOTA_CREDITO");
}

/** Formatea el número de comprobante como 0001-00000123. */
export function formatInvoiceNumber(
  pointOfSale: number,
  number: number,
): string {
  const pos = String(Math.trunc(pointOfSale)).padStart(4, "0");
  const num = String(Math.trunc(number)).padStart(8, "0");
  return `${pos}-${num}`;
}

function normalizeLine(raw: unknown, index: number): InvoiceLine {
  const l = raw as Record<string, unknown>;
  const quantity = toNumber(l.quantity);
  // El backend guarda el precio con IVA incluido como `unitPriceWithTax`
  // (criterio AR); contemplamos también `unitPrice` por robustez.
  const unitPrice =
    l.unitPriceWithTax != null
      ? toNumber(l.unitPriceWithTax)
      : toNumber(l.unitPrice);
  return {
    // Las líneas son JSON (sin id propio): usamos el índice como key estable.
    id: l.id != null ? String(l.id) : `line-${index}`,
    description:
      typeof l.description === "string" ? l.description : String(l.name ?? ""),
    quantity,
    unitPrice,
    taxRate: toNumber(l.taxRate),
    netAmount: toNumber(l.netAmount),
    taxAmount: toNumber(l.taxAmount),
    totalAmount:
      l.totalAmount == null ? quantity * unitPrice : toNumber(l.totalAmount),
  };
}

/**
 * Detecta si el comprobante fue emitido por el proveedor mock. El backend lo
 * puede exponer como flag explícito (`isMock`/`mock`/`simulated`) o dejar
 * rastro en `arcaPayload`; si no hay señal, asumimos no-mock (no inventamos).
 */
function detectMock(o: Record<string, unknown>): boolean {
  if (typeof o.isMock === "boolean") return o.isMock;
  if (typeof o.mock === "boolean") return o.mock;
  if (typeof o.simulated === "boolean") return o.simulated;
  const payload = o.arcaPayload as Record<string, unknown> | null | undefined;
  if (payload && typeof payload === "object") {
    if (payload.mock === true || payload.simulated === true) return true;
    if (typeof payload.provider === "string") {
      return payload.provider.toLowerCase().includes("mock");
    }
  }
  return false;
}

export function normalizeInvoice(raw: unknown): Invoice {
  const o = raw as Record<string, unknown>;
  const customer = o.customer as
    | { name?: unknown; taxId?: unknown; ivaCondition?: unknown }
    | null
    | undefined;
  const order = o.order as { id?: unknown; number?: unknown } | null | undefined;
  const pointOfSale = toNumber(o.pointOfSale);
  const number = toNumber(o.number);
  // Las líneas pueden venir como `lines`/`items` o, en este backend, dentro de
  // `arcaPayload.lines` (el comprobante no tiene relación de líneas propia).
  const arcaPayload = o.arcaPayload as
    | { lines?: unknown[] }
    | null
    | undefined;
  const lines = Array.isArray(o.lines)
    ? o.lines
    : Array.isArray(o.items)
      ? (o.items as unknown[])
      : Array.isArray(arcaPayload?.lines)
        ? (arcaPayload.lines as unknown[])
        : [];

  const customerName =
    customer?.name != null
      ? String(customer.name)
      : typeof o.customerName === "string"
        ? o.customerName
        : null;
  const customerTaxId =
    customer?.taxId != null
      ? String(customer.taxId)
      : typeof o.customerTaxId === "string"
        ? o.customerTaxId
        : null;

  return {
    id: String(o.id),
    type: (o.type as InvoiceType) ?? "FACTURA_B",
    status: (o.status as InvoiceStatus) ?? "DRAFT",
    pointOfSale,
    number,
    formattedNumber: formatInvoiceNumber(pointOfSale, number),
    customerName,
    customerTaxId,
    customerIvaCondition:
      customer?.ivaCondition != null ? String(customer.ivaCondition) : null,
    orderId:
      order?.id != null
        ? String(order.id)
        : typeof o.orderId === "string"
          ? o.orderId
          : null,
    orderNumber:
      order?.number != null
        ? toNumber(order.number)
        : o.orderNumber == null
          ? null
          : toNumber(o.orderNumber),
    netAmount: toNumber(o.netAmount),
    taxAmount: toNumber(o.taxAmount),
    totalAmount: toNumber(o.totalAmount),
    cae: typeof o.cae === "string" && o.cae ? o.cae : null,
    caeExpiry: typeof o.caeExpiry === "string" ? o.caeExpiry : null,
    originInvoiceId:
      typeof o.originInvoiceId === "string" ? o.originInvoiceId : null,
    isMock: detectMock(o),
    issuedAt: typeof o.issuedAt === "string" ? o.issuedAt : null,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
    lines: lines.map(normalizeLine),
  };
}



export interface InvoiceListParams {
  branchId?: string;
  type?: InvoiceType;
  status?: InvoiceStatus;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceListResult {
  data: Invoice[];
  total: number;
}

export async function getInvoices(
  params: InvoiceListParams,
): Promise<InvoiceListResult> {
  const query = new URLSearchParams();
  if (params.branchId) query.set("branchId", params.branchId);
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const raw = await apiFetch<unknown>(`/invoices?${query.toString()}`);
  const res = raw as { data?: unknown[]; total?: unknown };
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  return {
    data: list.map(normalizeInvoice),
    total: typeof res?.total === "number" ? res.total : list.length,
  };
}

export async function getInvoice(id: string): Promise<Invoice> {
  const raw = await apiFetch<unknown>(`/invoices/${id}`);
  return normalizeInvoice(raw);
}

export async function createInvoiceFromOrder(
  orderId: string,
  body?: { customerId?: string; type?: InvoiceType },
): Promise<Invoice> {
  const raw = await apiFetch<unknown>(`/invoices/from-order/${orderId}`, {
    method: "POST",
    body: body ?? {},
  });
  return normalizeInvoice(raw);
}

export async function createCreditNote(
  invoiceId: string,
  body?: { items?: { lineId: string; quantity: number }[] },
): Promise<Invoice> {
  const raw = await apiFetch<unknown>(`/invoices/${invoiceId}/credit-note`, {
    method: "POST",
    body: body ?? {},
  });
  return normalizeInvoice(raw);
}

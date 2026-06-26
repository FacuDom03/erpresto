import { API_URL, ApiError, getAccessToken, NETWORK_ERROR_MESSAGE } from "@/lib/api";
import { formatARS, formatDate, formatQuantity, toNumber } from "@/lib/utils";
import type {
  ReportColumn,
  ReportColumnType,
  ReportData,
  ReportKey,
} from "@/lib/types";

/**
 * Reportes exportables. Contrato: docs/08-contratos-fase3.md (sección 4).
 * Sin `format` → JSON genérico {columns, rows, totals}; con format → blob.
 */

export const REPORT_LABELS: Record<ReportKey, string> = {
  sales: "Ventas",
  products: "Productos",
  waiters: "Mozos",
  cash: "Caja",
  stock: "Stock",
  purchases: "Compras",
};

export const REPORT_KEYS = Object.keys(REPORT_LABELS) as ReportKey[];

/** groupBy disponibles por reporte (vacío = no aplica). */
export const REPORT_GROUP_BY: Partial<
  Record<ReportKey, { value: string; label: string }[]>
> = {
  sales: [
    { value: "day", label: "Por día" },
    { value: "method", label: "Por método" },
    { value: "type", label: "Por tipo" },
  ],
};

export type ReportFormat = "csv" | "xlsx" | "pdf";

const FORMAT_EXT: Record<ReportFormat, string> = {
  csv: "csv",
  xlsx: "xlsx",
  pdf: "pdf",
};

export interface ReportParams {
  branchId?: string;
  from?: string;
  to?: string;
  groupBy?: string;
}

function buildQuery(params: ReportParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params.branchId) query.set("branchId", params.branchId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.groupBy) query.set("groupBy", params.groupBy);
  return query;
}

function normalizeReport(raw: unknown): ReportData {
  const o = raw as Record<string, unknown>;
  const columns = Array.isArray(o.columns)
    ? (o.columns as unknown[]).map((c): ReportColumn => {
        const col = c as Record<string, unknown>;
        return {
          key: String(col.key ?? ""),
          label: String(col.label ?? col.key ?? ""),
          type: (col.type as ReportColumnType) ?? "string",
        };
      })
    : [];
  const rows = Array.isArray(o.rows)
    ? (o.rows as Record<string, unknown>[])
    : [];
  const totals =
    o.totals && typeof o.totals === "object"
      ? (o.totals as Record<string, unknown>)
      : null;
  return { columns, rows, totals };
}

export async function getReport(
  key: ReportKey,
  params: ReportParams,
): Promise<ReportData> {
  const query = buildQuery(params);
  // Reusa apiFetch indirectamente importando dinámicamente sería innecesario:
  // el endpoint devuelve JSON, así que usamos un fetch autenticado simple.
  const res = await authedFetch(`/reports/${key}?${query.toString()}`);
  if (!res.ok) {
    throw new ApiError(res.status, `No se pudo cargar el reporte (${res.status})`);
  }
  const raw = (await res.json()) as unknown;
  return normalizeReport(raw);
}

/**
 * Formatea un valor de celda según el `type` de la columna. Acepta valores
 * que la API puede devolver como string (Decimal) o number.
 */
export function formatReportValue(
  value: unknown,
  type: ReportColumnType,
): string {
  if (value == null || value === "") return "—";
  switch (type) {
    case "currency":
    case "money":
      return formatARS(toNumber(value));
    case "number":
      return formatQuantity(toNumber(value));
    case "date":
      return formatDate(String(value));
    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Descarga de archivos (CSV / Excel / PDF) con el token de la sesión.
// ---------------------------------------------------------------------------

/**
 * fetch autenticado que reusa el accessToken de localStorage (mismo header que
 * arma el api client). Para blobs no podemos usar apiFetch porque parsea JSON.
 */
async function authedFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    return await fetch(`${API_URL}${path}`, { headers });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Liberar el object URL en el próximo tick.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Descarga un reporte como archivo. Hace un fetch autenticado, lee el blob y
 * dispara la descarga con nombre `reporte-{key}-{from}-{to}.{ext}`.
 */
export async function downloadReport(
  key: ReportKey,
  params: ReportParams,
  format: ReportFormat,
): Promise<void> {
  const query = buildQuery(params);
  query.set("format", format);

  const res = await authedFetch(`/reports/${key}?${query.toString()}`);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `No se pudo exportar el reporte (${res.status})`,
    );
  }
  const blob = await res.blob();
  const from = params.from ?? "inicio";
  const to = params.to ?? "hoy";
  const filename = `reporte-${key}-${from}-${to}.${FORMAT_EXT[format]}`;
  triggerDownload(blob, filename);
}

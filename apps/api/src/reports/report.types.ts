export type ColumnType = 'string' | 'number' | 'currency' | 'date';

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export interface ReportData {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totals: Record<string, unknown>;
  /** Metadatos para los exportadores (encabezado PDF, nombre de archivo). */
  meta: {
    title: string;
    tenantName: string;
    from: string | null;
    to: string | null;
  };
}

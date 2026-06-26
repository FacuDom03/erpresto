"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  ServerOff,
  Table as TableIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError, getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import {
  downloadReport,
  formatReportValue,
  getReport,
  REPORT_GROUP_BY,
  REPORT_KEYS,
  REPORT_LABELS,
  type ReportFormat,
  type ReportParams,
} from "@/lib/reports";
import type { ReportData, ReportKey } from "@/lib/types";
import { cn, toDateInput } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Preset = "today" | "week" | "month" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  custom: "Personalizado",
};

/** Calcula {from, to} para un preset (fechas locales YYYY-MM-DD). */
function presetRange(preset: Exclude<Preset, "custom">): {
  from: string;
  to: string;
} {
  const now = new Date();
  const to = toDateInput(now);
  if (preset === "today") {
    return { from: to, to };
  }
  if (preset === "week") {
    const day = now.getDay(); // 0 = domingo
    const diff = day === 0 ? 6 : day - 1; // semana arranca el lunes
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return { from: toDateInput(monday), to };
  }
  // month
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateInput(first), to };
}

export default function ReportesPage() {
  const { branchId } = useBranch();

  const [activeKey, setActiveKey] = useState<ReportKey>("sales");
  const [preset, setPreset] = useState<Preset>("month");
  const initial = presetRange("month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [groupBy, setGroupBy] = useState("day");
  const [downloading, setDownloading] = useState<ReportFormat | null>(null);

  const groupByOptions = REPORT_GROUP_BY[activeKey];

  const applyPreset = (next: Preset) => {
    setPreset(next);
    if (next !== "custom") {
      const range = presetRange(next);
      setFrom(range.from);
      setTo(range.to);
    }
  };

  const params: ReportParams = useMemo(
    () => ({
      branchId: branchId ?? undefined,
      from: from || undefined,
      to: to || undefined,
      groupBy: groupByOptions ? groupBy : undefined,
    }),
    [branchId, from, to, groupBy, groupByOptions],
  );

  const reportQuery = useQuery({
    queryKey: ["reports", activeKey, params],
    queryFn: () => getReport(activeKey, params),
    enabled: branchId !== null,
    placeholderData: keepPreviousData,
  });

  const report = reportQuery.data ?? null;

  const handleDownload = async (format: ReportFormat) => {
    setDownloading(format);
    try {
      await downloadReport(activeKey, params, format);
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo exportar el reporte"));
    } finally {
      setDownloading(null);
    }
  };

  const errorMessage =
    reportQuery.error instanceof ApiError
      ? reportQuery.error.message
      : "Ocurrió un error al cargar el reporte";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ventas, productos, mozos, caja, stock y compras. Exportá a CSV, Excel
          o PDF.
        </p>
      </div>

      {branchId === null ? (
        <BranchRequired />
      ) : (
        <>
          {/* Tabs por reporte */}
          <div className="flex flex-wrap gap-1.5">
            {REPORT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveKey(key);
                  const opts = REPORT_GROUP_BY[key];
                  if (opts) setGroupBy(opts[0].value);
                }}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  activeKey === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {REPORT_LABELS[key]}
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="space-y-4 p-4 md:p-6">
              {/* Controles */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <span className="block text-xs text-muted-foreground">
                    Rango
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(PRESET_LABELS) as Preset[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => applyPreset(value)}
                        className={cn(
                          "cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors",
                          preset === value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-input text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {PRESET_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="block text-xs text-muted-foreground">
                    Desde
                  </span>
                  <Input
                    type="date"
                    value={from}
                    onChange={(event) => {
                      setFrom(event.target.value);
                      setPreset("custom");
                    }}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <span className="block text-xs text-muted-foreground">
                    Hasta
                  </span>
                  <Input
                    type="date"
                    value={to}
                    onChange={(event) => {
                      setTo(event.target.value);
                      setPreset("custom");
                    }}
                    className="w-40"
                  />
                </div>

                {groupByOptions && (
                  <div className="space-y-1">
                    <span className="block text-xs text-muted-foreground">
                      Agrupar por
                    </span>
                    <Select
                      value={groupBy}
                      onChange={(event) => setGroupBy(event.target.value)}
                      className="w-40"
                      aria-label="Agrupar por"
                    >
                      {groupByOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="ml-auto flex items-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading !== null}
                    onClick={() => handleDownload("csv")}
                  >
                    {downloading === "csv" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Download />
                    )}
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading !== null}
                    onClick={() => handleDownload("xlsx")}
                  >
                    {downloading === "xlsx" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <FileSpreadsheet />
                    )}
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading !== null}
                    onClick={() => handleDownload("pdf")}
                  >
                    {downloading === "pdf" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <FileText />
                    )}
                    PDF
                  </Button>
                </div>
              </div>

              {/* Resultado */}
              {reportQuery.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : reportQuery.isError ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                    <ServerOff className="size-6 text-destructive" />
                  </div>
                  <p className="font-medium">{errorMessage}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void reportQuery.refetch()}
                  >
                    <RefreshCw />
                    Reintentar
                  </Button>
                </div>
              ) : !report || report.columns.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <BarChart3 className="size-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium">Sin datos para el rango elegido</p>
                </div>
              ) : (
                <ReportTable report={report} />
              )}

              {reportQuery.isFetching && !reportQuery.isPending && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Actualizando…
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ReportTable({ report }: { report: ReportData }) {
  const { columns, rows, totals } = report;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
        <TableIcon className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No hay filas para mostrar en este rango.
        </p>
      </div>
    );
  }

  const isNumeric = (type: string) =>
    type === "currency" || type === "money" || type === "number";

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(isNumeric(col.type) && "text-right")}
              >
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    isNumeric(col.type) && "text-right tabular-nums",
                  )}
                >
                  {formatReportValue(row[col.key], col.type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {totals && (
            <TableRow className="border-t-2 bg-muted/50 font-semibold hover:bg-muted/50">
              {columns.map((col, index) => {
                const value = totals[col.key];
                return (
                  <TableCell
                    key={col.key}
                    className={cn(
                      isNumeric(col.type) && "text-right tabular-nums",
                    )}
                  >
                    {value != null
                      ? formatReportValue(value, col.type)
                      : index === 0
                        ? "Totales"
                        : ""}
                  </TableCell>
                );
              })}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

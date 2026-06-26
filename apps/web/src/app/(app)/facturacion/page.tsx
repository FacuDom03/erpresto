"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ServerOff,
} from "lucide-react";

import { ApiError } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import {
  getInvoices,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUSES,
  INVOICE_TYPE_SHORT,
  INVOICE_TYPES,
} from "@/lib/invoices";
import type { InvoiceStatus, InvoiceType } from "@/lib/types";
import { formatARS, formatDate } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { Badge } from "@/components/ui/badge";
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

const PAGE_SIZE = 15;

export default function FacturacionPage() {
  const router = useRouter();
  const { branchId } = useBranch();

  const [type, setType] = useState<InvoiceType | "">("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const invoicesQuery = useQuery({
    queryKey: [
      "invoices",
      { branchId, type, status, from, to, search, page, limit: PAGE_SIZE },
    ],
    queryFn: () =>
      getInvoices({
        branchId: branchId ?? undefined,
        type: type || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: branchId !== null,
    placeholderData: keepPreviousData,
  });

  const invoices = invoicesQuery.data?.data ?? [];
  const total = invoicesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = useMemo(
    () => type !== "" || status !== "" || from !== "" || to !== "" || search !== "",
    [type, status, from, to, search],
  );

  const errorMessage =
    invoicesQuery.error instanceof ApiError
      ? invoicesQuery.error.message
      : "Ocurrió un error al cargar los comprobantes";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facturación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comprobantes electrónicos emitidos (ARCA/AFIP): facturas y notas de
          crédito con su CAE.
        </p>
      </div>

      {branchId === null ? (
        <BranchRequired />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar por número, cliente o CUIT…"
                  className="pl-8"
                />
              </div>
              <Select
                value={type}
                onChange={(event) => {
                  setType(event.target.value as InvoiceType | "");
                  setPage(1);
                }}
                className="w-44"
                aria-label="Filtrar por tipo"
              >
                <option value="">Todos los tipos</option>
                {INVOICE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {INVOICE_TYPE_SHORT[value]}
                  </option>
                ))}
              </Select>
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as InvoiceStatus | "");
                  setPage(1);
                }}
                className="w-44"
                aria-label="Filtrar por estado"
              >
                <option value="">Todos los estados</option>
                {INVOICE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {INVOICE_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <span className="block text-xs text-muted-foreground">
                    Desde
                  </span>
                  <Input
                    type="date"
                    value={from}
                    onChange={(event) => {
                      setFrom(event.target.value);
                      setPage(1);
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
                      setPage(1);
                    }}
                    className="w-40"
                  />
                </div>
              </div>
            </div>

            {invoicesQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : invoicesQuery.isError ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <ServerOff className="size-6 text-destructive" />
                </div>
                <p className="font-medium">{errorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void invoicesQuery.refetch()}
                >
                  <RefreshCw />
                  Reintentar
                </Button>
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {hasFilters
                      ? "No hay comprobantes para los filtros elegidos"
                      : "Todavía no hay comprobantes emitidos"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {hasFilters
                      ? "Probá con otros filtros."
                      : "Facturá un pedido cerrado desde el POS para generar el primer comprobante."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>CAE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow
                          key={invoice.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/facturacion/${invoice.id}`)
                          }
                        >
                          <TableCell className="font-medium tabular-nums">
                            <Link
                              href={`/facturacion/${invoice.id}`}
                              className="hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {invoice.formattedNumber}
                            </Link>
                            {invoice.isMock && (
                              <Badge variant="outline" className="ml-2">
                                Simulado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {INVOICE_TYPE_SHORT[invoice.type]}
                          </TableCell>
                          <TableCell>
                            {invoice.customerName ?? (
                              <span className="text-xs text-muted-foreground">
                                Consumidor final
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {formatDate(invoice.issuedAt ?? invoice.createdAt)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatARS(invoice.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <InvoiceStatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell className="tabular-nums text-xs text-muted-foreground">
                            {invoice.cae ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <p>
                    Mostrando{" "}
                    <span className="font-medium text-foreground">
                      {(page - 1) * PAGE_SIZE + 1}–
                      {Math.min(page * PAGE_SIZE, total)}
                    </span>{" "}
                    de{" "}
                    <span className="font-medium text-foreground">{total}</span>{" "}
                    comprobantes
                    {invoicesQuery.isFetching && (
                      <Loader2 className="ml-2 inline size-3.5 animate-spin" />
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft />
                      Anterior
                    </Button>
                    <span className="tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Siguiente
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

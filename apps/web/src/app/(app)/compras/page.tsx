"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  ServerOff,
  ShoppingCart,
} from "lucide-react";

import { ApiError } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { getPurchaseOrders, PURCHASE_STATUS_LABELS } from "@/lib/purchases";
import { getSuppliers } from "@/lib/suppliers";
import type { PurchaseOrderStatus } from "@/lib/types";
import { formatARS, formatDate } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { PurchaseStatusBadge } from "@/components/purchases/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
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

const PAGE_SIZE = 10;

const STATUSES = Object.keys(PURCHASE_STATUS_LABELS) as PurchaseOrderStatus[];

export default function ComprasPage() {
  const router = useRouter();
  const { branchId, branches } = useBranch();

  const [status, setStatus] = useState<PurchaseOrderStatus | "">("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", { page: 1, limit: 500, search: "" }],
    queryFn: () => getSuppliers({ page: 1, limit: 500 }),
    staleTime: 60_000,
  });

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "Todos los proveedores" },
      ...(suppliersQuery.data?.data ?? []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    ],
    [suppliersQuery.data],
  );

  const ordersQuery = useQuery({
    queryKey: [
      "purchase-orders",
      { branchId, status, supplierId, page, limit: PAGE_SIZE },
    ],
    queryFn: () =>
      getPurchaseOrders({
        branchId: branchId as string,
        status: status || undefined,
        supplierId: supplierId || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: branchId !== null,
    placeholderData: keepPreviousData,
  });

  const orders = ordersQuery.data?.data ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = status !== "" || supplierId;

  const branchName = (id: string | null | undefined): string | null =>
    branches.find((b) => b.id === id)?.name ?? null;

  const errorMessage =
    ordersQuery.error instanceof ApiError
      ? ordersQuery.error.message
      : "Ocurrió un error al cargar las órdenes de compra";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Órdenes de compra
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generación y seguimiento de compras con recepción de mercadería y
            actualización de costos.
          </p>
        </div>
        <Button onClick={() => router.push("/compras/nueva")}>
          <Plus />
          Nueva orden
        </Button>
      </div>

      {branchId === null ? (
        <BranchRequired />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap gap-3">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as PurchaseOrderStatus | "");
                  setPage(1);
                }}
                className="w-52"
                aria-label="Filtrar por estado"
              >
                <option value="">Todos los estados</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {PURCHASE_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
              <Combobox
                options={supplierOptions}
                value={supplierId ?? ""}
                onChange={(value) => {
                  setSupplierId(value || null);
                  setPage(1);
                }}
                placeholder="Todos los proveedores"
                searchPlaceholder="Buscar proveedor…"
                emptyText="Sin proveedores"
                loading={suppliersQuery.isPending}
                className="w-64"
              />
            </div>

            {ordersQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : ordersQuery.isError ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <ServerOff className="size-6 text-destructive" />
                </div>
                <p className="font-medium">{errorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void ordersQuery.refetch()}
                >
                  <RefreshCw />
                  Reintentar
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <ShoppingCart className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {hasFilters
                      ? "No hay órdenes para los filtros elegidos"
                      : "Todavía no hay órdenes de compra"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {hasFilters
                      ? "Probá con otro estado o proveedor."
                      : "Creá la primera orden para reponer insumos."}
                  </p>
                </div>
                {!hasFilters && (
                  <Button size="sm" onClick={() => router.push("/compras/nueva")}>
                    <Plus />
                    Nueva orden
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">
                          Fecha esperada
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/compras/${order.id}`)}
                        >
                          <TableCell className="font-medium tabular-nums">
                            <Link
                              href={`/compras/${order.id}`}
                              className="hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              #{order.number ?? "—"}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {order.supplier?.name ?? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {order.branch?.name ??
                              branchName(order.branchId) ?? (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                          </TableCell>
                          <TableCell>
                            <PurchaseStatusBadge status={order.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatARS(order.total)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatDate(order.expectedAt)}
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
                    órdenes
                    {ordersQuery.isFetching && (
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

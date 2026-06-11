"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Loader2,
  RefreshCw,
  ServerOff,
} from "lucide-react";

import { getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { useRealtime } from "@/lib/realtime";
import {
  getOrders,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
} from "@/lib/orders";
import type { OrderStatus, OrderType } from "@/lib/types";
import { formatARS, formatTime } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<OrderStatus, BadgeProps["variant"]> = {
  OPEN: "success",
  CLOSED: "secondary",
  CANCELLED: "destructive",
};

const STATUS_OPTIONS: OrderStatus[] = ["OPEN", "CLOSED", "CANCELLED"];
const TYPE_OPTIONS: OrderType[] = [
  "DINE_IN",
  "COUNTER",
  "TAKEAWAY",
  "DELIVERY",
];

export default function PedidosPage() {
  const { branchId } = useBranch();
  useRealtime(branchId);

  const [status, setStatus] = useState<OrderStatus | "">("");
  const [type, setType] = useState<OrderType | "">("");
  const [page, setPage] = useState(1);

  const ordersQuery = useQuery({
    queryKey: ["orders", "list", branchId, { status, type, page }],
    queryFn: () =>
      getOrders({
        branchId: branchId as string,
        status: status || undefined,
        type: type || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: Boolean(branchId),
    placeholderData: keepPreviousData,
  });

  const orders = ordersQuery.data?.data ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial y seguimiento de los pedidos de la sucursal.
        </p>
      </div>

      {!branchId ? (
        <BranchRequired />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as OrderStatus | "");
                  setPage(1);
                }}
                className="w-44"
                aria-label="Filtrar por estado"
              >
                <option value="">Todos los estados</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
              <Select
                value={type}
                onChange={(event) => {
                  setType(event.target.value as OrderType | "");
                  setPage(1);
                }}
                className="w-44"
                aria-label="Filtrar por tipo"
              >
                <option value="">Todos los tipos</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {ORDER_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
              {ordersQuery.isFetching && !ordersQuery.isPending && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {ordersQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : ordersQuery.isError ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <ServerOff className="size-6 text-destructive" />
                </div>
                <p className="font-medium">
                  {getErrorMessage(
                    ordersQuery.error,
                    "No se pudieron cargar los pedidos",
                  )}
                </p>
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
                  <ClipboardList className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium">
                  No hay pedidos para los filtros elegidos
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Mesa</TableHead>
                        <TableHead>Mozo</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Acciones</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium tabular-nums">
                            {order.number != null ? `#${order.number}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {ORDER_TYPE_LABELS[order.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>{order.table?.name ?? "—"}</TableCell>
                          <TableCell>{order.waiter?.name ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatARS(order.total)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[order.status]}>
                              {ORDER_STATUS_LABELS[order.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatTime(order.createdAt)}
                          </TableCell>
                          <TableCell>
                            {order.status === "OPEN" && (
                              <Link
                                href={`/pos/${order.id}`}
                                title="Abrir en el POS"
                                className={buttonVariants({
                                  variant: "ghost",
                                  size: "icon",
                                })}
                              >
                                <ExternalLink />
                                <span className="sr-only">
                                  Abrir en el POS
                                </span>
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">{total}</span>{" "}
                    pedidos en total
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

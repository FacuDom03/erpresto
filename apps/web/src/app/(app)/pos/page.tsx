"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Armchair,
  Bike,
  Clock,
  Loader2,
  ReceiptText,
  RefreshCw,
  ServerOff,
  ShoppingBag,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { useRealtime } from "@/lib/realtime";
import { createOrder, getOrders, ORDER_TYPE_LABELS } from "@/lib/orders";
import type { OrderType } from "@/lib/types";
import { formatARS, formatElapsed } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const NEW_ORDER_BUTTONS: {
  type: OrderType;
  label: string;
  icon: typeof Store;
}[] = [
  { type: "COUNTER", label: "Nuevo mostrador", icon: Store },
  { type: "TAKEAWAY", label: "Nuevo take away", icon: ShoppingBag },
  { type: "DELIVERY", label: "Nuevo delivery", icon: Bike },
];

export default function PosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { branchId } = useBranch();
  useRealtime(branchId);

  // Tick para el "tiempo abierto" de cada pedido.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const ordersQuery = useQuery({
    queryKey: ["orders", "open", branchId],
    queryFn: () =>
      getOrders({ branchId: branchId as string, status: "OPEN", limit: 100 }),
    enabled: Boolean(branchId),
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (type: OrderType) =>
      createOrder({ branchId: branchId as string, type }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push(`/pos/${order.id}`);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo crear el pedido"));
    },
  });

  const orders = ordersQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos abiertos de la sucursal. Tocá uno para continuar la venta.
        </p>
      </div>

      {!branchId ? (
        <BranchRequired />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {NEW_ORDER_BUTTONS.map(({ type, label, icon: Icon }) => (
              <Button
                key={type}
                size="lg"
                variant="outline"
                className="h-20 flex-col gap-1.5 text-base [&_svg]:size-6"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(type)}
              >
                {createMutation.isPending &&
                createMutation.variables === type ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Icon />
                )}
                {label}
              </Button>
            ))}
          </div>

          {ordersQuery.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : ordersQuery.isError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
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
              </CardContent>
            </Card>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <ReceiptText className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No hay pedidos abiertos</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Creá uno nuevo con los botones de arriba o abrí una mesa
                    desde el plano del salón.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/pos/${order.id}`)}
                  className="cursor-pointer rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {order.number != null ? `#${order.number}` : "Pedido"}
                    </span>
                    <Badge variant="secondary">
                      {ORDER_TYPE_LABELS[order.type]}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Armchair className="size-3.5" />
                      {order.table?.name ?? "Sin mesa"}
                    </p>
                    {order.createdAt && (
                      <p className="flex items-center gap-1.5 tabular-nums">
                        <Clock className="size-3.5" />
                        {formatElapsed(order.createdAt, now)} abierto
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-lg font-semibold tabular-nums">
                    {formatARS(order.total)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  Clock,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  ServerOff,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { useRealtime } from "@/lib/realtime";
import {
  assignCourier,
  DELIVERY_BOARD_STATUSES,
  DELIVERY_STATUS_LABELS,
  getCouriers,
  getDeliveries,
  nextDeliveryStatus,
  updateDeliveryStatus,
} from "@/lib/deliveries";
import type { Delivery, DeliveryStatus } from "@/lib/types";
import { formatARS, formatTime } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const COLUMN_ACTION_LABEL: Partial<Record<DeliveryStatus, string>> = {
  ASSIGNED: "Marcar en camino",
  IN_TRANSIT: "Marcar entregado",
};

export default function DeliveryPage() {
  const queryClient = useQueryClient();
  const { branchId } = useBranch();
  useRealtime(branchId);

  const [assignTarget, setAssignTarget] = useState<Delivery | null>(null);
  const [courierId, setCourierId] = useState("");

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", branchId],
    queryFn: () => getDeliveries({ branchId: branchId as string }),
    enabled: Boolean(branchId),
    refetchInterval: 30_000,
  });

  const couriersQuery = useQuery({
    queryKey: ["couriers", branchId],
    queryFn: () => getCouriers(branchId as string),
    enabled: Boolean(branchId) && assignTarget !== null,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["deliveries"] });

  const assignMutation = useMutation({
    mutationFn: ({ id, courier }: { id: string; courier: string }) =>
      assignCourier(id, courier),
    onSuccess: () => {
      toast.success("Repartidor asignado");
      setAssignTarget(null);
      setCourierId("");
      invalidate();
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo asignar el repartidor"));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) =>
      updateDeliveryStatus(id, status),
    onSuccess: () => {
      invalidate();
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo actualizar el estado"));
      invalidate();
    },
  });

  const deliveries = deliveriesQuery.data ?? [];

  const byStatus = (status: DeliveryStatus) =>
    deliveries.filter((d) => d.status === status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tablero de pedidos a domicilio: asigná repartidores y seguí el
            estado de cada entrega.
          </p>
        </div>
        {branchId !== null && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void deliveriesQuery.refetch()}
            disabled={deliveriesQuery.isFetching}
          >
            {deliveriesQuery.isFetching ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Actualizar
          </Button>
        )}
      </div>

      {branchId === null ? (
        <BranchRequired />
      ) : deliveriesQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : deliveriesQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {getErrorMessage(
                deliveriesQuery.error,
                "No se pudieron cargar las entregas",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void deliveriesQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {DELIVERY_BOARD_STATUSES.map((status) => {
            const items = byStatus(status);
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    {DELIVERY_STATUS_LABELS[status]}
                  </h2>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="space-y-3">
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                      Sin pedidos
                    </p>
                  ) : (
                    items.map((delivery) => {
                      const next = nextDeliveryStatus(delivery.status);
                      return (
                        <Card key={delivery.id} className="overflow-hidden">
                          <CardContent className="space-y-2.5 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold tabular-nums">
                                {delivery.orderNumber != null
                                  ? `#${delivery.orderNumber}`
                                  : "Pedido"}
                              </span>
                              <span className="text-sm font-semibold tabular-nums">
                                {formatARS(delivery.total)}
                              </span>
                            </div>

                            <div className="space-y-1 text-xs text-muted-foreground">
                              {delivery.customerName && (
                                <p className="flex items-center gap-1.5">
                                  <UserIcon className="size-3.5 shrink-0" />
                                  <span className="truncate">
                                    {delivery.customerName}
                                  </span>
                                </p>
                              )}
                              {delivery.customerPhone && (
                                <p className="flex items-center gap-1.5">
                                  <Phone className="size-3.5 shrink-0" />
                                  {delivery.customerPhone}
                                </p>
                              )}
                              <p className="flex items-start gap-1.5">
                                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                                <span>{delivery.address ?? "Sin dirección"}</span>
                              </p>
                              {delivery.estimatedAt && (
                                <p className="flex items-center gap-1.5 tabular-nums">
                                  <Clock className="size-3.5 shrink-0" />
                                  Estimado {formatTime(delivery.estimatedAt)}
                                </p>
                              )}
                            </div>

                            {delivery.courier ? (
                              <Badge variant="outline" className="gap-1">
                                <Bike className="size-3" />
                                {delivery.courier.name}
                              </Badge>
                            ) : (
                              <Badge variant="warning">Sin asignar</Badge>
                            )}

                            <div className="flex flex-col gap-1.5 pt-1">
                              {(delivery.status === "PENDING" ||
                                delivery.status === "ASSIGNED") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setAssignTarget(delivery);
                                    setCourierId(delivery.courier?.id ?? "");
                                  }}
                                >
                                  <Bike />
                                  {delivery.courier
                                    ? "Reasignar"
                                    : "Asignar repartidor"}
                                </Button>
                              )}
                              {next && COLUMN_ACTION_LABEL[delivery.status] && (
                                <Button
                                  size="sm"
                                  disabled={
                                    statusMutation.isPending &&
                                    statusMutation.variables?.id === delivery.id
                                  }
                                  onClick={() =>
                                    statusMutation.mutate({
                                      id: delivery.id,
                                      status: next,
                                    })
                                  }
                                >
                                  {statusMutation.isPending &&
                                  statusMutation.variables?.id ===
                                    delivery.id ? (
                                    <Loader2 className="animate-spin" />
                                  ) : null}
                                  {COLUMN_ACTION_LABEL[delivery.status]}
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog de asignación */}
      <Dialog
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTarget(null);
            setCourierId("");
          }
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Asignar repartidor</DialogTitle>
          <DialogDescription>
            Pedido{" "}
            {assignTarget?.orderNumber != null
              ? `#${assignTarget.orderNumber}`
              : ""}{" "}
            — {assignTarget?.address ?? "sin dirección"}.
          </DialogDescription>
        </DialogHeader>
        {couriersQuery.isPending ? (
          <Skeleton className="h-9 w-full" />
        ) : couriersQuery.isError ? (
          <p className="text-sm text-destructive">
            No se pudieron cargar los repartidores.
          </p>
        ) : (couriersQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay repartidores en esta sucursal. Cargá usuarios con rol
            Repartidor para poder asignar.
          </p>
        ) : (
          <Select
            value={courierId}
            onChange={(event) => setCourierId(event.target.value)}
            aria-label="Repartidor"
          >
            <option value="">Elegir repartidor…</option>
            {(couriersQuery.data ?? []).map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name}
              </option>
            ))}
          </Select>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAssignTarget(null)}>
            Cancelar
          </Button>
          <Button
            disabled={!courierId || assignMutation.isPending}
            onClick={() => {
              if (assignTarget && courierId) {
                assignMutation.mutate({
                  id: assignTarget.id,
                  courier: courierId,
                });
              }
            }}
          >
            {assignMutation.isPending && <Loader2 className="animate-spin" />}
            Asignar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Loader2,
  PackageCheck,
  Pencil,
  RefreshCw,
  Send,
  ServerOff,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  sendPurchaseOrder,
} from "@/lib/purchases";
import { UNIT_SHORT } from "@/lib/raw-materials";
import { formatARS, formatDate, formatDateTime, formatQuantity } from "@/lib/utils";
import { PurchaseStatusBadge } from "@/components/purchases/status-badge";
import { ReceiveDialog } from "@/components/purchases/receive-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function OrdenCompraDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const orderQuery = useQuery({
    queryKey: ["purchase-orders", id],
    queryFn: () => getPurchaseOrder(id),
    enabled: Boolean(id),
  });
  const order = orderQuery.data ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
  };

  const sendMutation = useMutation({
    mutationFn: () => sendPurchaseOrder(id),
    onSuccess: () => {
      invalidate();
      toast.success("Orden enviada al proveedor");
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo enviar la orden"));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPurchaseOrder(id),
    onSuccess: () => {
      invalidate();
      toast.success("Orden anulada");
      setCancelOpen(false);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo anular la orden"));
    },
  });

  if (orderQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/compras")}>
          <ArrowLeft />
          Compras
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {getErrorMessage(
                orderQuery.error,
                "No se pudo cargar la orden de compra",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void orderQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEdit = order.status === "DRAFT";
  const canSend = order.status === "DRAFT";
  const canReceive =
    order.status === "SENT" || order.status === "PARTIALLY_RECEIVED";
  const canCancel = order.status === "DRAFT" || order.status === "SENT";

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/compras")}>
          <ArrowLeft />
          Compras
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          Orden de compra {order.number != null ? `#${order.number}` : ""}
        </h1>
        <PurchaseStatusBadge status={order.status} />

        <div className="ml-auto flex flex-wrap gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/compras/${order.id}/editar`)}
            >
              <Pencil />
              Editar
            </Button>
          )}
          {canSend && (
            <Button
              size="sm"
              disabled={sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
            >
              {sendMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Send />
              )}
              Enviar
            </Button>
          )}
          {canReceive && (
            <Button size="sm" onClick={() => setReceiveOpen(true)}>
              <PackageCheck />
              Recibir mercadería
            </Button>
          )}
          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setCancelOpen(true)}
            >
              <Ban />
              Anular
            </Button>
          )}
        </div>
      </div>

      {/* Datos generales */}
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 md:p-6 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Proveedor</p>
            <p className="mt-0.5 font-medium">
              {order.supplier?.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sucursal</p>
            <p className="mt-0.5 font-medium">{order.branch?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fecha esperada</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {formatDate(order.expectedAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Creada</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {formatDateTime(order.createdAt)}
            </p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs text-muted-foreground">Notas</p>
              <p className="mt-0.5 text-sm">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Insumos</CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Pedido</TableHead>
                  <TableHead className="text-right">Recibido</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="w-36">Avance</TableHead>
                  <TableHead className="text-right">Costo unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => {
                  const pending = Math.max(0, item.quantity - item.receivedQty);
                  const progress =
                    item.quantity > 0
                      ? Math.min(100, (item.receivedQty / item.quantity) * 100)
                      : 0;
                  const unit = item.rawMaterial
                    ? UNIT_SHORT[item.rawMaterial.unit]
                    : "";
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.rawMaterial?.name ?? "Insumo"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(item.quantity)} {unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(item.receivedQty)} {unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(pending)} {unit}
                      </TableCell>
                      <TableCell>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={Math.round(progress)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={
                              progress >= 100 ? "h-full bg-success" : "h-full bg-primary"
                            }
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatARS(item.unitCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatARS(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-semibold tabular-nums">
              {formatARS(order.total)}
            </span>
          </div>
        </CardContent>
      </Card>

      <ReceiveDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        order={order}
      />

      {/* Confirmación de anulación */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anular orden de compra</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés anular la orden{" "}
            <span className="font-medium text-foreground">
              #{order.number ?? "—"}
            </span>
            ? Esta acción no se puede deshacer y la orden no podrá recibirse.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setCancelOpen(false)}
            disabled={cancelMutation.isPending}
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending && <Loader2 className="animate-spin" />}
            Anular orden
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
